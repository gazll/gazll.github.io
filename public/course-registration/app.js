const NTT_ORIGIN = 'https://phongdaotao.ntt.edu.vn';
const COURSE_LIST_PATH = '/SinhVienDangKy/MonHocPhanChoDangKy';
const REGISTERED_PATH = '/SinhVienDangKy/HocPhanDaDangKy';
const LIST_PATH = '/SinhVienDangKy/LopHocPhanChoDangKy';
const DETAIL_PATH = '/SinhVienDangKy/ChiTietLopHocPhanChoDangKy';

const elements = {
  badge: document.getElementById('connectionBadge'),
  bookmarklet: document.getElementById('bookmarklet'),
  copyBridge: document.getElementById('copyBridge'),
  form: document.getElementById('queryForm'),
  loadCourses: document.getElementById('loadCoursesButton'),
  coursePicker: document.getElementById('coursePicker'),
  coursePickerStatus: document.getElementById('coursePickerStatus'),
  run: document.getElementById('runButton'),
  stop: document.getElementById('stopButton'),
  retry: document.getElementById('retryButton'),
  export: document.getElementById('exportButton'),
  progressCard: document.getElementById('progressCard'),
  progressTitle: document.getElementById('progressTitle'),
  progressDetail: document.getElementById('progressDetail'),
  progressBar: document.getElementById('progressBar'),
  summary: document.getElementById('summary'),
  registeredSection: document.getElementById('registeredSection'),
  registeredCount: document.getElementById('registeredCount'),
  registeredContent: document.getElementById('registeredContent'),
  results: document.getElementById('results'),
  toast: document.getElementById('toast')
};

let bridgeChannel = new URLSearchParams(location.hash.slice(1)).get('bridge') || '';
let connected = false;
let lastBridgeAck = 0;
let running = false;
let stopped = false;
let result = null;
let courseCatalog = { tables: [], rowCount: 0, courses: [], message: '', error: '' };
let toastTimer = 0;
const pending = new Map();

if (bridgeChannel) history.replaceState(null, '', location.pathname + location.search);

function bridgeBootstrap(appUrl) {
  const nttOrigin = 'https://phongdaotao.ntt.edu.vn';
  const allowedPaths = new Set([
    '/SinhVienDangKy/MonHocPhanChoDangKy',
    '/SinhVienDangKy/HocPhanDaDangKy',
    '/SinhVienDangKy/LopHocPhanChoDangKy',
    '/SinhVienDangKy/ChiTietLopHocPhanChoDangKy'
  ]);
  if (location.origin !== nttOrigin) {
    alert('Open the NTT course registration page before using this bookmark.');
    return;
  }

  const target = new URL(appUrl);
  const appOrigin = target.origin;
  const channel = crypto.randomUUID();
  target.hash = 'bridge=' + encodeURIComponent(channel);
  const popup = window.open(target.href, 'ntt-course-registration');
  if (!popup) {
    alert('Allow pop-ups for this page, then click the bookmark again.');
    return;
  }

  const send = payload => popup.postMessage({ ...payload, channel }, appOrigin);
  const onMessage = async event => {
    const message = event.data;
    if (event.origin !== appOrigin || event.source !== popup ||
        !message || message.channel !== channel) return;

    if (message.type === 'ntt-course:hello') {
      send({ type: 'ntt-course:ack' });
      return;
    }
    if (message.type !== 'ntt-course:request') return;

    if (!allowedPaths.has(message.path) || typeof message.body !== 'string' ||
        message.body.length > 20000) {
      send({ type: 'ntt-course:response', id: message.id, error: 'Request rejected by the bridge.' });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(message.path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'text/html, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: message.body,
        signal: controller.signal
      });
      const html = await response.text();
      send({
        type: 'ntt-course:response',
        id: message.id,
        ok: response.ok,
        status: response.status,
        retryAfter: response.headers.get('Retry-After') || '',
        html
      });
    } catch (error) {
      send({
        type: 'ntt-course:response',
        id: message.id,
        error: error && error.name === 'AbortError' ? 'NTT request timed out.' : 'NTT network request failed.'
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  addEventListener('message', onMessage);
  const closeWatch = setInterval(() => {
    if (!popup.closed) return;
    clearInterval(closeWatch);
    removeEventListener('message', onMessage);
  }, 2000);
}

function appDirectoryUrl() {
  const url = new URL('.', location.href);
  url.search = '';
  url.hash = '';
  return url.href;
}

const bridgeScript = `javascript:(${bridgeBootstrap.toString()})(${JSON.stringify(appDirectoryUrl())})`;
elements.bookmarklet.href = bridgeScript;
elements.bookmarklet.addEventListener('click', event => {
  event.preventDefault();
  showToast('Drag this button to the bookmarks bar, then use it on the NTT page.');
});

elements.copyBridge.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(bridgeScript);
    showToast('Bridge script copied. Save it as a browser bookmark URL.');
  } catch {
    showToast('Clipboard access was blocked. Drag the bookmark button instead.');
  }
});

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 2800);
}

