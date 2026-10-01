#!/usr/bin/env node
// scripts/nda.mjs — look after nda requests from the command line.
//
//   node scripts/nda.mjs list [--all]      requests, newest first (pending + approved unless --all)
//   node scripts/nda.mjs show <id>         one request, with its history
//   node scripts/nda.mjs approve <id>      approve a pending request and print their access link
//   node scripts/nda.mjs deny <id>         deny a pending request (no email)
//   node scripts/nda.mjs revoke <id>       end someone's access (their cookie stops working on the next page load)
//   node scripts/nda.mjs link <id>         print a fresh 90-day access link for an approved request
//
// reads NDA_DATA_DIR, NDA_SECRET and SITE_URL from the environment, so on the
// server run it with the site's env loaded:
//   set -a; . ~/srv/personal-website/shared/personal-website.env; set +a
//   node scripts/nda.mjs list
//
// it writes the same append-only requests.jsonl as the site and takes the same
// lock file. approve here doesn't send email (the site does that when you use
// the button in the email); send the printed link yourself.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHmac } from 'node:crypto';

const DIR = process.env.NDA_DATA_DIR || path.join(os.homedir(), 'srv/personal-website/shared/nda');
const SECRET = (process.env.NDA_SECRET || '').trim();
const SITE = (process.env.SITE_URL || 'https://collinrijock.com').replace(/\/+$/, '');
const LOG = path.join(DIR, 'requests.jsonl');
const LOCK = path.join(DIR, 'requests.lock');
const DAY = 86_400_000;

function readAll() {
  const out = new Map();
  let raw = '';
  try { raw = fs.readFileSync(LOG, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return out; throw e; }
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.t === 'request' && !out.has(o.id)) { const { t, ...r } = o; out.set(o.id, { ...r, status: 'pending', history: [{ status: 'pending', at: o.signed_at, via: 'request' }] }); }
    else if (o.t === 'status' && out.has(o.id)) { const r = out.get(o.id); r.status = o.status; r.history.push({ status: o.status, at: o.at, via: o.via, note: o.note }); }
  }
  return out;
}

async function withLock(fn) {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  for (let i = 0; ; i++) {
    try { fs.closeSync(fs.openSync(LOCK, 'wx', 0o600)); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - fs.statSync(LOCK).mtimeMs > 10_000) fs.unlinkSync(LOCK); } catch {}
      if (i > 200) throw new Error('the nda store is locked');
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  try { return await fn(); } finally { try { fs.unlinkSync(LOCK); } catch {} }
}

function addStatus(id, status, note) {
  const line = { t: 'status', id, status, at: new Date().toISOString(), via: 'cli', ...(note ? { note } : {}) };
  const fd = fs.openSync(LOG, 'a', 0o600);
  try { fs.writeSync(fd, JSON.stringify(line) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function sign(payload) {
  if (SECRET.length < 16) die('NDA_SECRET is not set (load the site env first)');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${createHmac('sha256', SECRET).update(`nda.v1.${body}`).digest('base64url')}`;
}
const accessLink = (id) => `${SITE}/nda/access?token=${encodeURIComponent(sign({ p: 'access', r: id, e: Date.now() + 90 * DAY }))}`;

function die(msg) { console.error(`nda: ${msg}`); process.exit(1); }
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
const short = (iso) => (iso || '').slice(0, 16).replace('T', ' ');

function need(id) {
  if (!id) die('give a request id (see: node scripts/nda.mjs list)');
  const r = readAll().get(id);
  if (!r) die(`no request ${id} in ${LOG}`);
  return r;
}

async function change(id, to, allowed) {
  return withLock(() => {
    const r = need(id);
    if (!allowed.includes(r.status)) die(`${id} is ${r.status}, can't make it ${to}`);
    addStatus(id, to);
    return r;
  });
}

const [cmd, arg] = process.argv.slice(2);
switch (cmd) {
  case 'list': {
    const all = [...readAll().values()].filter((r) => arg === '--all' || ['pending', 'approved'].includes(r.status)).sort((a, b) => b.signed_at.localeCompare(a.signed_at));
    if (!all.length) { console.log(`no requests${arg === '--all' ? '' : ' pending or approved (try --all)'} in ${LOG}`); break; }
    console.log(`${pad('id', 13)} ${pad('status', 9)} ${pad('signed (utc)', 17)} ${pad('name', 24)} ${pad('email', 30)} company`);
    for (const r of all) console.log(`${pad(r.id, 13)} ${pad(r.status, 9)} ${pad(short(r.signed_at), 17)} ${pad(r.name, 24)} ${pad(r.email, 30)} ${r.company || ''}`);
    break;
  }
  case 'show': {
    const r = need(arg);
    console.log(JSON.stringify(r, null, 2));
    break;
  }
  case 'approve': {
    const r = await change(arg, 'approved', ['pending', 'failed', 'denied', 'revoked']);
    console.log(`approved ${r.id} (${r.name} <${r.email}>). send them this link (good for 90 days):\n${accessLink(r.id)}`);
    break;
  }
  case 'deny': {
    const r = await change(arg, 'denied', ['pending', 'failed']);
    console.log(`denied ${r.id} (${r.name}). no email was sent.`);
    break;
  }
  case 'revoke': {
    const r = await change(arg, 'revoked', ['approved']);
    console.log(`revoked ${r.id} (${r.name}). their link and cookie stop working now.`);
    break;
  }
  case 'link': {
    const r = need(arg);
    if (r.status !== 'approved') die(`${r.id} is ${r.status}; approve it first`);
    console.log(accessLink(r.id));
    break;
  }
  default:
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 12).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    if (cmd && cmd !== 'help' && cmd !== '--help') process.exit(1);
}
