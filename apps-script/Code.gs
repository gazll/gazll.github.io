/**
 * gazl backend — Google Sheet as the database, Apps Script as the API.
 *
 * SECURITY MODEL. Deployed as "Execute as: Me" + "Who has access: Anyone",
 * so anyone on the internet can POST here. There is no RLS — this file is
 * the only thing enforcing access. Three rules that must never be relaxed:
 *
 *   1. Every action goes through requireUser() before touching a Sheet.
 *   2. requireUser() checks the token's `aud` equals our CLIENT_ID. Skip it
 *      and a valid Google ID token minted for ANOTHER app impersonates
 *      any user here.
 *   3. user_id always comes from the verified token's `sub`, never from
 *      anything the client sent.
 *
 * SETUP: set CLIENT_ID, run setup() once, then Deploy -> New deployment ->
 * Web app (Execute as: Me, Who has access: Anyone).
 * Editing this file needs Deploy -> Manage deployments -> New version,
 * otherwise the Web App keeps serving the old code.
 */

/** Must match GOOGLE_CLIENT_ID in the frontend config. */
var CLIENT_ID = '903030402350-hgapha7ttog7ejubaoq94eaevdcv9rf2.apps.googleusercontent.com';

/** Empty = any Google account may sign in, each with private data.
 *  Add emails to lock the backend to just those people. */
var ALLOWED_EMAILS = [];

/** Abuse guard: a single request may not write more rows than this. */
var MAX_ROWS_PER_PUSH = 2000;

/** Calendar checklist ticks share the generic app_config sheet. The prefix
 *  keeps them apart from any other setting that app may come to store. */
var CALENDAR_APP = 'calendar';
var CHECK_PREFIX = 'check:';

/**
 * Ticks are CO-OP, not personal: the sealed file is one file and everyone who
 * can open it is looking at the same household, so "đã mua men vi sinh chưa"
 * must read the same for all of them. They therefore live under a bucket id in
 * `user_id` rather than under a person's `sub` — and because the rows are now
 * shared, both reading and writing them are gated on `hasScheduleAccess`,
 * which per-user rows never needed.
 *
 * The cluster is `schedule_access` today. When clusters become one per
 * passphrase, only CLUSTER changes — an id derived per key instead of this one
 * constant — and existing rows keep working because the bucket id is data, not
 * code. Bucket ids carry a prefix so they can never collide with a Google
 * `sub`, which is digits only.
 */
var SCHEDULE_CLUSTER = 'shared';
function scheduleBucket() { return 'schedule:' + SCHEDULE_CLUSTER; }

/* ------------------------------------------------------------------ */
/* Sheet definitions                                                   */
/* ------------------------------------------------------------------ */

var SHEETS = {
  profiles:            ['user_id', 'email', 'name', 'picture', 'role', 'created_at', 'last_seen_at'],
  progress:            ['user_id', 'item_id', 'reviewed_at'],
  notes:               ['user_id', 'item_id', 'body', 'updated_at'],
  study_log:           ['user_id', 'item_id', 'opened_at'],
  interviews:          ['id', 'user_id', 'name', 'role', 'happened_on', 'result', 'stack', 'sort_order', 'created_at', 'updated_at', 'active_question_set', 'references_json', 'jd', 'brief', 'rounds_json'],
  interview_questions: ['id', 'interview_id', 'user_id', 'round', 'q', 'a', 'note', 'sort_order', 'diagrams_json', 'question_set_id'],

  /** Fshare tool: folders the user has opened. One row per (user, linkcode). */
  fshare_history:      ['user_id', 'linkcode', 'name', 'hits', 'last_at'],

  /** Site search: recent queries, so history follows the reader between
   *  devices. One row per (user, q). Signed-out history never reaches here —
   *  it stays in the browser session. */
  search_history:      ['user_id', 'q', 'hits', 'last_at'],

  /** Generic per-user settings, namespaced by `app` so other tools can share. */
  app_config:          ['user_id', 'app', 'key', 'value', 'updated_at'],

  /** Schedule inbox: reminders captured on a phone, away from the repository.
   *  A holding pen, never the source of truth — the schedule itself lives in
   *  the sealed JSON in git. A row is transcribed into that file and then
   *  marked `merged`, so losing this sheet loses at most the untranscribed
   *  notes. Keep it that way: nothing here should ever be the only copy. */
  schedule_inbox:      ['id', 'user_id', 'body', 'category', 'due_hint', 'status', 'created_at', 'updated_at'],

  /** Who may open the sealed schedule. Edit by hand, exactly like setting a
   *  role in `profiles`: one row per person, keyed on the Google email.
   *  The passphrase itself is NOT here — it is a Script Property, because a
   *  Sheet cell is the thing most likely to be shared by accident. */
  schedule_access:     ['email', 'name', 'note', 'granted_at']
};