function setConnected(value) {
  connected = value;
  elements.badge.textContent = value ? 'NTT bridge connected' : 'Bridge disconnected';
  elements.badge.className = `badge ${value ? 'on' : 'off'}`;
}

function sendHello() {
  if (!bridgeChannel || !window.opener || window.opener.closed) {
    setConnected(false);
    return;
  }
  window.opener.postMessage({ type: 'ntt-course:hello', channel: bridgeChannel }, NTT_ORIGIN);
}

addEventListener('message', event => {
  const message = event.data;
  if (event.origin !== NTT_ORIGIN || event.source !== window.opener ||
      !message || message.channel !== bridgeChannel) return;

  if (message.type === 'ntt-course:ack') {
    lastBridgeAck = Date.now();
    setConnected(true);
    return;
  }
  if (message.type !== 'ntt-course:response') return;

  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  clearTimeout(request.timeout);
  if (message.error) request.reject(new Error(message.error));
  else request.resolve(message);
});

sendHello();
setInterval(() => {
  if (connected && Date.now() - lastBridgeAck > 12000) setConnected(false);
  sendHello();
}, 5000);

function bridgeRequest(path, fields) {
  if (!connected || !window.opener || window.opener.closed) {
    return Promise.reject(new Error('NTT bridge is not connected.'));
  }

  const id = crypto.randomUUID();
  const body = new URLSearchParams();
  Object.entries(fields).forEach(([key, value]) => body.set(`param[${key}]`, String(value)));

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error('The NTT bridge did not respond in time.'));
    }, 52000);
    pending.set(id, { resolve, reject, timeout });
    window.opener.postMessage({
      type: 'ntt-course:request',
      channel: bridgeChannel,
      id,
      path,
      body: body.toString()
    }, NTT_ORIGIN);
  });
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function retryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryDelay(response, attempt) {
  if (response && response.retryAfter) {
    const seconds = Number(response.retryAfter);
    const milliseconds = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(response.retryAfter) - Date.now();
    if (Number.isFinite(milliseconds) && milliseconds > 0) {
      return Math.min(milliseconds, 30000);
    }
  }
  return Math.min(1000 * 2 ** (attempt - 1) + Math.random() * 800, 30000);
}

