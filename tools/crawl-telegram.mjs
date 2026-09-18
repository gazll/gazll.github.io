#!/usr/bin/env node
/* Harvest Fshare links from Telegram chats the operator is a member of.

   MTProto as a plain user (GramJS): a member reads a group's history the way
   the app does, so no bot and no admin rights are needed. Like the site
   crawler, this only writes a raw source — one `Tên phim https://www.fshare.vn/...`
   line per link into secret/fshare-movie/raw/ and an originUrl into
   sources.json. It never touches Fshare or the catalog: that is `build` and
   `validate` in tools/fshare-movie.mjs.

   Nothing private is in this file, so it ships with the repo and runs on any
   machine. Everything that identifies the operator lives in secret/telegram/,
   which .gitignore already covers:

     config.json   { "apiId": 123, "apiHash": "…", "chats": ["@name", -1001234567890, "-1002633694014/571"] }
                   apiId/apiHash come from https://my.telegram.org (API development tools)
     session       the signed-in MTProto session — a login credential, mode 0600
     state.json    the last message id read per chat, so a rerun is incremental
     report.json   what the last run found

   Usage:
     node tools/crawl-telegram.mjs login            # once per machine: phone, code, 2FA
     node tools/crawl-telegram.mjs chats            # list groups/channels → ids for config.json
     node tools/crawl-telegram.mjs                  # harvest every chat in config.json
     node tools/crawl-telegram.mjs --chat @name     # one chat (username, t.me link or id)
     node tools/crawl-telegram.mjs --chat -1002633694014/571   # one forum topic (id/topic, or its t.me/c/… link)
     node tools/crawl-telegram.mjs --full           # re-read the whole history, not just new
     node tools/crawl-telegram.mjs --limit 200      # stop after N messages per chat (smoke test)
     node tools/crawl-telegram.mjs --no-register    # do not touch sources.json

   Messages are read oldest → newest so a run stopped half-way leaves a
   correct cursor: everything before it is written, everything after it is
   read next time.
*/

import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

import { Api, Logger, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

import { extractFshareLinks } from '../public/fshare-tool/lib/movie-db.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TELEGRAM_DIR = path.join(ROOT, 'secret', 'telegram');
const CONFIG_FILE = path.join(TELEGRAM_DIR, 'config.json');
const SESSION_FILE = path.join(TELEGRAM_DIR, 'session');
const STATE_FILE = path.join(TELEGRAM_DIR, 'state.json');
const REPORT_FILE = path.join(TELEGRAM_DIR, 'report.json');
const MOVIE_DIR = path.join(ROOT, 'secret', 'fshare-movie');
const RAW_DIR = path.join(MOVIE_DIR, 'raw');
const SOURCES_FILE = path.join(MOVIE_DIR, 'sources.json');
const STATE_VERSION = 1;
const CHECKPOINT_EVERY = 500;
const TITLE_MAX = 160;
const EXAMPLE_CONFIG = { apiId: 123456, apiHash: '0123456789abcdef0123456789abcdef', chats: ['@public_group', -1001234567890] };

const out = (line) => process.stdout.write(String(line) + '\n');
const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const relative = (file) => path.relative(ROOT, file).replaceAll(path.sep, '/');

/* ---------- text → records ---------- */

// A bare `fshare.vn/file/…` is a link the poster typed without a scheme.
const URL_RE = /(?:https?:\/\/|www\.|fshare\.vn\/)\S+/gi;

// A line that is only a label for the link beside it ("🔗 Link:") names nothing.
const LABEL_RE = /^(?:link|links|download|tải|tải về|fshare|size)$/i;

/** The line a human would call the film: the first line that is not just a
    link, with URLs, hashtags, list numbering and decoration removed. */
export function titleFromText(text) {
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = cleanText(rawLine.replace(URL_RE, ' ').replace(/#[\p{L}\p{N}_]+/gu, ' '))
      .replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, '')
      .replace(/^\d{1,3}[.)]\s+/, '')
      .trim();
    if (line && !LABEL_RE.test(line)) return line.slice(0, TITLE_MAX);
  }
  return '';
}