/**
 * A menu in the Spreadsheet itself.
 *
 * Running these from the Apps Script editor works, but every dialog they open
 * appears in the SPREADSHEET tab rather than the editor — so the editor looks
 * like it has hung while the prompt waits, unseen, in the other tab. Driving
 * them from the Sheet puts the click and the dialog in the same window.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('gazl')
    .addItem('Tạo/kiểm tra các sheet', 'setup')
    .addSeparator()
    .addItem('Cài passphrase lịch riêng', 'setScheduleKey')
    .addItem('Kiểm tra passphrase', 'checkScheduleKey')
    .addToUi();
}

/**
 * Run by hand (menu gazl -> Cài passphrase, or Run -> setScheduleKey).
 *
 * The Script Properties pane does the same thing, but this asks in a dialog
 * that closes, so the passphrase never sits in a settings field, never lands
 * in this file, and never enters the version history Apps Script keeps of it.
 * Never replace the prompt with a literal — a saved deployment version would
 * keep that string forever.
 */
function setScheduleKey() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.prompt('Passphrase cho lịch riêng', 'Dán passphrase vào đây:', ui.ButtonSet.OK_CANCEL);
  if (answer.getSelectedButton() !== ui.Button.OK) return;

  var key = trim(answer.getResponseText());
  if (!key) { ui.alert('Chưa nhập gì — không thay đổi.'); return; }

  PropertiesService.getScriptProperties().setProperty('SCHEDULE_KEY', key);
  ui.alert('Đã lưu. Nhớ Deploy -> Manage deployments -> New version.');
}

/** Confirms a key is stored without revealing it. */
function checkScheduleKey() {
  var key = PropertiesService.getScriptProperties().getProperty('SCHEDULE_KEY');
  SpreadsheetApp.getUi().alert(key
    ? 'SCHEDULE_KEY đã có (' + key.length + ' ký tự).'
    : 'Chưa có SCHEDULE_KEY.');
}

/** Run once by hand (Run -> setup) to create every sheet declared above. */
function setup() {
  var n = 0;
  for (var name in SHEETS) { table(name); n++; }
  SpreadsheetApp.getActiveSpreadsheet().toast('Đã tạo/kiểm tra đủ ' + n + ' sheet.', 'gazl', 5);
}

/* ------------------------------------------------------------------ */
/* HTTP entry points                                                   */
/* ------------------------------------------------------------------ */

/**
 * Liveness check — returns no user data, so it needs no token.
 *
 * It also reports which actions this build understands. Apps Script serves the
 * last *deployed* version, not the saved file, so editing this file changes
 * nothing until Deploy → Manage deployments → New version. The only symptom
 * was a bare "Action không hợp lệ." from a POST, which points at the client
 * rather than at the stale deployment. Listing the actions lets the client say
 * so plainly — and reveals nothing, since every action name is already in the
 * public page source and each one still passes requireUser().
 */
function doGet() {
  return json({
    ok: true,
    service: 'gazl',
    actions: Object.keys(ACTIONS),
    time: new Date().toISOString()
  });
}

/**
 * The whole API. The client sends Content-Type text/plain to keep the
 * request CORS-simple, because Apps Script cannot answer preflight OPTIONS.
 * That is also why idToken travels in the body: an Authorization header
 * would trigger a preflight.
 */
function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = String(req.action || '');
    var payload = req.payload || {};

    var user = requireUser(req.idToken);       // always first
    var handler = ACTIONS[action];
    if (!handler) return json({ ok: false, error: 'Action không hợp lệ.' });

    return json({ ok: true, data: handler(user, payload) });
  } catch (err) {
    return json({
      ok: false,
      error: err && err.publicMessage
        ? err.publicMessage
        : 'Lỗi máy chủ. Vui lòng thử lại sau.'
    });
  }
}

/**
 * ContentService cannot set an HTTP status, so every response is 200 and the
 * outcome lives in the body as { ok, data } / { ok, error }. api.js reads
 * that `ok` flag.
 */
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Marks a deliberately safe client-facing error; all other details stay server-side. */
function publicError(message) {
  var err = new Error(message);
  err.publicMessage = message;
  return err;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

/** Verified identity { sub, email, name, picture, role }, or throws. */
function requireUser(idToken) {
  if (!idToken) throw publicError('Thiếu idToken — cần đăng nhập.');
  if (CLIENT_ID.indexOf('PASTE_YOUR') === 0) throw publicError('Backend chưa cấu hình CLIENT_ID.');

  var identity = verifyIdToken(idToken);

  if (ALLOWED_EMAILS.length && ALLOWED_EMAILS.indexOf(identity.email) === -1) {
    throw publicError('Không được phép: email này chưa nằm trong ALLOWED_EMAILS.');
  }
  return upsertProfile(identity);
}

function verifyIdToken(idToken) {
  var cache = CacheService.getScriptCache();
  var key = 'tok_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken));

  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  // Reject junk before spending UrlFetch quota: this URL is public, so a bot
  // could otherwise burn one quota unit per garbage request. Unsigned data,
  // so it filters only — tokeninfo below is what actually verifies.
  var peek = peekJwt(idToken);
  if (!peek) throw publicError('Token không đúng định dạng.');
  if (peek.aud !== CLIENT_ID) throw publicError('Token phát cho app khác (aud không khớp).');
  if (!(Number(peek.exp) > Math.floor(Date.now() / 1000))) throw publicError('Token đã hết hạn.');

  var res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true });

  if (res.getResponseCode() !== 200) throw publicError('Token không hợp lệ hoặc đã hết hạn.');
  var info = JSON.parse(res.getContentText());

  // Dropping any of these four opens the door to impersonation.
  if (info.aud !== CLIENT_ID) throw publicError('Token phát cho app khác (aud không khớp).');
  if (info.iss !== 'accounts.google.com' && info.iss !== 'https://accounts.google.com') {
    throw publicError('Token không do Google phát (iss không khớp).');
  }
  var secondsLeft = Number(info.exp) - Math.floor(Date.now() / 1000);
  if (!(secondsLeft > 0)) throw publicError('Token đã hết hạn.');
  if (String(info.email_verified) !== 'true') throw publicError('Email chưa được Google xác minh.');

  var identity = {
    sub: info.sub,
    email: String(info.email || '').toLowerCase(),
    name: info.name || '',
    picture: info.picture || ''
  };
  cache.put(key, JSON.stringify(identity), Math.min(secondsLeft, 21600)); // 6h is the hard cap
  return identity;
}