function looksLikeLogin(html) {
  return /type=["']password["']/i.test(html) ||
    /(?:dang[- ]?nhap|đăng nhập|login)/i.test(html.slice(0, 2500));
}

async function requestHtml(path, fields, maxAttempts, label) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (stopped) throw new Error('Crawl stopped.');
    let response;
    try {
      response = await bridgeRequest(path, fields);
      if (response.ok) {
        if (looksLikeLogin(response.html)) {
          const authError = new Error('The NTT session has expired. Sign in again and reconnect the bridge.');
          authError.permanent = true;
          authError.fatal = true;
          throw authError;
        }
        return response.html;
      }
      if (!retryableStatus(response.status)) {
        const httpError = new Error(`${label}: HTTP ${response.status}`);
        httpError.permanent = true;
        throw httpError;
      }
      lastError = new Error(`${label}: HTTP ${response.status}`);
    } catch (error) {
      if (error.permanent || error.message === 'Crawl stopped.') throw error;
      lastError = error;
    }

    if (attempt === maxAttempts) break;
    const delay = retryDelay(response, attempt);
    setProgress('Retrying temporary error', `${label} · attempt ${attempt + 1}/${maxAttempts} in ${Math.ceil(delay / 1000)}s`);
    await sleep(delay);
  }
  throw new Error(`${lastError ? lastError.message : label} after ${maxAttempts} attempts`);
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseHtml(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

function directCells(row) {
  return [...row.querySelectorAll(':scope > th, :scope > td')]
    .map(cell => cleanText(cell.textContent))
    .filter(Boolean);
}

function parseTables(document_) {
  return [...document_.querySelectorAll('table')]
    .filter(table => !table.parentElement.closest('table'))
    .map(table => {
      const rows = [...table.querySelectorAll('tr')]
        .filter(row => row.closest('table') === table);
      const headerRow = rows.find(row => row.querySelector(':scope > th'));
      const headers = headerRow ? directCells(headerRow) : [];
      const dataRows = rows
        .filter(row => row.querySelector(':scope > td'))
        .map(directCells)
        .filter(cells => cells.length);
      return { headers, rows: dataRows };
    })
    .filter(table => table.rows.length);
}

function parseRegistered(html) {
  const document_ = parseHtml(html);
  const tables = parseTables(document_);
  const rowCount = tables.reduce((total, table) => total + table.rows.length, 0);
  return {
    tables,
    rowCount,
    message: rowCount ? '' : cleanText(document_.body.textContent).slice(0, 500),
    error: ''
  };
}

function courseAttributes(element) {
  return [element, ...element.querySelectorAll('*')].flatMap(node_ =>
    [...node_.attributes]
      .filter(attribute => attribute.name.startsWith('data-') || attribute.name === 'onclick')
      .map(attribute => ({ name: attribute.name.toLowerCase(), value: attribute.value }))
  );
}

function parseCourseList(html) {
  const document_ = parseHtml(html);
  const tables = parseTables(document_);
  const candidates = [...document_.querySelectorAll('tr')]
    .filter(row => row.querySelector('td'));
  if (!candidates.length) {
    candidates.push(...document_.querySelectorAll('li, [data-mamonhoc], [data-mamh]'));
  }

  const coursesByCode = new Map();
  candidates.forEach(element => {
    const cells = element.matches('tr')
      ? directCells(element)
      : [cleanText(element.textContent)].filter(Boolean);
    const text = cells.join(' | ');
    const attributes = courseAttributes(element);
    const namedCode = attributes.find(attribute =>
      /(?:ma[-_]?mon(?:hoc)?|mamh|course[-_]?code)/i.test(attribute.name) &&
      /\b\d{6}\b/.test(attribute.value)
    );
    const attributeText = attributes.map(attribute => `${attribute.name}=${attribute.value}`).join(' ');
    const codeMatch = (namedCode ? namedCode.value : attributeText).match(/\b\d{6}\b/) ||
      text.match(/\b\d{6}\b/);
    if (!codeMatch) return;

    const code = codeMatch[0];
    const eligibleCodes = [...new Set(
      [...`${attributeText} ${text}`.matchAll(/\b\d{10}\b/g)].map(match => match[0])
    )];
    const parentAttribute = attributes.find(attribute => /ma[-_]?mon[-_]?cha/i.test(attribute.name));
    const course = {
      code,
      name: text,
      eligibleCodes,
      parentCourse: parentAttribute ? cleanText(parentAttribute.value) : '',
      row: cells
    };
    const previous = coursesByCode.get(code);
    if (!previous || course.eligibleCodes.length > previous.eligibleCodes.length) {
      coursesByCode.set(code, course);
    }
  });

  const courses = [...coursesByCode.values()];
  return {
    tables,
    rowCount: tables.reduce((total, table) => total + table.rows.length, 0),
    courses,
    message: courses.length ? '' : cleanText(document_.body.textContent).slice(0, 500),
    error: ''
  };
}

function parseClassSummary(cells) {
  const description = cells[1] || cells.join(' ');
  const codes = description.match(/Mã lớp học phần:\s*([^\s]+)\s*-\s*([^\s]+)/i);
  const status = description.match(/Trạng thái:\s*(.*?)\s*(?=Mã lớp học phần:|$)/i);
  const capacityText = cells.at(-1) || '';
  const capacity = capacityText.match(/(\d+)\s*\/\s*(\d+)/);
  return {
    courseName: cleanText(description.split(/Trạng thái:/i)[0]),
    classCode: codes ? codes[1] : '',
    cohort: codes ? codes[2] : '',
    status: status ? cleanText(status[1]) : '',
    enrolled: capacity ? Number(capacity[1]) : null,
    capacity: capacity ? Number(capacity[2]) : null
  };
}

function parseClasses(html) {
  const document_ = parseHtml(html);
  const seen = new Set();
  return [...document_.querySelectorAll('[data-guidlhp]')].map(element => {
    const guid = cleanText(element.getAttribute('data-guidlhp'));
    if (!guid || seen.has(guid)) return null;
    seen.add(guid);
    const row = element.closest('tr');
    const listRow = row ? directCells(row) : [cleanText(element.textContent)];
    return {
      guid,
      listRow,
      ...parseClassSummary(listRow),
      teachers: [],
      sessions: [],
      detailRows: [],
      error: ''
    };
  }).filter(Boolean);
}

function parseSchedule(value) {
  const text = cleanText(value);
  const match = text.match(/^Lịch học:\s*(\S+)\s*-\s*(.*?)\s*\(Tiết\s*(\d+)\s*(?:->|→)\s*(\d+)\s*\)\s*Cơ sở:\s*(.*?)\s*Dãy nhà:\s*(.*?)\s*Phòng:\s*(.*)$/i);
  if (!match) return { rawSchedule: text };
  return {
    type: match[1],
    day: cleanText(match[2]),
    periodStart: Number(match[3]),
    periodEnd: Number(match[4]),
    campus: cleanText(match[5]),
    building: cleanText(match[6]),
    room: cleanText(match[7])
  };
}

function parseLecturer(value) {
  const text = cleanText(value);
  const match = text.match(/^GV:\s*(.*?)\s+(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})(?:\s*Sĩ số:\s*(\d+)\s*\/\s*(\d+))?$/i);
  if (!match) return { teacher: text.replace(/^GV:\s*/i, '') };
  return {
    teacher: cleanText(match[1]),
    startDate: match[2],
    endDate: match[3],
    enrolled: match[4] === undefined ? null : Number(match[4]),
    capacity: match[5] === undefined ? null : Number(match[5])
  };
}