/** A bot's search result or a curated post lists many files in one message,
    one paragraph each — the paragraph names the file, the first line of the
    message only names the list. So a link is titled by the blank-line block
    it sits in; a text_link entity is placed by its offset (UTF-16, like JS);
    buttons and previews have no place in the text and take the message's. */
export function recordsFromMessage(message) {
  const text = String(message.message ?? '');
  const fallback = titleFromText(text) || cleanText(message.file?.name || '');
  const textUrls = (message.entities || [])
    .filter((entity) => entity.className === 'MessageEntityTextUrl' && entity.url)
    .map((entity) => ({ url: entity.url, offset: entity.offset ?? 0 }));
  const groups = [];
  let pos = 0;
  for (const block of text.split(/\n[ \t]*\n/)) {
    const start = text.indexOf(block, pos);
    const end = start + block.length;
    pos = end;
    const inside = textUrls.filter((entity) => entity.offset >= start && entity.offset < end).map((entity) => entity.url);
    groups.push({ text: [block, ...inside].join('\n'), title: titleFromText(block) || fallback });
  }
  const outside = textUrls.filter((entity) => !groups.some((group) => group.text.includes(entity.url))).map((entity) => entity.url);
  for (const row of message.replyMarkup?.rows || []) {
    for (const button of row.buttons || []) if (button.url) outside.push(button.url);
  }
  const webpage = message.media?.webpage;
  if (webpage?.url) outside.push(webpage.url);
  if (webpage?.description) outside.push(webpage.description);
  groups.push({ text: outside.join('\n'), title: fallback });

  const seen = new Set();
  const records = [];
  groups.forEach((group) => {
    extractFshareLinks(group.text).forEach((link) => {
      if (seen.has(link.id)) return;
      seen.add(link.id);
      records.push({
        link: link.link,
        title: group.title,
        id: message.id,
        groupedId: message.groupedId ? String(message.groupedId) : '',
        replyTo: message.replyTo?.replyToMsgId || 0
      });
    });
  });
  return records;
}

/** A link without a caption of its own borrows one: from the album it sits
    in (one caption per album, on any of its messages) or from the post it
    replies to. Resolved after the pass because the caption may arrive on
    either side of the link in history order. */
export function resolveTitles(records, titles) {
  return records.map((record) => {
    let title = record.title;
    if (!title && record.groupedId) title = titles.groups.get(record.groupedId) || '';
    if (!title && record.replyTo) title = titles.messages.get(record.replyTo) || '';
    return { ...record, title };
  });
}

export const rawLine = (record) => `${cleanText(record.title)} ${record.link}`.trim();

/* ---------- io ---------- */

async function readJson(file, fallback = undefined) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch (error) {
    if (fallback !== undefined && error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function atomicWrite(file, value, mode) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp-' + process.pid;
  await writeFile(temporary, value, { encoding: 'utf8', mode });
  await rename(temporary, file);
}

const saveJson = (file, value) => atomicWrite(file, JSON.stringify(value, null, 2) + '\n');

function option(args, name, fallback) {
  const inline = args.find((arg) => arg.startsWith(name + '='));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : fallback;
}

function die(message) {
  process.stderr.write('crawl-telegram: ' + message + '\n');
  process.exit(1);
}

/** The session is a login credential. A clone whose .gitignore lost `secret/`
    would commit it on the next `git add -A`, so refuse to write one that git
    would track — the check is one process, the mistake is permanent. */
function assertIgnored(file) {
  const result = spawnSync('git', ['check-ignore', '-q', file], { cwd: ROOT });
  if (result.status !== 0) die(`${relative(file)} is not gitignored — refusing to write a credential git would track.`);
}

async function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden && typeof rl._writeToOutput === 'function') {
    // Echo nothing for the 2FA password: readline has no built-in mask, and
    // this terminal may be a tmux pane whose scrollback outlives the prompt.
    const write = rl._writeToOutput;
    rl._writeToOutput = (text) => { if (/\r?\n$/.test(text) || text === question) write.call(rl, text); };
  }
  try { return (await rl.question(question)).trim(); } finally { rl.close(); if (hidden) process.stdout.write('\n'); }
}