/** Unverified JWT payload, for the cheap pre-check only. Null if unparsable. */
function peekJwt(token) {
  var parts = String(token).split('.');
  if (parts.length !== 3) return null;
  try {
    var b64 = parts[1];
    while (b64.length % 4) b64 += '=';           // JWT strips padding
    var bytes = Utilities.base64DecodeWebSafe(b64);
    return JSON.parse(Utilities.newBlob(bytes).getDataAsString('UTF-8'));
  } catch (err) {
    return null;
  }
}

/** Upserts the profiles row; returns identity with `role` from the Sheet. */
function upsertProfile(identity) {
  var t = table('profiles');
  var rows = t.read();
  var now = new Date().toISOString();

  for (var i = 0; i < rows.length; i++) {
    if (rows[i].user_id === identity.sub) {
      t.update(rows[i]._row, {
        email: identity.email,
        name: identity.name || rows[i].name,
        picture: identity.picture || rows[i].picture,
        last_seen_at: now
      });
      identity.role = rows[i].role || 'user';
      return identity;
    }
  }

  t.appendAll([{
    user_id: identity.sub, email: identity.email, name: identity.name,
    picture: identity.picture, role: 'user', created_at: now, last_seen_at: now
  }]);
  identity.role = 'user';
  return identity;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

var ACTIONS = {

  /** Everything the client needs to merge against its localStorage copy. */
  'pull': function (user) {
    return {
      profile: { email: user.email, name: user.name, picture: user.picture, role: user.role },
      progress: mine(table('progress').read(), user).map(function (r) {
        return { item_id: r.item_id, reviewed_at: iso(r.reviewed_at) };
      }),
      notes: mine(table('notes').read(), user).map(function (r) {
        return { item_id: r.item_id, body: r.body, updated_at: iso(r.updated_at) };
      })
    };
  },

  /** Batched write. Idempotent per item_id, so a retry cannot duplicate. */
  'push': function (user, p) {
    var progress = asArray(p.progress), notes = asArray(p.notes), log = asArray(p.log);
    if (progress.length + notes.length + log.length > MAX_ROWS_PER_PUSH) {
      throw publicError('Request quá lớn (giới hạn ' + MAX_ROWS_PER_PUSH + ' dòng).');
    }

    return withLock(function () {
      var counts = { progress: 0, notes: 0, log: 0 };

      if (progress.length) {
        counts.progress = upsertByKey(table('progress'), user, progress, ['item_id'], function (r) {
          return { user_id: user.sub, item_id: String(r.item_id), reviewed_at: iso(r.reviewed_at) || nowIso() };
        });
      }
      if (notes.length) {
        counts.notes = upsertByKey(table('notes'), user, notes, ['item_id'], function (r) {
          return { user_id: user.sub, item_id: String(r.item_id), body: String(r.body || ''), updated_at: iso(r.updated_at) || nowIso() };
        });
      }
      if (log.length) {
        // Append-only: one row per open is the point, so never upsert.
        counts.log = log.length;
        table('study_log').appendAll(log.map(function (r) {
          return { user_id: user.sub, item_id: String(r.item_id), opened_at: iso(r.opened_at) || nowIso() };
        }));
      }
      return counts;
    });
  },

  /* ---- Fshare tool ------------------------------------------------- */

  /** History plus settings for one app, merged client-side with localStorage. */
  'fshare.pull': function (user, p) {
    var app = String((p && p.app) || 'fshare');
    return {
      history: mine(table('fshare_history').read(), user).map(function (r) {
        return { lc: r.linkcode, name: r.name, hits: Number(r.hits) || 1, at: iso(r.last_at) };
      }),
      config: mine(table('app_config').read(), user)
        .filter(function (r) { return String(r.app) === app; })
        .reduce(function (acc, r) { acc[r.key] = r.value; return acc; }, {})
    };
  },

  /**
   * Upsert both lists. Keyed on (user, linkcode) and (user, app, key), so a
   * retry updates in place instead of duplicating — same contract as 'push'.
   */
  'fshare.push': function (user, p) {
    var history = asArray(p && p.history);
    var config  = (p && p.config) || {};
    var app     = String((p && p.app) || 'fshare');

    var configRows = Object.keys(config).map(function (k) {
      return { app: app, key: String(k), value: String(config[k]) };
    });
    if (history.length + configRows.length > MAX_ROWS_PER_PUSH) {
      throw publicError('Request quá lớn (giới hạn ' + MAX_ROWS_PER_PUSH + ' dòng).');
    }

    return withLock(function () {
      var counts = { history: 0, config: 0 };

      if (history.length) {
        counts.history = upsertByKey(table('fshare_history'), user, history, ['linkcode'], function (r) {
          return {
            user_id: user.sub,
            linkcode: String(r.lc || ''),
            name: String(r.name || ''),
            hits: Number(r.hits) || 1,
            last_at: iso(r.at) || nowIso()
          };
        });
      }
      if (configRows.length) {
        counts.config = upsertByKey(table('app_config'), user, configRows, ['app', 'key'], function (r) {
          return {
            user_id: user.sub,
            app: r.app,
            key: r.key,
            value: r.value,
            updated_at: nowIso()
          };
        });
      }
      return counts;
    });
  },

  /* ---- Site search -------------------------------------------------- */

  /** Recent searches for this reader, merged client-side with local history. */
  'search.pull': function (user) {
    return {
      history: mine(table('search_history').read(), user).map(function (r) {
        return { q: r.q, hits: Number(r.hits) || 1, at: iso(r.last_at) };
      })
    };
  },

  /** Upsert by (user, q): searching the same thing twice updates one row. */
  'search.push': function (user, p) {
    var history = asArray(p && p.history);
    if (!history.length) return { history: 0 };
    if (history.length > MAX_ROWS_PER_PUSH) {
      throw publicError('Request quá lớn (giới hạn ' + MAX_ROWS_PER_PUSH + ' dòng).');
    }
    return withLock(function () {
      return {
        history: upsertByKey(table('search_history'), user, history, ['q'], function (r) {
          return {
            user_id: user.sub,
            // A query is free text; cap it so one paste cannot fill a cell.
            q: String(r.q || '').slice(0, 200),
            hits: Number(r.hits) || 1,
            last_at: iso(r.at) || nowIso()
          };
        })
      };
    });
  },

  /** Removes named queries, or the whole history when `all` is set. */
  'search.delete': function (user, p) {
    var all = Boolean(p && p.all);
    var wanted = {};
    asArray(p && p.queries).forEach(function (q) { wanted[String(q)] = 1; });
    if (!all && !Object.keys(wanted).length) throw publicError('Thiếu queries.');

    return withLock(function () {
      return {
        deleted: table('search_history').deleteWhere(function (r) {
          return String(r.user_id) === String(user.sub) && (all || wanted[String(r.q)] === 1);
        })
      };
    });
  },

  /* ---- Schedule access ----------------------------------------------- */

  /**
   * Hands the schedule passphrase to an account listed in `schedule_access`.
   *
   * The point is that the other people never see a passphrase: they sign in,
   * the page asks for the key, and it opens. Granting is one row in a Sheet,
   * the same gesture as setting a role in `profiles`.
   *
   * Revocation is SOFT and must be described that way. The key reaches the
   * browser to do its job, so anyone who has been granted could have kept a
   * copy of it. Deleting the row stops the page handing it over again; taking
   * it back for real means re-sealing the file under a new passphrase.
   */
  'schedule.key': function (user) {
    var key = PropertiesService.getScriptProperties().getProperty('SCHEDULE_KEY');
    if (!key) throw publicError('Chưa cấu hình SCHEDULE_KEY trong Script Properties.');
    if (!hasScheduleAccess(user)) throw publicError('Tài khoản này chưa được cấp quyền xem lịch riêng.');
    return { key: key };
  },

  /* ---- Schedule inbox ----------------------------------------------- */

  /**
   * Notes captured away from the repository, plus checklist tick state.
   *
   * Ticks reuse app_config rather than earning a sheet: they are one boolean
   * per entry id, they change several times a trip, and they are the only part
   * of the calendar that is state rather than content. The sealed file says
   * what belongs on a list; this says what has been done about it.
   */
  'schedule.list': function (user) {
    return {
      inbox: mine(table('schedule_inbox').read(), user).map(function (r) {
        return {
          id: r.id, body: r.body, category: r.category, due_hint: r.due_hint,
          status: r.status || 'pending', created_at: iso(r.created_at), updated_at: iso(r.updated_at)
        };
      }).sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); }),

      /* Not `mine()`: these rows belong to the cluster. An account without
         schedule access gets an empty map rather than an error, because the
         inbox beside it IS per-user and must still answer. */
      checks: !hasScheduleAccess(user) ? {} : table('app_config').read()
        .filter(function (r) {
          return String(r.user_id) === scheduleBucket()
            && String(r.app) === CALENDAR_APP
            && String(r.key).indexOf(CHECK_PREFIX) === 0;
        })
        .reduce(function (acc, r) {
          acc[String(r.key).slice(CHECK_PREFIX.length)] = { done: String(r.value) === '1', at: iso(r.updated_at) };
          return acc;
        }, {})
    };
  },

  /** One checklist entry. Keyed on (user, app, key), so ticking twice is one row. */
  'schedule.check': function (user, p) {
    var id = trim(p && p.id);
    if (!id) throw publicError('Thiếu id.');
    if (!hasScheduleAccess(user)) throw publicError('Tài khoản này chưa được cấp quyền xem lịch riêng.');
    return withLock(function () {
      upsertShared(table('app_config'), scheduleBucket(), ['app', 'key'], {
        user_id: scheduleBucket(),
        app: CALENDAR_APP,
        key: CHECK_PREFIX + id,
        value: p && p.done ? '1' : '0',
        updated_at: nowIso()
      });
      return { id: id, done: Boolean(p && p.done) };
    });
  },

  /** One note. The id is minted here so a retry cannot create a second row. */
  'schedule.add': function (user, p) {
    var body = trim(limitedString(p && p.body, 2000, 'Nội dung'));
    if (!body) throw publicError('Thiếu nội dung.');
    var row = {
      id: uuid(),
      user_id: user.sub,
      body: body,
      category: limitedString(p && p.category, 40, 'Nhóm'),
      due_hint: limitedString(p && p.due_hint, 60, 'Mốc thời gian'),
      status: 'pending',
      created_at: nowIso(),
      updated_at: nowIso()
    };
    return withLock(function () {
      table('schedule_inbox').appendAll([row]);
      return { id: row.id, created_at: row.created_at };
    });
  },

  /** Edit or mark merged. Only the caller's own rows are reachable. */
  'schedule.update': function (user, p) {
    var id = trim(p && p.id);
    if (!id) throw publicError('Thiếu id.');
    return withLock(function () {
      var t = table('schedule_inbox');
      var row = findBy(mine(t.read(), user), 'id', id);
      if (!row) throw publicError('Không tìm thấy ghi chú.');

      var fields = { updated_at: nowIso() };
      if (p.body !== undefined) fields.body = limitedString(p.body, 2000, 'Nội dung');
      if (p.category !== undefined) fields.category = limitedString(p.category, 40, 'Nhóm');
      if (p.due_hint !== undefined) fields.due_hint = limitedString(p.due_hint, 60, 'Mốc thời gian');
      if (p.status !== undefined) {
        var status = trim(p.status);
        if (status !== 'pending' && status !== 'merged') throw publicError('Trạng thái không hợp lệ.');
        fields.status = status;
      }
      t.update(row._row, fields);
      return { id: id };
    });
  },

  'schedule.delete': function (user, p) {
    var all = Boolean(p && p.all);
    var mergedOnly = Boolean(p && p.merged);
    var id = trim(p && p.id);
    if (!all && !mergedOnly && !id) throw publicError('Thiếu id.');

    return withLock(function () {
      return {
        deleted: table('schedule_inbox').deleteWhere(function (r) {
          if (String(r.user_id) !== String(user.sub)) return false;
          if (all) return true;
          if (mergedOnly) return String(r.status) === 'merged';
          return String(r.id) === id;
        })
      };
    });
  },

  /** Feeds the streak and heatmap in the stats view. */
  'studyLog': function (user) {
    return {
      log: mine(table('study_log').read(), user).map(function (r) {
        return { item_id: r.item_id, opened_at: iso(r.opened_at) };
      })
    };
  },

  /** Companies with their questions nested, so the view needs one call. */
  'interviews.list': function (user) {
    var qs = mine(table('interview_questions').read(), user);
    var bySet = {};
    qs.sort(bySort).forEach(function (q) {
      var key = String(q.interview_id) + '|' + String(q.question_set_id || '');
      (bySet[key] = bySet[key] || []).push({
        id: q.id, round: q.round, q: q.q, a: q.a, note: q.note,
        diagrams: parseStoredDiagrams(q.diagrams_json)
      });
    });

    return {
      companies: mine(table('interviews').read(), user).sort(bySort).map(function (r) {
        var key = String(r.id) + '|' + String(r.active_question_set || '');
        return {
          id: r.id, name: r.name, role: r.role, date: r.happened_on, result: r.result || 'pending',
          stack: String(r.stack || '').split(',').map(trim).filter(Boolean),
          sort_order: Number(r.sort_order) || 0,
          created_at: iso(r.created_at).slice(0, 10),
          updated_at: iso(r.updated_at).slice(0, 10),
          references: parseStoredReferences(r.references_json),
          jd: String(r.jd || ''), brief: String(r.brief || ''),
          rounds: parseStoredRounds(r.rounds_json),
          questions: bySet[key] || []
        };
      })
    };
  },

  /** One company plus all its questions in a single round-trip. */
  'interviews.save': function (user, p) {
    var c = p.company || {};
    if (!String(c.name || '').trim()) throw publicError('Tên công ty không được để trống.');
    var referencesJson = JSON.stringify(normalizeReferences(c.references));
    if (referencesJson.length > 24000) throw publicError('Danh sách tài liệu vượt giới hạn 24.000 ký tự.');
    var roundsJson = JSON.stringify(normalizeRounds(c.rounds));
    if (roundsJson.length > 24000) throw publicError('Danh sách vòng phỏng vấn vượt giới hạn 24.000 ký tự.');
    var jd = limitedString(c.jd, 20000, 'JD');
    var brief = limitedString(c.brief, 10000, 'Tóm tắt quy trình');
    var questions = asArray(c.questions);
    if (questions.length > 200) throw publicError('Tối đa 200 câu hỏi cho một công ty.');
    // Validate and serialize everything before touching the Sheet. A rejected
    // diagram must never arrive after the old question set has been deleted.
    var prepared = questions.map(function (q, i) {
      var diagramsJson = JSON.stringify(normalizeDiagrams(q.diagrams));
      if (diagramsJson.length > 40000) throw publicError('Diagram của một câu hỏi vượt giới hạn 40.000 ký tự.');
      return {
        round: limitedString(q.round, 200, 'Round'),
        q: limitedString(q.q, 10000, 'Câu hỏi'),
        a: limitedString(q.a, 40000, 'Câu trả lời'),
        note: limitedString(q.note, 10000, 'Takeaway'),
        diagrams_json: diagramsJson,
        sort_order: i
      };
    });

    return withLock(function () {
      var t = table('interviews');
      var rows = mine(t.read(), user);
      var existing = c.id ? findBy(rows, 'id', c.id) : null;
      var id = existing ? existing.id : uuid();
      var questionSetId = uuid();

      var fields = {
        id: id, user_id: user.sub,
        name: String(c.name).trim(),
        role: String(c.role || ''),
        happened_on: String(c.date || ''),
        result: ['pending', 'passed', 'offer', 'failed'].indexOf(c.result) >= 0 ? c.result : 'pending',
        stack: asArray(c.stack).map(trim).filter(Boolean).join(', '),
        sort_order: Number(c.sort_order) || 0,
        updated_at: nowIso(),
        active_question_set: questionSetId,
        references_json: referencesJson,
        jd: jd, brief: brief, rounds_json: roundsJson
      };

      // Append the complete replacement first. The company row is the commit
      // pointer: until it switches active_question_set, readers keep seeing the
      // old complete set. A failed append can therefore leave only an orphan,
      // never a half-empty interview.
      var qt = table('interview_questions');
      qt.appendAll(prepared.map(function (q) {
        return extend({ id: uuid(), interview_id: id, user_id: user.sub, question_set_id: questionSetId }, q);
      }));

      if (existing) t.update(existing._row, fields);
      else t.appendAll([extend(fields, { created_at: nowIso() })]);

      // Cleanup is best-effort after activation. If it fails, list() ignores
      // inactive sets and a later save/delete can remove them safely.
      try {
        qt.deleteWhere(function (r) {
          return r.user_id === user.sub && r.interview_id === id && String(r.question_set_id || '') !== questionSetId;
        });
      } catch (cleanupErr) {}
      return { id: id };
    });
  },

  'interviews.delete': function (user, p) {
    var id = String(p.id || '');
    if (!id) throw publicError('Thiếu id.');
    return withLock(function () {
      var n = table('interviews').deleteWhere(function (r) { return r.user_id === user.sub && r.id === id; });
      table('interview_questions').deleteWhere(function (r) { return r.user_id === user.sub && r.interview_id === id; });
      return { deleted: n };
    });
  },

  /** Admin-only; hiding the menu client-side is cosmetic, this is the gate. */
  'admin.overview': function (user) {
    if (user.role !== 'admin') throw publicError('Không được phép: cần quyền admin.');

    var count = function (rows, pred) {
      var m = {};
      rows.forEach(function (r) {
        if (pred && !pred(r)) return;
        m[r.user_id] = (m[r.user_id] || 0) + 1;
      });
      return m;
    };
    var progress = count(table('progress').read());
    var notes = count(table('notes').read(), function (r) { return String(r.body || '').length > 0; });
    var interviews = count(table('interviews').read());
    var logRows = table('study_log').read();
    var opens = count(logRows);

    var lastSeen = {}, days = {};
    logRows.forEach(function (r) {
      var at = iso(r.opened_at);
      if (!at) return;
      if (!lastSeen[r.user_id] || at > lastSeen[r.user_id]) lastSeen[r.user_id] = at;
      (days[r.user_id] = days[r.user_id] || {})[at.slice(0, 10)] = 1;
    });

    return {
      users: table('profiles').read().map(function (p) {
        return {
          user_id: p.user_id, email: p.email, name: p.name, picture: p.picture,
          role: p.role || 'user',
          created_at: iso(p.created_at), last_seen_at: iso(p.last_seen_at),
          reviewed_count: progress[p.user_id] || 0,
          note_count: notes[p.user_id] || 0,
          interview_count: interviews[p.user_id] || 0,
          open_count: opens[p.user_id] || 0,
          active_days: Object.keys(days[p.user_id] || {}).length,
          last_activity: lastSeen[p.user_id] || ''
        };
      }).sort(function (a, b) { return (b.last_activity || '').localeCompare(a.last_activity || ''); })
    };
  }
};