function parseDetail(html) {
  const document_ = parseHtml(html);
  const detailRows = [...document_.querySelectorAll('tr')]
    .map(directCells)
    .filter(cells => cells.length);
  const sessions = [];

  detailRows.forEach(cells => {
    const scheduleCell = cells.find(cell => /^Lịch học:/i.test(cell));
    const lecturerCell = cells.find(cell => /^GV:/i.test(cell));
    if (!scheduleCell && !lecturerCell) return;
    const group = cells.find(cell => /^\d+$/.test(cell));
    sessions.push({
      ...(scheduleCell ? parseSchedule(scheduleCell) : {}),
      group: group || '',
      ...(lecturerCell ? parseLecturer(lecturerCell) : {})
    });
  });

  const teachers = [...new Set(sessions.map(session => session.teacher).filter(Boolean))];
  return { detailRows, sessions, teachers };
}

function readQuery() {
  return {
    periodId: document.getElementById('periodId').value.trim(),
    courseCode: document.getElementById('courseCode').value.trim(),
    eligibleCodes: document.getElementById('eligibleCodes').value.trim(),
    registrationType: document.getElementById('registrationType').value.trim(),
    parentCourse: document.getElementById('parentCourse').value.trim(),
    avoidConflicts: document.getElementById('avoidConflicts').checked,
    concurrency: Number(document.getElementById('concurrency').value),
    maxAttempts: Number(document.getElementById('maxAttempts').value)
  };
}

function listFields(query) {
  return {
    IDDotDangKy: query.periodId,
    MaMonHoc: query.courseCode,
    DSHocPhanDuocHoc: query.eligibleCodes,
    IsLHPKhongTrungLich: query.avoidConflicts,
    LoaiDKHP: query.registrationType,
    MaMonCha: query.parentCourse
  };
}

function courseListFields(query) {
  return { IDDotDangKy: query.periodId, IDLoaiDangKy: query.registrationType };
}

function registeredFields(query) {
  return { IDDotDangKy: query.periodId, IDLoaiDangKy: query.registrationType };
}

function detailFields(query, guid) {
  return { GuidIDLopHocPhan: guid, MaMonCha: query.parentCourse };
}

function setRunning(value) {
  running = value;
  elements.run.disabled = value;
  elements.loadCourses.disabled = value;
  elements.stop.disabled = !value;
  elements.retry.disabled = value;
}

function setProgress(title, detail, current = null, total = null) {
  elements.progressCard.hidden = false;
  elements.progressTitle.textContent = title;
  elements.progressDetail.textContent = detail || '';
  if (current !== null && total !== null) {
    elements.progressBar.style.width = total
      ? `${Math.round(current / total * 100)}%`
      : '100%';
  }
}