/* ---------- telegram ---------- */

async function readConfig() {
  const config = await readJson(CONFIG_FILE, null);
  if (!config) {
    die(`missing ${relative(CONFIG_FILE)}. Create it from https://my.telegram.org → API development tools:\n`
      + JSON.stringify(EXAMPLE_CONFIG, null, 2));
  }
  if (!Number.isInteger(config.apiId) || typeof config.apiHash !== 'string' || !config.apiHash) {
    die(`${relative(CONFIG_FILE)} needs a numeric apiId and a string apiHash.`);
  }
  config.chats = Array.isArray(config.chats) ? config.chats : [];
  return config;
}

async function openClient(config, { requireAuth = true } = {}) {
  let saved = '';
  try { saved = (await readFile(SESSION_FILE, 'utf8')).trim(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const client = new TelegramClient(new StringSession(saved), config.apiId, config.apiHash, {
    connectionRetries: 5,
    // A FloodWait up to this many seconds is slept through instead of thrown;
    // a long history read on a busy group earns a few.
    floodSleepThreshold: 300,
    baseLogger: new Logger('error')
  });
  await client.connect();
  if (requireAuth && !(await client.isUserAuthorized())) {
    await client.disconnect();
    die(`no signed-in session at ${relative(SESSION_FILE)} — run: node tools/crawl-telegram.mjs login`);
  }
  return client;
}

async function login(config) {
  assertIgnored(SESSION_FILE);
  const client = await openClient(config, { requireAuth: false });
  if (await client.isUserAuthorized()) {
    const me = await client.getMe();
    out(`Already signed in as ${cleanText(`${me.firstName || ''} ${me.lastName || ''}`) || me.username || me.id}.`);
  } else {
    await client.start({
      phoneNumber: () => ask('Phone number (international, e.g. +84…): '),
      phoneCode: () => ask('Code Telegram just sent you: '),
      password: (hint) => ask(`2FA password${hint ? ` (hint: ${hint})` : ''}: `, { hidden: true }),
      onError: (error) => { out('Sign-in error: ' + (error.message || error)); return false; }
    });
    await atomicWrite(SESSION_FILE, client.session.save() + '\n', 0o600);
    await chmod(SESSION_FILE, 0o600);
    out(`Signed in. Session saved to ${relative(SESSION_FILE)} (mode 600, gitignored).`);
  }
  await client.disconnect();
}

/** Groups and channels only, newest activity first — enough to copy an id
    into config.json. Private chats have no username, so the id is the handle. */
async function listChats(config) {
  const client = await openClient(config);
  const rows = [];
  for await (const dialog of client.iterDialogs({})) {
    if (!dialog.isGroup && !dialog.isChannel) continue;
    const entity = dialog.entity;
    rows.push({ id: chatId(entity), title: dialog.title || '', username: entity.username ? '@' + entity.username : '' });
  }
  await client.disconnect();
  if (!rows.length) { out('No groups or channels in this account.'); return; }
  const width = Math.max(...rows.map((row) => row.id.length));
  rows.forEach((row) => out(`${row.id.padStart(width)}  ${row.title}${row.username ? `  ${row.username}` : ''}`));
  out(`\n${rows.length} chat(s). Put an id or @username into "chats" in ${relative(CONFIG_FILE)}.`);
}

/** The id the app shows for the chat: channels and supergroups carry the
    -100 prefix, legacy groups a plain negative id. */
function chatId(entity) {
  const raw = String(entity.id);
  if (entity.className === 'Channel') return '-100' + raw;
  if (entity.className === 'Chat') return '-' + raw;
  return raw;
}

/** A chat, or one forum topic inside it. Accepted: @username, t.me/<user>,
    t.me/c/<id>/<topic>, -100<id>, -100<id>/<topic>, -100<id>_<topic>. A bare
    100<id> (13+ digits) is the -100 form with the sign dropped — no user id
    is that long. The chat half is what getEntity accepts: a digit string is
    an id, anything else a username. */
export function chatReference(value) {
  let text = String(value).trim();
  let topic = 0;
  const link = text.match(/^(?:https?:\/\/)?t\.me\/(?:c\/(\d+)|([A-Za-z0-9_]+))(?:\/(\d+))?/i);
  if (link) {
    text = link[1] ? '-100' + link[1] : link[2];
    topic = Number(link[3] || 0);
  } else {
    const pair = text.match(/^(-?\d+)[/_](\d+)$/) || text.match(/^(@?[A-Za-z0-9_]+)\/(\d+)$/);
    if (pair) { text = pair[1]; topic = Number(pair[2]); }
  }
  if (/^100\d{10,}$/.test(text)) text = '-' + text;
  return { chat: text, topic };
}

const slugOf = (entity, topic) => (entity.username ? entity.username.toLowerCase() : 'c' + String(entity.id)) + (topic ? `-t${topic}` : '');
const originOf = (entity, topic) => (entity.username ? `https://t.me/${entity.username}` : `https://t.me/c/${String(entity.id)}`) + (topic ? `/${topic}` : '');

/** The topic's name, for sources.json and the log; the root message is a
    service message with no text, so it cannot be read from history. */
async function topicTitle(client, entity, topic) {
  try {
    const result = await client.invoke(new Api.channels.GetForumTopicsByID({ channel: entity, topics: [topic] }));
    return result.topics?.[0]?.title || '';
  } catch { return ''; }
}

/* ---------- harvest ---------- */

function defaults() {
  return {
    date: new Date().toISOString().slice(0, 10),
    chat: '',
    output: '',
    limit: 0,
    full: false,
    register: true
  };
}

function parseOptions(args) {
  const base = defaults();
  const limit = Number(option(args, '--limit', 0));
  return {
    ...base,
    chat: option(args, '--chat', ''),
    output: option(args, '--output', ''),
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0,
    full: args.includes('--full'),
    register: !args.includes('--no-register')
  };
}

async function registerSource(file, originUrl, title) {
  const relativeRaw = path.relative(RAW_DIR, file).replaceAll(path.sep, '/');
  if (!relativeRaw || relativeRaw.startsWith('../') || path.isAbsolute(relativeRaw)) {
    throw new Error('Cannot register output outside ' + relative(RAW_DIR) + ': ' + file);
  }
  const manifest = await readJson(SOURCES_FILE, { version: 1, sources: {} });
  manifest.version ||= 1;
  manifest.sources ||= {};
  manifest.sources[relativeRaw] = { originUrl, title };
  await saveJson(SOURCES_FILE, manifest);
}

async function harvestChat(client, reference, state, options) {
  const { chat, topic } = chatReference(reference);
  const entity = await client.getEntity(chat);
  const key = slugOf(entity, topic);
  const chatTitle = entity.title || entity.username || key;
  const title = topic ? `${chatTitle} › ${await topicTitle(client, entity, topic) || `topic ${topic}`}` : chatTitle;
  const label = chatId(entity) + (topic ? `/${topic}` : '');
  const chatState = (!options.full && state.chats[key]) || { lastId: 0, messages: 0, links: 0 };
  const output = options.output || path.join(RAW_DIR, `telegram-${key}-${options.date}.txt`);

  // The file is the union of what it already holds and this run: a rerun on
  // the same day appends, a stopped run keeps what it reached.
  const lines = new Set(existsSync(output)
    ? (await readFile(output, 'utf8')).split(/\r?\n/).filter(Boolean)
    : []);
  const records = [];
  const titles = { groups: new Map(), messages: new Map() };
  let seen = 0;
  let lastId = chatState.lastId;
  let stopping = false;
  const stop = () => { if (!stopping) { stopping = true; out('Stopping after the current batch…'); } };
  process.once('SIGINT', stop);

  const flush = async () => {
    resolveTitles(records, titles).forEach((record) => lines.add(rawLine(record)));
    if (lines.size) await atomicWrite(output, [...lines].join('\n') + '\n');
    state.chats[key] = {
      id: label,
      title,
      lastId,
      messages: chatState.messages + seen,
      links: lines.size,
      harvestedAt: new Date().toISOString()
    };
    state.updatedAt = state.chats[key].harvestedAt;
    await saveJson(STATE_FILE, state);
  };

  out(`${title} (${label}): reading ${chatState.lastId ? `messages after #${chatState.lastId}` : 'the whole history'}…`);
  for await (const message of client.iterMessages(entity, {
    minId: chatState.lastId,
    reverse: true,
    limit: options.limit || undefined,
    // A forum topic is a reply thread under its root message.
    replyTo: topic || undefined
  })) {
    if (stopping) break;
    lastId = Math.max(lastId, message.id);
    seen++;
    const text = titleFromText(message.message);
    if (text) {
      titles.messages.set(message.id, text);
      if (message.groupedId) titles.groups.set(String(message.groupedId), text);
    }
    records.push(...recordsFromMessage(message));
    if (seen % CHECKPOINT_EVERY === 0) {
      await flush();
      out(`  #${message.id} · ${seen} messages · ${lines.size} lines`);
    }
  }
  process.off('SIGINT', stop);
  await flush();
  if (options.register && lines.size) await registerSource(output, originOf(entity, topic), title);

  const report = { chat: label, title, key, messages: seen, lines: lines.size, lastId, output: relative(output), stopped: stopping };
  out(`  ${seen} message(s) read, ${lines.size} line(s) in ${relative(output)}${stopping ? ' (stopped — rerun to continue)' : ''}`);
  return report;
}

export async function harvest(options) {
  const config = await readConfig();
  const chats = options.chat ? [options.chat] : config.chats;
  if (!chats.length) die(`no chats: pass --chat, or list them under "chats" in ${relative(CONFIG_FILE)} (see: chats).`);
  await mkdir(RAW_DIR, { recursive: true });
  const saved = await readJson(STATE_FILE, null);
  const state = saved?.version === STATE_VERSION && saved.chats ? saved : { version: STATE_VERSION, chats: {} };

  const client = await openClient(config);
  const reports = [];
  try {
    for (const chat of chats) {
      reports.push(await harvestChat(client, chat, state, options));
      if (reports.at(-1).stopped) break;
    }
  } finally {
    await client.disconnect();
  }
  await saveJson(REPORT_FILE, { version: STATE_VERSION, harvestedAt: new Date().toISOString(), chats: reports });
  const total = reports.reduce((sum, report) => sum + report.lines, 0);
  out(`Done: ${reports.length} chat(s), ${total} line(s). Next: node tools/fshare-movie.mjs build`);
  return reports;
}

/* ---------- cli ---------- */

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const command = args[0] && !args[0].startsWith('--') ? args[0] : 'harvest';
  const run = command === 'login' ? () => readConfig().then(login)
    : command === 'chats' ? () => readConfig().then(listChats)
    : command === 'harvest' ? () => harvest(parseOptions(args))
    : null;
  if (!run) die(`unknown command "${command}" — login · chats · [harvest]`);
  run().then(() => process.exit(0)).catch((error) => {
    process.stderr.write('crawl-telegram: ' + (error.stack || error.message || String(error)) + '\n');
    process.exit(1);
  });
}