/* ------------------------------------------------------------------ */
/* Sheet-as-table helper                                               */
/* ------------------------------------------------------------------ */

/**
 * Table-shaped wrapper over a sheet. Everything reads and writes in one
 * batch: each Spreadsheet API call is a round-trip, and per-cell access is
 * what makes Apps Script slow.
 */
/**
 * True when this account may be handed the schedule passphrase.
 *
 * An admin always may — otherwise the owner could lock themselves out of their
 * own file by clearing the sheet. Everyone else needs a row, matched on the
 * verified token's email, lowercased so a stray capital does not silently deny
 * someone who was granted.
 */
function hasScheduleAccess(user) {
  if (user.role === 'admin') return true;
  var email = trim(user.email).toLowerCase();
  if (!email) return false;
  var rows = table('schedule_access').read();
  for (var i = 0; i < rows.length; i++) {
    if (trim(rows[i].email).toLowerCase() === email) return true;
  }
  return false;
}

function table(name) {
  var headers = SHEETS[name];
  if (!headers) throw new Error('Sheet chưa khai báo: ' + name);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // Plain text for timestamps: otherwise Sheets parses the ISO string into
    // a Date, hands back an object, and the note merge compares wrong.
    headers.forEach(function (h, i) {
      if (/_at$/.test(h)) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  } else {
    // Schema changes are append-only. Fill newly declared trailing headers so
    // an existing deployment can adopt them without recreating the Sheet.
    var width = Math.max(sh.getLastColumn(), 1);
    var actual = sh.getRange(1, 1, 1, width).getValues()[0];
    for (var h = 0; h < headers.length; h++) {
      var found = String(actual[h] || '');
      if (found && found !== headers[h]) throw new Error('Header không khớp ở sheet ' + name + ': ' + found);
      if (!found) sh.getRange(1, h + 1).setValue(headers[h]).setFontWeight('bold');
    }
  }

  var api = {
    sheet: sh,
    headers: headers,

    /** Rows as objects; _row is the real sheet row, needed by update(). */
    read: function () {
      var last = sh.getLastRow();
      if (last < 2) return [];
      var values = sh.getRange(2, 1, last - 1, headers.length).getValues();
      var out = [];
      for (var i = 0; i < values.length; i++) {
        if (String(values[i][0] || '') === '') continue;      // blank row
        var o = { _row: i + 2 };
        for (var c = 0; c < headers.length; c++) o[headers[c]] = values[i][c];
        out.push(o);
      }
      return out;
    },

    /** Partial update: only headers present in `fields` are touched. */
    update: function (row, fields) {
      var cur = sh.getRange(row, 1, 1, headers.length).getValues()[0];
      for (var c = 0; c < headers.length; c++) {
        if (Object.prototype.hasOwnProperty.call(fields, headers[c])) cur[c] = fields[headers[c]];
      }
      sh.getRange(row, 1, 1, headers.length).setValues([cur]);
    },

    /** Many rows in a single setValues. */
    appendAll: function (objs) {
      if (!objs || !objs.length) return 0;
      var block = objs.map(function (o) {
        return headers.map(function (h) { return o[h] === undefined || o[h] === null ? '' : o[h]; });
      });
      sh.getRange(sh.getLastRow() + 1, 1, block.length, headers.length).setValues(block);
      return block.length;
    },

    /** Deletes bottom-up, otherwise each removal shifts the rows below. */
    deleteWhere: function (pred) {
      var rows = api.read().filter(pred).map(function (r) { return r._row; });
      rows.sort(function (a, b) { return b - a; });
      rows.forEach(function (r) { sh.deleteRow(r); });
      return rows.length;
    }
  };
  return api;
}

/** Existing rows updated in place, new ones batched into one append. */
function upsertByKey(t, user, incoming, keyFields, mapRow) {
  var existing = {};
  mine(t.read(), user).forEach(function (r) { existing[keyOf(r, keyFields)] = r; });

  var toAppend = [], seen = {}, n = 0;
  incoming.forEach(function (raw) {
    var row = mapRow(raw);
    var k = keyOf(row, keyFields);
    if (!k || seen[k]) return;                 // duplicate in batch: keep the first
    seen[k] = 1;
    n++;
    if (existing[k]) t.update(existing[k]._row, row);
    else toAppend.push(row);
  });
  t.appendAll(toAppend);
  return n;
}

/** '|' is safe as a separator: item_ids look like '01-java-core-jvm.memory-execution-model.q1' — hyphens and dots, never '|'. */
function keyOf(row, fields) {
  return fields.map(function (f) { return String(row[f] == null ? '' : row[f]); }).join('|');
}

/**
 * One row in a shared bucket, keyed the way `upsertByKey` keys a personal one.
 * Deliberately separate: `upsertByKey` is built on `mine()`, and `mine()` is
 * the ownership boundary — widening it to take a bucket would put "whose row is
 * this" behind a parameter on every caller in the file.
 */
function upsertShared(t, bucket, keyFields, row) {
  var k = keyOf(row, keyFields);
  var rows = t.read();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].user_id) !== String(bucket)) continue;
    if (keyOf(rows[i], keyFields) === k) { t.update(rows[i]._row, row); return 1; }
  }
  t.appendAll([row]);
  return 1;
}