function courseLabel(course) {
  const cleanedName = course.name
    .replace(new RegExp(`(^|\\s)${course.code}(\\s|$)`), ' ')
    .replace(/\s*\|\s*/g, ' · ')
    .trim();
  return cleanedName ? `${course.code} — ${cleanedName}` : course.code;
}

function populateCoursePicker(catalog, selectedCode = '') {
  const placeholder = node(
    'option',
    '',
    catalog.courses.length ? 'Select an available course' : 'No course could be parsed'
  );
  placeholder.value = '';
  const options = catalog.courses.map(course => {
    const option = node('option', '', courseLabel(course));
    option.value = course.code;
    return option;
  });
  elements.coursePicker.replaceChildren(placeholder, ...options);
  elements.coursePicker.disabled = catalog.courses.length === 0;
  elements.coursePicker.value = catalog.courses.some(course => course.code === selectedCode)
    ? selectedCode
    : '';
  elements.coursePickerStatus.textContent = catalog.error
    ? catalog.error
    : `${catalog.courses.length} courses found`;
}

function applyCourse(course, query = null) {
  if (!course) return;
  document.getElementById('courseCode').value = course.code;
  if (course.eligibleCodes.length) {
    document.getElementById('eligibleCodes').value = course.eligibleCodes.join(',');
  } else if (!query) {
    document.getElementById('eligibleCodes').value = '';
  }
  if (course.parentCourse) {
    document.getElementById('parentCourse').value = course.parentCourse;
  } else if (!query) {
    document.getElementById('parentCourse').value = '';
  }
  if (query) {
    query.courseCode = course.code;
    if (course.eligibleCodes.length) query.eligibleCodes = course.eligibleCodes.join(',');
    if (course.parentCourse) query.parentCourse = course.parentCourse;
  }
}

async function fetchCourseCatalog(query) {
  const html = await requestHtml(
    COURSE_LIST_PATH,
    courseListFields(query),
    query.maxAttempts,
    'Available courses'
  );
  return parseCourseList(html);
}

async function loadCoursePicker() {
  if (running) return;
  if (!connected) {
    showToast('Connect the NTT bridge before loading courses.');
    return;
  }
  const query = readQuery();
  stopped = false;
  setRunning(true);
  elements.loadCourses.disabled = true;
  try {
    setProgress('Loading available courses', 'Requesting courses waiting for registration');
    courseCatalog = await fetchCourseCatalog(query);
    populateCoursePicker(courseCatalog, query.courseCode);
    setProgress('Available courses loaded', `${courseCatalog.courses.length} courses found`);
    if (result) {
      result.availableCourses = courseCatalog;
      renderResult();
    }
  } catch (error) {
    courseCatalog = { tables: [], rowCount: 0, courses: [], message: '', error: error.message };
    populateCoursePicker(courseCatalog);
    setProgress('Unable to load available courses', error.message);
  } finally {
    elements.loadCourses.disabled = false;
    setRunning(false);
  }
}

async function loadDetails(classes, query) {
  let next = 0;
  let completed = 0;

  async function worker() {
    while (!stopped && next < classes.length) {
      const class_ = classes[next++];
      const label = class_.classCode || class_.guid;
      try {
        const html = await requestHtml(
          DETAIL_PATH,
          detailFields(query, class_.guid),
          query.maxAttempts,
          label
        );
        Object.assign(class_, parseDetail(html), { error: '' });
      } catch (error) {
        class_.error = error.message;
        if (error.fatal) stopped = true;
      }
      completed += 1;
      setProgress('Loading class details', `${completed}/${classes.length} completed`, completed, classes.length);
      renderResult();
      if (!stopped) await sleep(250);
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(query.concurrency, classes.length) },
    () => worker()
  ));
}

