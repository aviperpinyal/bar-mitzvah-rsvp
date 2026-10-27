/**
 * Alex's Bar Mitzvah — Web Server
 * Zero npm dependencies — runs with: node server.js
 * Requires Node.js v18+
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT        = parseInt(process.env.PORT  || '10003');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  console.error('ADMIN_TOKEN is not set. Start with: ADMIN_TOKEN=yourStrongPassword node server.js');
  process.exit(1);
}
const DATA_DIR    = path.join(__dirname, 'data');
const DATA_FILE   = path.join(DATA_DIR, 'rsvps.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const PUBLIC_DIR  = path.join(__dirname, 'public');

// ── In-memory invite job store ────────────────────────────────────────────────
const inviteJobs = new Map(); // jobId → job state

// ── Config helpers ────────────────────────────────────────────────────────────
function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { return {}; }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

// ── Data helpers ──────────────────────────────────────────────────────────────
if (!fs.existsSync(DATA_DIR))  fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

let _nextId = null;

function readRsvps() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}

function saveRsvps(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

function nextId() {
  if (_nextId === null) {
    const list = readRsvps();
    _nextId = list.length > 0 ? Math.max(...list.map(r => r.id)) + 1 : 1;
  }
  return _nextId++;
}

// ── MIME types ────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css' : 'text/css; charset=utf-8',
  '.js'  : 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg' : 'image/svg+xml',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico' : 'image/x-icon',
  '.woff2': 'font/woff2',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type'  : 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > 1e6) reject(new Error('Payload too large')); });
    req.on('end',  () => resolve(raw));
    req.on('error', reject);
  });
}

function checkAdmin(req, res) {
  const auth = req.headers['authorization'] || '';
  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    json(res, 401, { error: 'Unauthorized' });
    return false;
  }
  return true;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type'  : mime,
      'Content-Length': stat.size,
      'Cache-Control' : 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ── Stats helper ──────────────────────────────────────────────────────────────
function isAttending(r) {
  if (r.events) return Object.values(r.events).some(Boolean);
  return Boolean(r.attending);
}

function buildStats(rsvps) {
  const attending    = rsvps.filter(r =>  isAttending(r));
  const notAttending = rsvps.filter(r => !isAttending(r));
  const totalGuests  = attending.reduce((s, r) => s + (r.guests || 1), 0);

  // Per-event counts with actual PAX (new token-based format)
  const eventCounts = {};
  for (const r of rsvps) {
    if (r.events && typeof r.events === 'object') {
      for (const [evId, att] of Object.entries(r.events)) {
        if (!eventCounts[evId]) eventCounts[evId] = { attending: 0, notAttending: 0, guests: 0 };
        if (att) {
          eventCounts[evId].attending++;
          // Use per-event guest count if available, fall back to r.guests
          const pax = r.eventGuests?.[evId] ?? r.guests ?? 1;
          eventCounts[evId].guests += Number(pax) || 1;
        } else {
          eventCounts[evId].notAttending++;
        }
      }
    }
  }

  return {
    total:        rsvps.length,
    attending:    attending.length,
    notAttending: notAttending.length,
    totalGuests,
    eventCounts,
  };
}

// ── CSV helper ────────────────────────────────────────────────────────────────
function toCSV(rsvps) {
  const q = v => `"${String(v || '').replace(/"/g, '""')}"`;
  const header = ['ID','Date','Updated','Name','Email','Attending','Party Size','Events','Hoodie Sizes','Mailing Address','Dietary','Message'];
  const rows = rsvps.map(r => {
    // Flatten the events map to a readable string: "Service ✓, Party ✗"
    let eventsStr = '';
    if (r.events && typeof r.events === 'object') {
      eventsStr = Object.entries(r.events)
        .map(([id, att]) => `Event ${id}: ${att ? 'Yes' : 'No'}`)
        .join(' | ');
    }
    const attending = isAttending(r);
    return [
      r.id,
      r.created_at?.split('T')[0] || '',
      r.updated_at?.split('T')[0] || '',
      q(r.name),
      r.email,
      attending ? 'Yes' : 'No',
      r.guests ?? (attending ? 1 : 0),
      q(eventsStr),
      q(Array.isArray(r.hoodiesSizes) ? r.hoodiesSizes.join(', ') : (r.hoodiesSizes || '')),
      q(r.mailingAddress),
      q(r.dietary),
      q(r.message),
    ];
  });
  return '﻿' + [header, ...rows].map(r => r.join(',')).join('\r\n');
}

// ── HTTPS fetch with redirect following ───────────────────────────────────────
function httpsGet(urlStr) {
  const https = require('https');
  const http2 = require('http');
  return new Promise((resolve, reject) => {
    function get(u, hops) {
      if (hops > 8) return reject(new Error('Too many redirects'));
      const lib = u.startsWith('https') ? https : http2;
      const req2 = lib.get(u, { headers: { 'User-Agent': 'node/bar-mitzvah-rsvp' } }, (res2) => {
        if ([301,302,303,307,308].includes(res2.statusCode) && res2.headers.location) {
          res2.resume();
          return get(res2.headers.location, hops + 1);
        }
        const chunks = [];
        res2.on('data', c => chunks.push(c));
        res2.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res2.on('error', reject);
      });
      req2.on('error', reject);
    }
    get(urlStr, 0);
  });
}

// ── Parse Google Sheet CSV → guest objects ────────────────────────────────────
// Sheet format: #, Household, First, Last, Email, Guests, Kids,
//               Shabbat(1), Service(2), Party(3), Breakfast(4), Notes
function parseSheetGuests(csvText) {
  if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);
  function csvParse(text) {
    const result = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const row = []; let field = ''; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQ) {
          if (ch === '"' && line[i+1] === '"') { field += '"'; i++; }
          else if (ch === '"') inQ = false;
          else field += ch;
        } else {
          if (ch === '"') inQ = true;
          else if (ch === ',') { row.push(field); field = ''; }
          else field += ch;
        }
      }
      row.push(field); result.push(row);
    }
    return result;
  }
  const rows = csvParse(csvText);
  let headerIdx = -1;
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    if (rows[i].some(c => /email/i.test(c))) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return null;
  const C = { H:1, FIRST:2, LAST:3, EMAIL:4, GUESTS:5, KIDS:6, E1:7, E2:8, E3:9, E4:10, NOTES:11 };
  const seen = new Set();
  const guests = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r.length || !(r[C.H] || '').trim()) continue;
    const email = (r[C.EMAIL] || '').trim().toLowerCase();
    if (!email || !email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    const events = [[C.E1,1],[C.E2,2],[C.E3,3],[C.E4,4]]
      .filter(([c]) => (r[c] || '').trim().toUpperCase() === 'YES').map(([,id]) => id);
    if (!events.length) continue;
    guests.push({
      household:  (r[C.H]     || '').trim(),
      firstName:  (r[C.FIRST] || '').trim() || null,
      lastName:   (r[C.LAST]  || '').trim() || null,
      email,
      guestCount: parseInt(r[C.GUESTS]) || 1,
      kidsCount:  parseInt(r[C.KIDS])   || 0,
      events,
      notes: (r[C.NOTES] || '').trim() || null,
    });
  }
  return guests;
}

// ── Bulk email job runner ─────────────────────────────────────────────────────
async function runInviteJob(jobId, guestIds, dryRun, delayMs, emailType = 'invite') {
  const job = inviteJobs.get(jobId);
  if (!job) return;
  const cfg     = readConfig();
  const siteUrl = (cfg.saveTheDate?.websiteUrl || 'https://rsvp.example.com').replace(/\/$/, '');
  const gFile   = path.join(DATA_DIR, 'guests.json');
  const rFile   = path.join(DATA_DIR, 'rsvps.json');
  const LOG     = { invite: 'INVITE', reminder: 'REMINDER', finalReminder: 'FINAL-REMINDER', preEvent: 'PRE-EVENT' }[emailType] || 'EMAIL';
  const FIELD   = { invite: 'invite', reminder: 'reminder', finalReminder: 'finalReminder', preEvent: 'preEvent' }[emailType] || 'invite';

  // Build RSVP'd-guest set once — used to skip already-responded guests for reminders
  const rsvpedIds = new Set();
  if (emailType === 'reminder' || emailType === 'finalReminder') {
    try {
      JSON.parse(fs.readFileSync(rFile, 'utf8')).forEach(r => { if (r.guestId) rsvpedIds.add(r.guestId); });
    } catch {}
  }

  for (let i = 0; i < guestIds.length; i++) {
    const guestId = guestIds[i];
    let guests;
    try { guests = JSON.parse(fs.readFileSync(gFile, 'utf8')); } catch { guests = []; }
    const guest = guests.find(g => g.id === guestId);

    if (!guest)              { job.skipped.push({ id: guestId, name: '?',          reason: 'Guest not found'    }); job.processed++; continue; }
    if (!guest.email)        { job.skipped.push({ id: guestId, name: guest.name,   reason: 'No email'           }); job.processed++; continue; }
    if (!guest.events?.length){ job.skipped.push({ id: guestId, name: guest.name,  reason: 'No events assigned' }); job.processed++; continue; }
    if (rsvpedIds.has(guestId)) { job.skipped.push({ id: guestId, name: guest.name, reason: "Already RSVP'd"   }); job.processed++; continue; }

    job.current = guest.name;

    if (dryRun) {
      job.sent.push({ id: guestId, name: guest.name, email: guest.email, dryRun: true });
    } else {
      try {
        const emails = require('./lib/emails');
        let html, text, subject;

        if (emailType === 'reminder' || emailType === 'finalReminder') {
          html    = emails.buildReminderHtml(guest, cfg, siteUrl);
          text    = emails.buildReminderText(guest, cfg, siteUrl);
          subject = cfg.emailTemplates?.reminder?.subject || "Friendly reminder — Please RSVP for Alex's Bar Mitzvah";
        } else if (emailType === 'preEvent') {
          let rsvpList = [];
          try { rsvpList = JSON.parse(fs.readFileSync(rFile, 'utf8')); } catch {}
          const rsvp = rsvpList.find(r => r.guestId === guest.id);
          const attendingIds = rsvp
            ? Object.entries(rsvp.events || {}).filter(([, v]) => v).map(([k]) => Number(k))
            : guest.events || [];
          const preEventGroup = emails.resolvePreEventGroup(cfg, attendingIds);
          html    = emails.buildPreEventHtml(guest, cfg, siteUrl, attendingIds);
          text    = `Dear ${emails.greetingName(guest)},\n\n${preEventGroup.openingLine}\n\n— ${cfg.contact?.fromName || 'Jordan & Taylor Sample'}`;
          subject = preEventGroup.subject;
        } else {
          html    = emails.buildInviteHtml(guest, cfg, siteUrl);
          text    = emails.buildInviteText(guest, cfg, siteUrl);
          subject = cfg.emailTemplates?.invitation?.subject || "You're Invited — Alex's Bar Mitzvah";
        }

        await emails.sendEmail({ to: guest.email, name: guest.name, subject, html, text }, cfg);

        // Stamp the correct emails.* field on the guest record
        guests = JSON.parse(fs.readFileSync(gFile, 'utf8'));
        const idx = guests.findIndex(g => g.id === guestId);
        if (idx >= 0) {
          if (!guests[idx].emails) guests[idx].emails = {};
          guests[idx].emails[FIELD] = new Date().toISOString();
          fs.writeFileSync(gFile, JSON.stringify(guests, null, 2), 'utf8');
        }
        job.sent.push({ id: guestId, name: guest.name, email: guest.email });
        console.log(`[${LOG}] ✓ ${guest.email} (${guest.name})`);
      } catch (err) {
        job.failed.push({ id: guestId, name: guest.name, email: guest.email, error: err.message });
        console.error(`[${LOG}] ✗ ${guest.email}: ${err.message}`);
      }
    }

    job.processed++;
    if (i < guestIds.length - 1 && delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
  }

  job.status      = 'done';
  job.current     = null;
  job.completedAt = new Date().toISOString();
  console.log(`[${LOG}] Job ${jobId} done — sent:${job.sent.length} failed:${job.failed.length} skipped:${job.skipped.length}`);
}

// ── Server ────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const { pathname } = url.parse(req.url);

  // ── POST /api/rsvp ────────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/rsvp') {
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch { return json(res, 400, { error: 'Invalid request body.' }); }

    const { name, email, attending, guests, meal, dietary, message } = body;

    if (!name || !email || attending === undefined) {
      return json(res, 400, { error: 'Name, email, and attendance are required.' });
    }

    const list = readRsvps();
    const dup  = list.find(r => r.email.toLowerCase() === String(email).toLowerCase().trim());
    if (dup) {
      return json(res, 409, { error: 'An RSVP from this email already exists.' });
    }

    const rsvp = {
      id        : nextId(),
      created_at: new Date().toISOString(),
      name      : String(name).trim(),
      email     : String(email).trim().toLowerCase(),
      attending : Boolean(attending),
      guests    : attending ? (parseInt(guests) || 1) : 0,
      dietary   : dietary ? String(dietary).trim() : null,
      message   : message ? String(message).trim() : null,
    };

    list.push(rsvp);
    saveRsvps(list);

    console.log(`[RSVP] ${rsvp.created_at} — ${rsvp.name} (${rsvp.email}) — ${rsvp.attending ? 'ATTENDING' : 'NOT ATTENDING'}`);
    return json(res, 200, { success: true, id: rsvp.id });
  }

  // ── GET /api/rsvps ────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/rsvps') {
    if (!checkAdmin(req, res)) return;
    const rsvps = readRsvps();
    return json(res, 200, { stats: buildStats(rsvps), rsvps });
  }

  // ── GET /api/rsvps/export ─────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/rsvps/export') {
    if (!checkAdmin(req, res)) return;
    const rsvps = readRsvps();
    const csv   = toCSV(rsvps);
    const date  = new Date().toISOString().split('T')[0];
    res.writeHead(200, {
      'Content-Type'       : 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="alex-rsvps-${date}.csv"`,
    });
    return res.end(csv);
  }

  // ── GET /api/site-config (public — event info for the frontend) ──────────
  if (req.method === 'GET' && pathname === '/api/site-config') {
    const cfg = readConfig();
    const raw = cfg.contact || {};
    // Return only the fields the public site needs — strip email credentials
    const pub = {
      site:    cfg.site    || {},
      events:  cfg.events  || [],
      travel:  cfg.travel  || {},
      about:   cfg.about   || {},
      contact: {
        fromName:  raw.fromName  || '',
        fromEmail: raw.fromEmail || '',
        replyTo:   raw.replyTo   || raw.fromEmail || '',
      },
    };
    return json(res, 200, pub);
  }

  // ── GET /api/config (full config — admin only) ────────────────────────────
  if (req.method === 'GET' && pathname === '/api/config') {
    if (!checkAdmin(req, res)) return;
    return json(res, 200, readConfig());
  }

  // ── POST /api/config (save — admin only) ──────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/config') {
    if (!checkAdmin(req, res)) return;
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch { return json(res, 400, { error: 'Invalid JSON' }); }
    saveConfig(body);
    console.log(`[CONFIG] Settings saved at ${new Date().toISOString()}`);
    return json(res, 200, { success: true });
  }

  // ── POST /api/test-connection (verify Gmail credentials) ─────────────────
  if (req.method === 'POST' && pathname === '/api/test-connection') {
    if (!checkAdmin(req, res)) return;
    const cfg = readConfig();
    const contact = cfg.contact || {};
    if (!contact.gmailUser || !contact.gmailAppPassword || contact.gmailAppPassword === 'REPLACE_WITH_YOUR_APP_PASSWORD') {
      return json(res, 400, { success: false, error: 'Gmail App Password not configured. Set it in Settings → Email & Contact, then save.' });
    }
    let nodemailer;
    try { nodemailer = require('nodemailer'); }
    catch { return json(res, 500, { success: false, error: 'nodemailer not installed. Run: docker-compose exec web npm install' }); }
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: contact.gmailUser, pass: contact.gmailAppPassword },
      });
      await transporter.verify();
      console.log(`[EMAIL] Connection test passed for ${contact.gmailUser}`);
      return json(res, 200, { success: true, message: `Connected successfully as ${contact.gmailUser}` });
    } catch (err) {
      console.error(`[EMAIL] Connection test failed: ${err.message}`);
      return json(res, 400, { success: false, error: err.message });
    }
  }

  // ── POST /api/test-send (send test invitation emails) ────────────────────
  if (req.method === 'POST' && pathname === '/api/test-send') {
    if (!checkAdmin(req, res)) return;
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch { return json(res, 400, { error: 'Invalid JSON' }); }

    // body = { testCaseId, sendTo, events, guestCount, kidsCount, emailType }
    const { testCaseId, sendTo, events, guestCount, kidsCount, emailType = 'invite' } = body;
    if (!sendTo || !events || !events.length) {
      return json(res, 400, { error: 'sendTo email and events array are required' });
    }

    // Generate a test guest token (prefixed so it's obvious it's a test)
    const testToken = 'TEST_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const testGuest = {
      id:         `test_${testCaseId || emailType || 'manual'}`,
      name:       'Test Guest',
      firstName:  'Test',
      household:  'The Sample Family',
      email:      sendTo,
      token:      testToken,
      events:     events.map(Number),
      guestCount: Number(guestCount) || 2,
      kidsCount:  Number(kidsCount) || 0,
      isTest:     true,
      inviteSent: true,
      created_at: new Date().toISOString(),
    };

    // Store in guests.json so the RSVP link works
    const guestsFile = path.join(DATA_DIR, 'guests.json');
    let guests = [];
    try { guests = JSON.parse(fs.readFileSync(guestsFile, 'utf8')); } catch { guests = []; }
    guests = guests.filter(g => g.id !== testGuest.id);
    guests.push(testGuest);
    fs.writeFileSync(guestsFile, JSON.stringify(guests, null, 2), 'utf8');

    // Purge any previous RSVP for this test guest so the form always starts fresh
    const rsvpsFile = path.join(DATA_DIR, 'rsvps.json');
    let rsvps = [];
    try { rsvps = JSON.parse(fs.readFileSync(rsvpsFile, 'utf8')); } catch { rsvps = []; }
    rsvps = rsvps.filter(r => r.guestId !== testGuest.id);
    fs.writeFileSync(rsvpsFile, JSON.stringify(rsvps, null, 2), 'utf8');

    const cfg = readConfig();
    const siteUrl = (cfg.saveTheDate?.websiteUrl || 'https://rsvp.example.com').replace(/\/$/, '');
    const rsvpUrl = `${siteUrl}/rsvp/${testToken}`;

    console.log(`[TEST] Sending test '${emailType}' for case '${testCaseId}' → ${sendTo} | Token: ${testToken}`);
    console.log(`[TEST] RSVP link: ${rsvpUrl}`);

    // Build the appropriate email based on type
    let emailResult = null;
    const contact = cfg.contact || {};
    if (contact.gmailUser && contact.gmailAppPassword && contact.gmailAppPassword !== 'REPLACE_WITH_YOUR_APP_PASSWORD') {
      try {
        const emails = require('./lib/emails');
        let html, text, subject;
        if (emailType === 'reminder') {
          html    = emails.buildReminderHtml(testGuest, cfg, siteUrl);
          text    = emails.buildReminderText(testGuest, cfg, siteUrl);
          subject = `[TEST] ${cfg.emailTemplates?.reminder?.subject || "Friendly reminder — Please RSVP for Alex's Bar Mitzvah"}`;
        } else if (emailType === 'preEvent') {
          const preEventGroupTest = emails.resolvePreEventGroup(cfg, testGuest.events);
          html    = emails.buildPreEventHtml(testGuest, cfg, siteUrl, testGuest.events);
          text    = `Pre-event details for Alex's Bar Mitzvah\n\nDear Test Guest,\n\n${preEventGroupTest.openingLine}\n\n— ${contact.fromName || 'Jordan & Taylor Sample'}`;
          subject = `[TEST] ${preEventGroupTest.subject}`;
        } else {
          html    = emails.buildInviteHtml(testGuest, cfg, siteUrl);
          text    = emails.buildInviteText(testGuest, cfg, siteUrl);
          subject = `[TEST] ${cfg.emailTemplates?.invite?.subject || "You're Invited — Alex's Bar Mitzvah"}`;
        }
        await emails.sendEmail({ to: sendTo, name: 'Test Guest', subject, html, text }, cfg);
        emailResult = `Email sent to ${sendTo}`;
        console.log(`[TEST] Email delivered to ${sendTo}`);
      } catch (err) {
        console.error(`[TEST] Email send failed: ${err.message}`);
        emailResult = `Email failed: ${err.message}`;
      }
    } else {
      emailResult = 'Gmail not configured — RSVP link created but no email sent.';
    }

    return json(res, 200, {
      success: true,
      token:   testToken,
      rsvpUrl,
      emailResult,
      message: emailResult,
    });
  }

  // ── POST /api/invites/start ───────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/invites/start') {
    if (!checkAdmin(req, res)) return;
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch { return json(res, 400, { error: 'Invalid JSON' }); }

    const { guestIds, dryRun = false, delayMs = 1000, emailType = 'invite' } = body;
    if (!guestIds?.length) return json(res, 400, { error: 'guestIds array is required' });
    if (!['invite','reminder','finalReminder','preEvent'].includes(emailType)) {
      return json(res, 400, { error: 'emailType must be invite, reminder, finalReminder, or preEvent' });
    }

    const cfg3 = readConfig();
    if (!dryRun) {
      const c = cfg3.contact || {};
      if (!c.gmailUser || !c.gmailAppPassword || c.gmailAppPassword === 'REPLACE_WITH_YOUR_APP_PASSWORD') {
        return json(res, 400, { error: 'Gmail not configured. Set credentials in Settings → Email & Contact.' });
      }
    }

    const jobId = Math.random().toString(36).slice(2, 12);
    inviteJobs.set(jobId, {
      status: 'running', total: guestIds.length, processed: 0,
      sent: [], failed: [], skipped: [], current: null,
      dryRun: !!dryRun, emailType, startedAt: new Date().toISOString(), completedAt: null,
    });
    runInviteJob(jobId, guestIds, !!dryRun, Math.min(Math.max(0, Number(delayMs) || 1000), 30000), emailType);
    return json(res, 200, { jobId });
  }

  // ── GET /api/invites/job/:id ──────────────────────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/api/invites/job/')) {
    if (!checkAdmin(req, res)) return;
    const jobId = pathname.slice('/api/invites/job/'.length);
    const job   = inviteJobs.get(jobId);
    if (!job) return json(res, 404, { error: 'Job not found' });
    return json(res, 200, job);
  }


  // ── DELETE /api/rsvps/:id ─────────────────────────────────────────────────
  if (req.method === 'DELETE' && pathname.startsWith('/api/rsvps/')) {
    if (!checkAdmin(req, res)) return;
    const id   = parseInt(pathname.split('/').pop());
    const list = readRsvps().filter(r => r.id !== id);
    saveRsvps(list);
    return json(res, 200, { success: true });
  }

  // ── GET /api/guest/:token ─────────────────────────────────────────────────
  if (req.method === 'GET' && pathname.startsWith('/api/guest/')) {
    const token = pathname.replace('/api/guest/', '').split('?')[0];
    if (!token) return json(res, 400, { error: 'Token required.' });

    const guestsFile = path.join(DATA_DIR, 'guests.json');
    let guests = [];
    try { guests = JSON.parse(fs.readFileSync(guestsFile, 'utf8')); } catch { guests = []; }

    const guest = guests.find(g => g.token === token);
    if (!guest) return json(res, 404, { error: 'Invitation not found. Please check the link in your email.' });

    const rsvps   = readRsvps();
    const existing = rsvps.find(r => r.guestId === guest.id || r.token === token);

    return json(res, 200, {
      id:           guest.id,
      name:         guest.name,
      firstName:    guest.firstName || null,
      email:        guest.email,
      guestCount:   guest.guestCount || 1,
      kidsCount:    guest.kidsCount  || 0,
      events:       guest.events,
      isTest:       guest.isTest || false,
      alreadyRsvped: !!existing,
      rsvp:         existing || null,
    });
  }

  // ── POST /api/rsvp-token ──────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/rsvp-token') {
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch { return json(res, 400, { error: 'Invalid request body.' }); }

    const { token, events, hoodiesSizes, mailingAddress, dietary, message, eventGuests } = body;
    if (!token || !events || typeof events !== 'object') {
      return json(res, 400, { error: 'Token and event responses are required.' });
    }

    const guestsFile = path.join(DATA_DIR, 'guests.json');
    let guests = [];
    try { guests = JSON.parse(fs.readFileSync(guestsFile, 'utf8')); } catch { guests = []; }

    const guest = guests.find(g => g.token === token);
    if (!guest) return json(res, 404, { error: 'Invitation not found.' });

    const list      = readRsvps();
    const existingIdx = list.findIndex(r => r.guestId === guest.id || r.token === token);
    const attending = Object.values(events).some(Boolean);

    // Sanitise per-event guest counts — clamp to [0, guestCount]
    const maxInvited = guest.guestCount || 1;
    const safeEventGuests = {};
    if (attending && eventGuests && typeof eventGuests === 'object') {
      for (const [id, n] of Object.entries(eventGuests)) {
        const count = Number(n);
        safeEventGuests[id] = isNaN(count) ? 0 : Math.min(Math.max(0, count), maxInvited);
      }
    }
    // guests = max PAX across attending events (backward compat for CSV / admin table)
    const maxPax = attending
      ? Math.max(1, ...Object.values(safeEventGuests).filter(n => n > 0))
      : 0;

    const rsvp = {
      id:         existingIdx >= 0 ? list[existingIdx].id : nextId(),
      created_at: existingIdx >= 0 ? list[existingIdx].created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      guestId:    guest.id,
      token,
      name:       guest.name,
      email:      guest.email,
      events,             // { "1": true/false, "2": true/false, ... }
      attending,          // true if attending any event
      guests:       attending ? maxPax : 0,
      eventGuests:  attending ? safeEventGuests : {},
      hoodiesSizes:   attending && Array.isArray(hoodiesSizes) ? hoodiesSizes.map(s => String(s).trim()).filter(Boolean) : null,
      mailingAddress: mailingAddress ? String(mailingAddress).trim() : null,
      dietary:        dietary  ? String(dietary).trim() : null,
      message:    message  ? String(message).trim() : null,
    };

    if (existingIdx >= 0) list[existingIdx] = rsvp;
    else                  list.push(rsvp);
    saveRsvps(list);

    console.log(`[RSVP-TOKEN] ${rsvp.updated_at} — ${rsvp.name} (${rsvp.email}) — ${attending ? 'ATTENDING' : 'NOT ATTENDING'}`);

    // ── Notify hosts ──
    const cfg2 = readConfig();
    const notifyAddrs = cfg2.contact?.notifyEmails;
    if (notifyAddrs?.length && cfg2.contact?.gmailUser &&
        cfg2.contact?.gmailAppPassword !== 'REPLACE_WITH_YOUR_APP_PASSWORD') {
      try {
        const nm = require('nodemailer');
        const tr = nm.createTransport({ service: 'gmail',
          auth: { user: cfg2.contact.gmailUser, pass: cfg2.contact.gmailAppPassword } });
        const evtMap = Object.fromEntries((cfg2.events || []).map(e => [String(e.id), e.name]));
        const evtLines = Object.entries(events)
          .map(([id, att]) => {
            const pax = att && rsvp.eventGuests?.[id] ? ` — ${rsvp.eventGuests[id]} guest${rsvp.eventGuests[id] !== 1 ? 's' : ''}` : '';
            return `<div style="margin:4px 0;">${att ? '✅' : '❌'} ${evtMap[id] || `Event ${id}`}${pax}</div>`;
          })
          .join('');
        const hoodieStr = Array.isArray(rsvp.hoodiesSizes) && rsvp.hoodiesSizes.length
          ? rsvp.hoodiesSizes.join(', ')
          : null;
        const notifyHtml = `<p><strong>${rsvp.name}</strong> (${rsvp.email}) has submitted their RSVP.</p>
          <p>Status: ${attending ? '✅ ATTENDING' : '❌ NOT ATTENDING'}</p>
          <div style="margin:8px 0 8px 12px;">${evtLines}</div>
          ${rsvp.mailingAddress ? `<p>Mailing Address: ${rsvp.mailingAddress}</p>` : ''}
          ${hoodieStr ? `<p>Hoodie Sizes: ${hoodieStr}</p>` : ''}
          ${rsvp.dietary ? `<p>Dietary Notes: ${rsvp.dietary}</p>` : ''}
          ${rsvp.message ? `<p>Message: "${rsvp.message}"</p>` : ''}`;
        await tr.sendMail({
          from:    `"Alex's Bar Mitzvah" <${cfg2.contact.gmailUser}>`,
          to:      notifyAddrs.join(', '),
          subject: `RSVP ${attending ? '✅' : '❌'} — ${rsvp.name}`,
          html:    notifyHtml,
        });
        console.log(`[NOTIFY] Host notification sent for ${rsvp.name}`);
      } catch (e) {
        console.warn(`[NOTIFY] Host notification failed: ${e.message}`);
      }
    }

    // ── Confirmation email to guest ──
    if (guest.email && cfg2.contact?.gmailUser &&
        cfg2.contact?.gmailAppPassword !== 'REPLACE_WITH_YOUR_APP_PASSWORD') {
      try {
        const { buildRsvpConfirmationHtml, buildRsvpConfirmationText } = require('./lib/emails');
        const siteUrl     = cfg2.saveTheDate?.websiteUrl || 'https://rsvp.example.com';
        const confirmHtml = buildRsvpConfirmationHtml(guest, rsvp, cfg2, siteUrl);
        const confirmText = buildRsvpConfirmationText(guest, rsvp, cfg2);
        const nm2 = require('nodemailer');
        const tr2 = nm2.createTransport({ service: 'gmail',
          auth: { user: cfg2.contact.gmailUser, pass: cfg2.contact.gmailAppPassword } });
        await tr2.sendMail({
          from:    `"${cfg2.contact.fromName || 'Jordan & Taylor Sample'}" <${cfg2.contact.gmailUser}>`,
          to:      `"${guest.name}" <${guest.email}>`,
          replyTo: cfg2.contact.replyTo || cfg2.contact.fromEmail,
          subject: attending
            ? "Your RSVP is confirmed — Alex's Bar Mitzvah"
            : "We received your RSVP — Alex's Bar Mitzvah",
          html: confirmHtml,
          text: confirmText,
        });
        console.log(`[CONFIRM] Confirmation email sent to ${guest.email}`);
      } catch (e) {
        console.warn(`[CONFIRM] Confirmation email failed: ${e.message}`);
      }
    }

    return json(res, 200, { success: true, id: rsvp.id, updated: existingIdx >= 0 });
  }

  // ── GET /api/guests (admin — full guest list) ─────────────────────────────
  if (req.method === 'GET' && pathname === '/api/guests') {
    if (!checkAdmin(req, res)) return;
    const guestsFile = path.join(DATA_DIR, 'guests.json');
    let guests = [];
    try { guests = JSON.parse(fs.readFileSync(guestsFile, 'utf8')); } catch { guests = []; }
    return json(res, 200, { guests });
  }

  // ── POST /api/guests (admin — add a single guest) ────────────────────────
  if (req.method === 'POST' && pathname === '/api/guests') {
    if (!checkAdmin(req, res)) return;
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch { return json(res, 400, { error: 'Invalid JSON' }); }

    const { name, household, firstName, lastName, email, guestCount, kidsCount, events, notes } = body;
    if (!name || !email || !events || !events.length) {
      return json(res, 400, { error: 'name, email, and events are required.' });
    }

    const guestsFile = path.join(DATA_DIR, 'guests.json');
    let guests = [];
    try { guests = JSON.parse(fs.readFileSync(guestsFile, 'utf8')); } catch { guests = []; }

    // Check for duplicate email
    const dup = guests.find(g => g.email.toLowerCase() === String(email).toLowerCase().trim());
    if (dup) return json(res, 409, { error: 'A guest with that email already exists.' });

    // Generate unique token
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const usedTokens = new Set(guests.map(g => g.token));
    let token;
    do {
      token = Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (usedTokens.has(token));

    const realGuests = guests.filter(g => !g.isTest);
    const newId = `g_${String(realGuests.length + 1).padStart(4, '0')}`;

    const guest = {
      id:         newId,
      name:       String(name).trim(),
      household:  String(household || name).trim(),
      firstName:  firstName ? String(firstName).trim() : null,
      lastName:   lastName  ? String(lastName).trim()  : null,
      email:      String(email).trim().toLowerCase(),
      guestCount: parseInt(guestCount) || 1,
      kidsCount:  parseInt(kidsCount)  || 0,
      notes:      notes ? String(notes).trim() : null,
      events:     events.map(Number),
      token,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      emails:     { saveTheDate: null, invite: null, reminder: null, finalReminder: null, preEvent: null },
    };

    guests.push(guest);
    fs.writeFileSync(guestsFile, JSON.stringify(guests, null, 2), 'utf8');
    console.log(`[GUESTS] Added guest: ${guest.name} (${guest.email}) | token: ${token}`);
    return json(res, 200, { success: true, guest });
  }

  // ── GET /api/guests/export ────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/guests/export') {
    if (!checkAdmin(req, res)) return;
    const guestsFile = path.join(DATA_DIR, 'guests.json');
    const rsvpsFile2 = path.join(DATA_DIR, 'rsvps.json');
    let guests = [], rsvpsAll = [];
    try { guests   = JSON.parse(fs.readFileSync(guestsFile,  'utf8')); } catch { guests   = []; }
    try { rsvpsAll = JSON.parse(fs.readFileSync(rsvpsFile2, 'utf8')); } catch { rsvpsAll = []; }
    guests = guests.filter(g => !g.isTest);
    const cfg4 = readConfig();
    const allEvents = cfg4.events || [];
    const rsvpMap = Object.fromEntries(rsvpsAll.map(r => [r.guestId, r]));
    const q = v => `"${String(v || '').replace(/"/g, '""')}"`;
    const eventHeaders = allEvents.map(e => q(`${e.name} RSVP`));
    const header = [
      'Token','ID','Household','First Name','Last Name','Email',
      'Total Guests','Kids (Hoodies)','Invited Events','Notes',
      'Save-the-Date Sent','Invite Sent','Reminder Sent',
      'RSVP Status','RSVP Submitted','RSVP Last Updated',
      ...eventHeaders,
      'Attending Guest Count','Hoodie Sizes','Mailing Address','Dietary Notes','Message',
    ];
    const rows = guests.map(g => {
      const r = rsvpMap[g.id];
      const rsvpStatus  = r ? (r.attending ? 'Attending' : 'Not Attending') : 'No Response';
      const rsvpDate    = r?.created_at ? new Date(r.created_at).toLocaleDateString('en-US') : '';
      const rsvpUpdated = r?.updated_at ? new Date(r.updated_at).toLocaleDateString('en-US') : '';
      const perEvent    = allEvents.map(e => {
        if (!r) return 'No Response';
        const val = r.events?.[String(e.id)];
        return val === true ? 'Yes' : val === false ? 'No' : 'No Response';
      });
      return [
        g.token,
        g.id,
        q(g.household || g.name),
        q(g.firstName || ''),
        q(g.lastName  || ''),
        g.email,
        g.guestCount || 1,
        g.kidsCount  || 0,
        q((g.events || []).join(',')),
        q(g.notes || ''),
        g.emails?.saveTheDate ? new Date(g.emails.saveTheDate).toLocaleDateString('en-US') : '',
        g.emails?.invite      ? new Date(g.emails.invite).toLocaleDateString('en-US')      : '',
        g.emails?.reminder    ? new Date(g.emails.reminder).toLocaleDateString('en-US')    : '',
        rsvpStatus,
        rsvpDate,
        rsvpUpdated,
        ...perEvent,
        r?.guests ?? '',
        q(Array.isArray(r?.hoodiesSizes) ? r.hoodiesSizes.join(', ') : (r?.hoodiesSizes || '')),
        q(r?.mailingAddress || ''),
        q(r?.dietary || ''),
        q(r?.message || ''),
      ];
    });
    const csv = '﻿' + [header, ...rows].map(r => r.join(',')).join('\r\n');
    const date = new Date().toISOString().split('T')[0];
    res.writeHead(200, {
      'Content-Type'       : 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="alex-guests-${date}.csv"`,
    });
    return res.end(csv);
  }

  // ── POST /api/guests/import ───────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/guests/import') {
    if (!checkAdmin(req, res)) return;
    let csvText;
    try { csvText = await readBody(req); }
    catch { return json(res, 400, { error: 'Could not read request body.' }); }

    if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);

    // Minimal CSV parser (handles double-quoted fields with escaped quotes)
    function parseCSV(text) {
      const result = [];
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const row = []; let field = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQ) {
            if (ch === '"' && line[i+1] === '"') { field += '"'; i++; }
            else if (ch === '"') inQ = false;
            else field += ch;
          } else {
            if (ch === '"') inQ = true;
            else if (ch === ',') { row.push(field); field = ''; }
            else field += ch;
          }
        }
        row.push(field);
        result.push(row);
      }
      return result;
    }

    const rows = parseCSV(csvText);
    if (rows.length < 2) return json(res, 400, { error: 'CSV has no data rows.' });

    const hdr = rows[0].map(h => h.trim().toLowerCase());
    const col = {
      token:      hdr.indexOf('token'),
      household:  hdr.findIndex(h => h.includes('household')),
      firstName:  hdr.findIndex(h => h.includes('first')),
      lastName:   hdr.findIndex(h => h.includes('last')),
      email:      hdr.indexOf('email'),
      guestCount: hdr.findIndex(h => h.includes('total guests')),
      kidsCount:  hdr.findIndex(h => h.includes('kids')),
      events:     hdr.indexOf('events'),
      notes:      hdr.indexOf('notes'),
    };
    if (col.email === -1) return json(res, 400, { error: 'CSV must have an Email column.' });

    const guestsFile = path.join(DATA_DIR, 'guests.json');
    let guests = [];
    try { guests = JSON.parse(fs.readFileSync(guestsFile, 'utf8')); } catch { guests = []; }

    const realGuests = guests.filter(g => !g.isTest);
    const testGuests = guests.filter(g => g.isTest);
    const byToken    = new Map(realGuests.map(g => [g.token, g]));
    const byEmail    = new Map(realGuests.map(g => [g.email.toLowerCase(), g]));
    const usedTokens = new Set(guests.map(g => g.token));

    const chars2 = 'abcdefghijklmnopqrstuvwxyz0123456789';
    function mkToken2() {
      let t;
      do { t = Array.from({length:16}, () => chars2[Math.floor(Math.random()*chars2.length)]).join(''); }
      while (usedTokens.has(t));
      usedTokens.add(t); return t;
    }

    let created = 0, updated = 0, skipped = 0;
    const get = (row, idx) => idx >= 0 ? String(row[idx] || '').trim() : '';

    for (let i = 1; i < rows.length; i++) {
      const row      = rows[i];
      const email    = get(row, col.email).toLowerCase();
      if (!email || !email.includes('@')) { skipped++; continue; }

      const tokenVal   = get(row, col.token);
      const household  = get(row, col.household);
      const firstName  = get(row, col.firstName);
      const lastName   = get(row, col.lastName);
      const name       = [firstName, lastName].filter(Boolean).join(' ') || household || email;
      const guestCount = parseInt(get(row, col.guestCount)) || 1;
      const kidsCount  = parseInt(get(row, col.kidsCount))  || 0;
      const notes      = get(row, col.notes) || null;
      const eventsRaw  = get(row, col.events);
      const events     = eventsRaw ? eventsRaw.split(',').map(Number).filter(Boolean) : [];

      const existing = (tokenVal && byToken.get(tokenVal)) || byEmail.get(email);

      if (existing) {
        if (name)       existing.name       = name;
        if (household)  existing.household  = household;
        if (firstName)  existing.firstName  = firstName;
        if (lastName)   existing.lastName   = lastName;
        existing.guestCount = guestCount;
        existing.kidsCount  = kidsCount;
        if (notes !== null) existing.notes  = notes || null;
        if (events.length)  existing.events = events;
        existing.updated_at = new Date().toISOString();
        updated++;
      } else {
        if (!events.length) { skipped++; continue; }
        const newGuest = {
          id:         `g_${String(realGuests.length + created + 1).padStart(4, '0')}`,
          name, household: household || name,
          firstName: firstName || null, lastName: lastName || null,
          email, guestCount, kidsCount,
          notes: notes || null, events,
          token:      mkToken2(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          emails:     { saveTheDate: null, invite: null, reminder: null, finalReminder: null, preEvent: null },
        };
        realGuests.push(newGuest);
        byEmail.set(email, newGuest);
        created++;
      }
    }

    fs.writeFileSync(guestsFile, JSON.stringify([...realGuests, ...testGuests], null, 2), 'utf8');
    console.log(`[GUESTS] Import: ${created} created, ${updated} updated, ${skipped} skipped`);
    return json(res, 200, { success: true, created, updated, skipped });
  }

  // ── GET /api/guests/sheet-diff ───────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/guests/sheet-diff') {
    if (!checkAdmin(req, res)) return;
    const cfg2     = readConfig();
    const sheetId  = cfg2.guestSheetId || '1hoZ8D_RRgO3IjsWI5FpzwvBbOCgXVVMC';
    let csvText;
    try { csvText = await httpsGet(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`); }
    catch (e) { return json(res, 502, { error: `Could not reach Google Sheets: ${e.message}` }); }

    const sheetGuests = parseSheetGuests(csvText);
    if (!sheetGuests) return json(res, 400, { error: 'Could not parse the sheet. Make sure it is shared as "Anyone with the link can view".' });

    const guestsFile = path.join(DATA_DIR, 'guests.json');
    let existingGuests = [];
    try { existingGuests = JSON.parse(fs.readFileSync(guestsFile, 'utf8')); } catch { existingGuests = []; }
    const realGuests = existingGuests.filter(g => !g.isTest);
    const byEmail    = new Map(realGuests.map(g => [g.email.toLowerCase(), g]));

    const added = [], changed = [];
    let unchanged = 0;
    for (const sg of sheetGuests) {
      const ex = byEmail.get(sg.email);
      const name = [sg.firstName, sg.lastName].filter(Boolean).join(' ') || sg.household;
      if (!ex) {
        added.push({ name, household: sg.household, email: sg.email,
          guestCount: sg.guestCount, kidsCount: sg.kidsCount, events: sg.events });
      } else {
        const diffs = [];
        if (ex.guestCount !== sg.guestCount) diffs.push(`Guests: ${ex.guestCount} → ${sg.guestCount}`);
        if ((ex.kidsCount||0) !== sg.kidsCount) diffs.push(`Kids: ${ex.kidsCount||0} → ${sg.kidsCount}`);
        if (JSON.stringify(ex.events||[]) !== JSON.stringify(sg.events)) diffs.push(`Events: [${ex.events}] → [${sg.events}]`);
        if (sg.household && ex.household !== sg.household) diffs.push(`Household: "${ex.household}" → "${sg.household}"`);
        if (sg.firstName != null && ex.firstName !== sg.firstName) diffs.push(`First: "${ex.firstName||''}" → "${sg.firstName}"`);
        if (sg.lastName  != null && ex.lastName  !== sg.lastName)  diffs.push(`Last: "${ex.lastName||''}"  → "${sg.lastName}"`);
        if (sg.notes !== (ex.notes||null) && sg.notes !== null) diffs.push(`Notes changed`);
        if (diffs.length) changed.push({ name: ex.name, email: ex.email, diffs });
        else unchanged++;
      }
    }
    return json(res, 200, { sheetTotal: sheetGuests.length, added, changed, unchangedCount: unchanged });
  }

  // ── POST /api/guests/sheet-sync ──────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/guests/sheet-sync') {
    if (!checkAdmin(req, res)) return;
    const cfg2    = readConfig();
    const sheetId = cfg2.guestSheetId || '1hoZ8D_RRgO3IjsWI5FpzwvBbOCgXVVMC';
    let csvText;
    try { csvText = await httpsGet(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`); }
    catch (e) { return json(res, 502, { error: `Could not reach Google Sheets: ${e.message}` }); }

    const sheetGuests = parseSheetGuests(csvText);
    if (!sheetGuests) return json(res, 400, { error: 'Could not parse the sheet.' });

    const guestsFile = path.join(DATA_DIR, 'guests.json');
    let existingGuests = [];
    try { existingGuests = JSON.parse(fs.readFileSync(guestsFile, 'utf8')); } catch { existingGuests = []; }
    const realGuests = existingGuests.filter(g => !g.isTest);
    const testGuests = existingGuests.filter(g => g.isTest);
    const byEmail    = new Map(realGuests.map(g => [g.email.toLowerCase(), g]));
    const usedTokens = new Set(existingGuests.map(g => g.token));

    const charsX = 'abcdefghijklmnopqrstuvwxyz0123456789';
    function mkTokenX() {
      let t;
      do { t = Array.from({length:16}, () => charsX[Math.floor(Math.random()*charsX.length)]).join(''); }
      while (usedTokens.has(t));
      usedTokens.add(t); return t;
    }

    let created = 0, updated = 0;
    for (const sg of sheetGuests) {
      const name = [sg.firstName, sg.lastName].filter(Boolean).join(' ') || sg.household;
      const ex   = byEmail.get(sg.email);
      if (!ex) {
        const ng = {
          id: `g_${String(realGuests.length + 1).padStart(4, '0')}`,
          name, household: sg.household, firstName: sg.firstName, lastName: sg.lastName,
          email: sg.email, guestCount: sg.guestCount, kidsCount: sg.kidsCount,
          notes: sg.notes, events: sg.events, token: mkTokenX(),
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          emails: { saveTheDate: null, invite: null, reminder: null, finalReminder: null, preEvent: null },
        };
        realGuests.push(ng);
        byEmail.set(sg.email, ng);
        created++;
      } else {
        if (name)         ex.name       = name;
        if (sg.household) ex.household  = sg.household;
        ex.firstName  = sg.firstName;
        ex.lastName   = sg.lastName;
        ex.guestCount = sg.guestCount;
        ex.kidsCount  = sg.kidsCount;
        ex.events     = sg.events;
        ex.notes      = sg.notes || null;
        ex.updated_at = new Date().toISOString();
        updated++;
      }
    }
    realGuests.forEach((g, i) => { g.id = `g_${String(i + 1).padStart(4, '0')}`; });
    fs.writeFileSync(guestsFile, JSON.stringify([...realGuests, ...testGuests], null, 2), 'utf8');
    console.log(`[SHEET-SYNC] Created: ${created}, Updated: ${updated}`);
    return json(res, 200, { success: true, created, updated });
  }

  // ── DELETE /api/guests/:id (admin — remove a guest) ──────────────────────
  if (req.method === 'DELETE' && pathname.startsWith('/api/guests/')) {
    if (!checkAdmin(req, res)) return;
    const guestId    = pathname.split('/').pop();
    const guestsFile = path.join(DATA_DIR, 'guests.json');
    let guests = [];
    try { guests = JSON.parse(fs.readFileSync(guestsFile, 'utf8')); } catch { guests = []; }
    const deletedGuest = guests.find(g => g.id === guestId);
    if (!deletedGuest) return json(res, 404, { error: 'Guest not found.' });
    guests = guests.filter(g => g.id !== guestId);
    fs.writeFileSync(guestsFile, JSON.stringify(guests, null, 2), 'utf8');
    // Remove any RSVP entries for this guest so stale data can't resurface if
    // the ID gets recycled when the guest is re-added.
    const rsvps = readRsvps();
    const cleanedRsvps = rsvps.filter(r => r.guestId !== guestId && r.token !== deletedGuest.token);
    if (cleanedRsvps.length !== rsvps.length) saveRsvps(cleanedRsvps);
    return json(res, 200, { success: true });
  }

  // ── POST /api/send-email (admin — send one email to one guest) ────────────
  if (req.method === 'POST' && pathname === '/api/send-email') {
    if (!checkAdmin(req, res)) return;
    let body;
    try { body = JSON.parse(await readBody(req)); }
    catch { return json(res, 400, { error: 'Invalid JSON' }); }

    const { guestId, type } = body;  // type: 'saveTheDate' | 'invite' | 'reminder'
    if (!guestId || !type) return json(res, 400, { error: 'guestId and type are required.' });
    if (!['saveTheDate', 'invite', 'reminder'].includes(type)) {
      return json(res, 400, { error: 'type must be saveTheDate, invite, or reminder.' });
    }

    const guestsFile = path.join(DATA_DIR, 'guests.json');
    let guests = [];
    try { guests = JSON.parse(fs.readFileSync(guestsFile, 'utf8')); } catch { guests = []; }

    const guestIdx = guests.findIndex(g => g.id === guestId);
    if (guestIdx === -1) return json(res, 404, { error: 'Guest not found.' });
    const guest = guests[guestIdx];

    const cfg = readConfig();
    if (!cfg.contact?.gmailUser || !cfg.contact?.gmailAppPassword ||
        cfg.contact.gmailAppPassword === 'REPLACE_WITH_YOUR_APP_PASSWORD') {
      return json(res, 503, { error: 'Gmail not configured. Add your App Password in Settings.' });
    }

    // Use shared email library (loaded lazily)
    let emailLib;
    try { emailLib = require('./lib/emails.js'); }
    catch (e) { return json(res, 500, { error: 'Email library not found. Run npm install first.' }); }

    const siteUrl = (cfg.saveTheDate?.websiteUrl || 'https://rsvp.example.com').replace(/\/$/, '');
    const rsvpUrl = `${siteUrl}/rsvp/${guest.token}`;

    let subject, html, text;
    if (type === 'saveTheDate') {
      subject = cfg.saveTheDate?.subject || "Save the Date — Alex's Bar Mitzvah";
      html    = emailLib.buildSaveTheDateHtml(guest, cfg);
      text    = emailLib.buildSaveTheDateText(guest, cfg);
    } else if (type === 'invite') {
      subject = cfg.emailTemplates?.invitation?.subject || "You're invited — Alex's Bar Mitzvah";
      html    = emailLib.buildInviteHtml(guest, cfg, siteUrl);
      text    = emailLib.buildInviteText(guest, cfg, siteUrl);
    } else {
      subject = cfg.emailTemplates?.reminder?.subject || 'Reminder — Alex\'s Bar Mitzvah RSVP';
      html    = emailLib.buildReminderHtml(guest, cfg, siteUrl);
      text    = null;
    }

    try {
      await emailLib.sendEmail({ to: guest.email, name: guest.name, subject, html, text }, cfg);
      // Record send timestamp
      if (!guests[guestIdx].emails) guests[guestIdx].emails = {};
      guests[guestIdx].emails[type]    = new Date().toISOString();
      guests[guestIdx].updated_at = new Date().toISOString();
      fs.writeFileSync(guestsFile, JSON.stringify(guests, null, 2), 'utf8');
      console.log(`[EMAIL] Sent ${type} → ${guest.name} (${guest.email})`);
      return json(res, 200, { success: true, sentAt: guests[guestIdx].emails[type] });
    } catch (err) {
      console.error(`[EMAIL] Failed to send ${type} to ${guest.email}:`, err.message);
      return json(res, 500, { error: `Email failed: ${err.message}` });
    }
  }

  // ── Static files ──────────────────────────────────────────────────────────
  // /rsvp/:token  → rsvp.html (client-side JS reads the token from the URL)
  if (pathname === '/rsvp' || pathname.startsWith('/rsvp/')) {
    return serveFile(res, path.join(PUBLIC_DIR, 'rsvp.html'));
  }

  // /admin → admin.html (no auth on the HTML itself; JS handles auth for data)
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  // If no extension, try index.html
  if (!path.extname(filePath)) {
    filePath = path.join(PUBLIC_DIR, pathname.replace(/\/?$/, '') + '.html');
  }

  serveFile(res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ✡  Alex Sample — Bar Mitzvah · August 22, 2026');
  console.log('  ────────────────────────────────────────────────────');
  console.log(`  Site:         http://0.0.0.0:${PORT}`);
  console.log(`  Admin:        http://localhost:${PORT}/admin`);
  console.log('');
  console.log('  Tip: set ADMIN_TOKEN env variable to change the admin password.');
  console.log('  Example: ADMIN_TOKEN=mypassword node server.js');
  console.log('');
});