/** Every read must pass through here — this is the ownership boundary. */
function mine(rows, user) {
  return rows.filter(function (r) { return String(r.user_id) === String(user.sub); });
}

function findBy(rows, field, val) {
  for (var i = 0; i < rows.length; i++) if (String(rows[i][field]) === String(val)) return rows[i];
  return null;
}

/** Concurrent requests would otherwise clobber each other's rows. */
function withLock(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw publicError('Server đang bận, thử lại sau.');
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ------------------------------------------------------------------ */
/* Small utilities                                                     */
/* ------------------------------------------------------------------ */

function asArray(v) { return Array.isArray(v) ? v : []; }
function limitedString(v, max, label) {
  var value = String(v == null ? '' : v);
  if (value.length > max) throw publicError(label + ' vượt giới hạn ' + max + ' ký tự.');
  return value;
}
function normalizeDiagramList(v, label) {
  var rows = asArray(v);
  if (rows.length > 20) throw publicError(label + ' có tối đa 20 dòng.');
  return rows.map(function (row) { return limitedString(row, 1000, label); });
}
function normalizeDiagrams(v) {
  var rows = asArray(v);
  if (rows.length > 10) throw publicError('Mỗi câu hỏi có tối đa 10 diagram.');
  return rows.map(function (raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw publicError('Diagram không đúng cấu trúc.');
    var mermaid = limitedString(raw.mermaid, 12000, 'Mermaid source');
    if (!/^(?:flowchart\s+(?:LR|RL|TB|BT|TD)|sequenceDiagram|stateDiagram-v2)\n/.test(mermaid)) {
      throw publicError('Chỉ hỗ trợ flowchart, sequenceDiagram và stateDiagram-v2.');
    }
    if (/%%\{|<\/?(?:script|iframe)|javascript:/i.test(mermaid)) throw publicError('Mermaid source chứa directive không được hỗ trợ.');
    return {
      phase: limitedString(raw.phase, 120, 'Diagram phase'),
      title: limitedString(raw.title, 240, 'Diagram title'),
      mermaid: mermaid,
      flaws: normalizeDiagramList(raw.flaws, 'Lỗ hổng'),
      upgrades: normalizeDiagramList(raw.upgrades, 'Nâng cấp')
    };
  });
}
function parseStoredDiagrams(v) {
  if (!v) return [];
  try {
    var parsed = JSON.parse(String(v));
    return normalizeDiagrams(parsed);
  } catch (err) { return []; }
}
function normalizeReferences(v) {
  var rows = asArray(v);
  if (rows.length > 20) throw publicError('Tối đa 20 tài liệu tham khảo.');
  return rows.map(function (raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw publicError('Tài liệu tham khảo không đúng cấu trúc.');
    var url = limitedString(raw.url, 2000, 'Reference URL').trim();
    if (!/^https:\/\//i.test(url)) throw publicError('Reference URL phải dùng HTTPS.');
    return {
      label: limitedString(raw.label, 240, 'Reference label').trim(),
      url: url
    };
  });
}
/** The interview loop: an ordered list of {name, note}. Structured rather than
 *  prose because the view counts them ("3 rounds") next to the question count. */
function normalizeRounds(v) {
  var rows = asArray(v);
  if (rows.length > 20) throw publicError('Tối đa 20 vòng phỏng vấn.');
  return rows.map(function (raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw publicError('Vòng phỏng vấn không đúng cấu trúc.');
    return {
      name: limitedString(raw.name, 200, 'Tên vòng').trim(),
      note: limitedString(raw.note, 4000, 'Mô tả vòng').trim()
    };
  }).filter(function (row) { return row.name || row.note; });
}
function parseStoredRounds(v) {
  if (!v) return [];
  try { return normalizeRounds(JSON.parse(String(v))); }
  catch (err) { return []; }
}
function parseStoredReferences(v) {
  if (!v) return [];
  try { return normalizeReferences(JSON.parse(String(v))); }
  catch (err) { return []; }
}
function trim(s) { return String(s == null ? '' : s).trim(); }
function nowIso() { return new Date().toISOString(); }
function extend(a, b) { for (var k in b) a[k] = b[k]; return a; }
function bySort(a, b) { return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0); }
function uuid() { return Utilities.getUuid(); }

/** Sheets may hand back a Date; the client compares these as strings. */
function iso(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}