async function startCrawl() {
  if (running) return;
  if (!connected) {
    showToast('Connect the NTT bridge before loading classes.');
    return;
  }
  const query = readQuery();
  stopped = false;
  setRunning(true);
  elements.results.replaceChildren();
  elements.summary.hidden = true;
  elements.registeredSection.hidden = true;
  elements.export.disabled = true;
  elements.retry.hidden = true;
  elements.progressBar.style.width = '0%';

  try {
    setProgress('Loading available courses', 'Requesting courses waiting for registration');
    try {
      courseCatalog = await fetchCourseCatalog(query);
      populateCoursePicker(courseCatalog, query.courseCode);
      const selectedCourse = courseCatalog.courses.find(course => course.code === query.courseCode);
      applyCourse(selectedCourse, query);
    } catch (error) {
      if (error.fatal) throw error;
      courseCatalog = { tables: [], rowCount: 0, courses: [], message: '', error: error.message };
      populateCoursePicker(courseCatalog);
    }

    let registered;
    setProgress('Loading registered courses', 'Requesting the current registration list');
    try {
      const registeredHtml = await requestHtml(
        REGISTERED_PATH,
        registeredFields(query),
        query.maxAttempts,
        'Registered courses'
      );
      registered = parseRegistered(registeredHtml);
    } catch (error) {
      if (error.fatal) throw error;
      registered = { tables: [], rowCount: 0, message: '', error: error.message };
    }

    setProgress('Loading available classes', 'Requesting the NTT class list');
    const html = await requestHtml(LIST_PATH, listFields(query), query.maxAttempts, 'Class list');
    const classes = parseClasses(html);
    result = {
      generatedAt: '',
      query,
      availableCourses: courseCatalog,
      registered,
      teachers: [],
      classes
    };
    renderResult();
    if (classes.length) await loadDetails(classes, query);
    finishResult();
  } catch (error) {
    setProgress('Unable to load classes', error.message);
  } finally {
    setRunning(false);
  }
}

async function retryFailed() {
  if (!result || running || !connected) return;
  const failed = result.classes.filter(class_ => class_.error);
  const retryCourseCatalog = Boolean(result.availableCourses.error);
  const retryRegistered = Boolean(result.registered.error);
  if (!failed.length && !retryCourseCatalog && !retryRegistered) return;
  stopped = false;
  setRunning(true);
  try {
    if (retryCourseCatalog) {
      setProgress('Retrying available courses', 'Requesting courses waiting for registration');
      try {
        result.availableCourses = await fetchCourseCatalog(result.query);
        courseCatalog = result.availableCourses;
        populateCoursePicker(courseCatalog, result.query.courseCode);
      } catch (error) {
        result.availableCourses.error = error.message;
        if (error.fatal) stopped = true;
      }
      renderResult();
    }
    if (!stopped && retryRegistered) {
      setProgress('Retrying registered courses', 'Requesting the current registration list');
      try {
        const html = await requestHtml(
          REGISTERED_PATH,
          registeredFields(result.query),
          result.query.maxAttempts,
          'Registered courses'
        );
        result.registered = parseRegistered(html);
      } catch (error) {
        result.registered.error = error.message;
        if (error.fatal) stopped = true;
      }
      renderResult();
    }
    if (!stopped && failed.length) {
      setProgress('Retrying failed classes', `${failed.length} classes queued`, 0, failed.length);
      await loadDetails(failed, result.query);
    }
    finishResult();
  } finally {
    setRunning(false);
  }
}

function finishResult() {
  if (!result) return;
  result.generatedAt = new Date().toISOString();
  result.teachers = [...new Set(result.classes.flatMap(class_ => class_.teachers))];
  const failed = result.classes.filter(class_ => class_.error).length;
  setProgress(
    stopped ? 'Crawl stopped' : 'Crawl complete',
    `${result.classes.length - failed}/${result.classes.length} class details loaded`,
    result.classes.length - failed,
    result.classes.length
  );
  elements.export.disabled = false;
  elements.retry.hidden = failed === 0 &&
    !result.availableCourses.error &&
    !result.registered.error;
  renderResult();
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function metric(value, label) {
  const item = node('div', 'metric');
  item.append(node('strong', '', String(value)), node('span', '', label));
  return item;
}

function renderSummary() {
  if (!result) return;
  const failed = result.classes.filter(class_ => class_.error).length;
  const sessions = result.classes.reduce((sum, class_) => sum + class_.sessions.length, 0);
  elements.summary.replaceChildren(
    metric(result.availableCourses.courses.length, 'Available courses'),
    metric(result.registered.rowCount, 'Registered courses'),
    metric(result.classes.length, 'Available classes'),
    metric(result.teachers.length, 'Unique lecturers'),
    metric(sessions, 'Schedule entries'),
    metric(failed, 'Failed details')
  );
  elements.summary.hidden = false;
}

function registeredTable(tableData) {
  const wrap = node('div', 'registered-table-wrap');
  const table = node('table', 'registered-table');
  const columnCount = Math.max(
    tableData.headers.length,
    ...tableData.rows.map(row => row.length)
  );
  const head = node('thead');
  const headRow = node('tr');
  for (let index = 0; index < columnCount; index += 1) {
    cell(headRow, 'th', tableData.headers[index] || `Column ${index + 1}`);
  }
  head.appendChild(headRow);
  const body = node('tbody');
  tableData.rows.forEach(values => {
    const row = node('tr');
    for (let index = 0; index < columnCount; index += 1) {
      cell(row, 'td', values[index] || '—');
    }
    body.appendChild(row);
  });
  table.append(head, body);
  wrap.appendChild(table);
  return wrap;
}

function renderRegistered() {
  if (!result) return;
  const registered = result.registered;
  elements.registeredCount.textContent = `${registered.rowCount} rows`;
  elements.registeredContent.replaceChildren();
  if (registered.error) {
    elements.registeredContent.appendChild(node('p', 'registered-error', registered.error));
  } else if (registered.tables.length) {
    elements.registeredContent.append(...registered.tables.map(registeredTable));
  } else {
    elements.registeredContent.appendChild(node(
      'p',
      'registered-empty',
      registered.message || 'No registered courses were returned.'
    ));
  }
  elements.registeredSection.hidden = false;
}

function cell(row, tag, text, className = '') {
  row.appendChild(node(tag, className, text));
}

function sessionTable(sessions) {
  const table = node('table', 'session-table');
  const head = node('thead');
  const headRow = node('tr');
  ['Type', 'Day / periods', 'Room', 'Group', 'Lecturer', 'Dates', 'Seats'].forEach(label => cell(headRow, 'th', label));
  head.appendChild(headRow);
  const body = node('tbody');

  sessions.forEach(session => {
    const row = node('tr');
    const periods = session.day
      ? `${session.day} · ${session.periodStart}–${session.periodEnd}`
      : session.rawSchedule || '—';
    const room = [session.campus, session.building, session.room].filter(Boolean).join(' · ') || '—';
    const dates = [session.startDate, session.endDate].filter(Boolean).join(' – ') || '—';
    const seats = session.enrolled === null || session.enrolled === undefined
      ? '—'
      : `${session.enrolled}/${session.capacity}`;
    cell(row, 'td', session.type || '—');
    cell(row, 'td', periods);
    cell(row, 'td', room, 'muted');
    cell(row, 'td', session.group || '—');
    cell(row, 'td', session.teacher || '—', 'teacher');
    cell(row, 'td', dates, 'muted');
    cell(row, 'td', seats);
    body.appendChild(row);
  });
  table.append(head, body);
  return table;
}

function classCard(class_) {
  const card = node('article', `class-card${class_.error ? ' failed' : ''}`);
  const head = node('div', 'class-head');
  const copy = node('div');
  copy.appendChild(node('h3', 'class-title', class_.classCode || class_.cohort || class_.guid));
  const meta = node('div', 'class-meta');
  [class_.courseName, class_.cohort, class_.status, class_.guid]
    .filter(Boolean)
    .forEach(value => meta.appendChild(node('span', '', value)));
  copy.appendChild(meta);
  const capacity = class_.enrolled === null
    ? 'Seats unavailable'
    : `${class_.enrolled} / ${class_.capacity} enrolled`;
  head.append(copy, node('span', 'capacity', capacity));
  card.appendChild(head);
  if (class_.error) card.appendChild(node('div', 'error', class_.error));
  if (class_.sessions.length) card.appendChild(sessionTable(class_.sessions));
  return card;
}

function renderResult() {
  if (!result) return;
  result.teachers = [...new Set(result.classes.flatMap(class_ => class_.teachers))];
  renderSummary();
  renderRegistered();
  elements.results.replaceChildren(...result.classes.map(classCard));
}

function exportResult() {
  if (!result) return;
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `ntt-classes-${result.query.courseCode}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

elements.form.addEventListener('submit', event => {
  event.preventDefault();
  startCrawl();
});
elements.loadCourses.addEventListener('click', loadCoursePicker);
elements.coursePicker.addEventListener('change', () => {
  const course = courseCatalog.courses.find(item => item.code === elements.coursePicker.value);
  applyCourse(course);
});
elements.stop.addEventListener('click', () => {
  stopped = true;
  elements.stop.disabled = true;
  setProgress('Stopping crawl', 'Waiting for active requests to finish');
});
elements.retry.addEventListener('click', retryFailed);
elements.export.addEventListener('click', exportResult);
