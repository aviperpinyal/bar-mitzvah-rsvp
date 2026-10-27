/* ═══════════════════════════════════════════════════════
   Alex's Bar Mitzvah — Admin Settings Script
   ═══════════════════════════════════════════════════════ */
'use strict';

let adminToken = '';
let cfg = {};  // live copy of config

const EVENT_NAMES = {1:'Shabbat Services & Dinner', 2:'Bar Mitzvah Service & Luncheon', 3:'Evening Celebration', 4:'Morning After Breakfast'};

/* ── Auth ──────────────────────────────────────────────── */
const saved = localStorage.getItem('alex_admin_token');
if (saved) { adminToken = saved; bootApp(); }
else { document.getElementById('login-screen').style.display = 'flex'; }

document.getElementById('login-btn').addEventListener('click', tryLogin);
document.getElementById('token-input').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });

async function tryLogin() {
  const token = document.getElementById('token-input').value.trim();
  if (!token) return;
  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Checking…';
  document.getElementById('login-err').style.display = 'none';
  try {
    const res = await apiFetch('/api/config', 'GET', null, token);
    if (res.ok) {
      adminToken = token;
      localStorage.setItem('alex_admin_token', token);
      cfg = await res.json();
      showApp();
    } else {
      document.getElementById('login-err').style.display = 'block';
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  } catch {
    document.getElementById('login-err').textContent = 'Server unreachable.';
    document.getElementById('login-err').style.display = 'block';
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

async function bootApp() {
  try {
    const res = await apiFetch('/api/config');
    if (!res.ok) { localStorage.removeItem('alex_admin_token'); document.getElementById('login-screen').style.display = 'flex'; return; }
    cfg = await res.json();
    showApp();
  } catch { localStorage.removeItem('alex_admin_token'); document.getElementById('login-screen').style.display = 'flex'; }
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  buildUI();
  populateFields();
}

/* ── Tab navigation ────────────────────────────────────── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

/* ── Build dynamic sections ────────────────────────────── */
function buildUI() {
  buildEvents();
  buildReminders();
  buildUpdates();
  buildTestCases();
  buildPreEventGroups();
}

function buildPreEventGroups() {
  // Ensure the groups array exists with the right shape
  const pre = ((cfg.emailTemplates = cfg.emailTemplates || {}).preEvent = cfg.emailTemplates.preEvent || {});
  if (!Array.isArray(pre.groups) || pre.groups.length < 2) {
    pre.groups = [
      { label: 'Full Weekend', ifAnyEventIn: [3, 4], subject: '', body: '' },
      { label: 'Service Only', ifAnyEventIn: [1, 2], subject: '', body: '' },
    ];
  }

  // Index 0 = Full Weekend, Index 1 = Service Only (matches config order)
  const fields = [
    { subjectId: 'preEvent-group-full-subject',    bodyId: 'preEvent-group-full-body',    idx: 0 },
    { subjectId: 'preEvent-group-service-subject', bodyId: 'preEvent-group-service-body', idx: 1 },
  ];

  fields.forEach(({ subjectId, bodyId, idx }) => {
    const subjectEl = document.getElementById(subjectId);
    const bodyEl    = document.getElementById(bodyId);
    if (subjectEl) {
      subjectEl.value = pre.groups[idx].subject || '';
      subjectEl.addEventListener('input', () => { pre.groups[idx].subject = subjectEl.value; markDirty(); });
    }
    if (bodyEl) {
      bodyEl.value = pre.groups[idx].body || '';
      bodyEl.addEventListener('input', () => { pre.groups[idx].body = bodyEl.value; markDirty(); });
    }
  });
}

function buildEvents() {
  const container = document.getElementById('events-list');
  const events = cfg.events || [];
  container.innerHTML = events.map((ev, i) => `
    <div class="card event-block-wrap" data-event-index="${i}">
      <div class="event-block-header">
        <span class="event-block-icon">${ev.emoji || '📅'}</span>
        <div>
          <div class="event-block-title">Event ${i+1}: ${ev.name}</div>
          <div class="event-block-date">${ev.displayDate}</div>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>Event Name</label><input type="text" data-ev="${i}" data-key="name" value="${esc(ev.name)}"></div>
        <div class="field"><label>Short Name (internal)</label><input type="text" data-ev="${i}" data-key="shortName" value="${esc(ev.shortName)}"></div>
      </div>
      <div class="field-row thirds">
        <div class="field"><label>Date</label><input type="date" data-ev="${i}" data-key="isoDate" value="${ev.isoDate||''}"></div>
        <div class="field"><label>Display Date (written out)</label><input type="text" data-ev="${i}" data-key="displayDate" value="${esc(ev.displayDate)}"></div>
        <div class="field"><label>Start Time</label><input type="time" data-ev="${i}" data-key="time" value="${timeToInput(ev.time)}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Venue Name</label><input type="text" data-ev="${i}" data-key="venueName" value="${esc(ev.venueName)}"></div>
        <div class="field"><label>Address</label><input type="text" data-ev="${i}" data-key="address" value="${esc(ev.address)}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Dress Code</label><input type="text" data-ev="${i}" data-key="dressCode" value="${esc(ev.dressCode)}"></div>
        <div class="field"><label>City / Town</label><input type="text" data-ev="${i}" data-key="city" value="${esc(ev.city)}"></div>
      </div>
      <div class="field-row full">
        <div class="field"><label>Description (shown to guests)</label><textarea data-ev="${i}" data-key="description">${esc(ev.description)}</textarea></div>
      </div>
      <div class="field-row full">
        <div class="field"><label>Additional Notes (optional)</label><textarea data-ev="${i}" data-key="additionalNotes" style="min-height:60px">${esc(ev.additionalNotes||'')}</textarea></div>
      </div>
    </div>
  `).join('');

  // Bind event fields
  container.querySelectorAll('[data-ev]').forEach(el => {
    el.addEventListener('change', () => {
      const i = parseInt(el.dataset.ev);
      const key = el.dataset.key;
      cfg.events[i][key] = el.value;
      // Sync displayDate label
      if (key === 'isoDate') {
        const dateEl = container.querySelector(`[data-ev="${i}"][data-key="displayDate"]`);
        if (dateEl && !dateEl.value) {
          dateEl.value = formatDateDisplay(el.value);
          cfg.events[i]['displayDate'] = dateEl.value;
        }
      }
      markDirty();
    });
  });
}

function buildReminders() {
  const container = document.getElementById('reminders-list');
  const reminders = cfg.reminders || [];
  container.innerHTML = reminders.map((r, i) => `
    <div class="reminder-row">
      <div class="field"><label>${r.label}</label><input type="date" data-rem="${i}" data-key="sendDate" value="${r.sendDate||''}"></div>
      <div class="field"><label>Description</label><input type="text" data-rem="${i}" data-key="description" value="${esc(r.description)}"></div>
      <div>
        <label>Enabled</label>
        <label class="toggle" style="margin-top:8px;display:block">
          <input type="checkbox" data-rem-bool="${i}" data-key="enabled" ${r.enabled ? 'checked':''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-rem]').forEach(el => {
    el.addEventListener('change', () => {
      cfg.reminders[parseInt(el.dataset.rem)][el.dataset.key] = el.value;
      markDirty();
    });
  });
  container.querySelectorAll('[data-rem-bool]').forEach(el => {
    el.addEventListener('change', () => {
      cfg.reminders[parseInt(el.dataset.remBool)][el.dataset.key] = el.checked;
      markDirty();
    });
  });
}

function buildUpdates() {
  const container = document.getElementById('updates-list');
  const updates = cfg.preEventUpdates || [];
  container.innerHTML = updates.map((u, i) => `
    <div class="reminder-row">
      <div class="field"><label>${u.label}</label>
        <div style="display:flex;align-items:center;gap:8px">
          <input type="number" data-upd="${i}" data-key="daysBeforeEvent" value="${u.daysBeforeEvent||5}" min="1" max="30" style="width:70px">
          <span style="font-size:12px;color:var(--light)">days before event</span>
        </div>
      </div>
      <div class="field"><label>Description</label><input type="text" data-upd="${i}" data-key="description" value="${esc(u.description)}"></div>
      <div>
        <label>Enabled</label>
        <label class="toggle" style="margin-top:8px;display:block">
          <input type="checkbox" data-upd-bool="${i}" data-key="enabled" ${u.enabled ? 'checked':''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-upd]').forEach(el => {
    el.addEventListener('change', () => {
      const val = el.type === 'number' ? parseInt(el.value) : el.value;
      cfg.preEventUpdates[parseInt(el.dataset.upd)][el.dataset.key] = val;
      markDirty();
    });
  });
  container.querySelectorAll('[data-upd-bool]').forEach(el => {
    el.addEventListener('change', () => {
      cfg.preEventUpdates[parseInt(el.dataset.updBool)][el.dataset.key] = el.checked;
      markDirty();
    });
  });
}

function buildTestCases() {
  // Populate event checkboxes from live config
  const container = document.getElementById('test-event-checkboxes');
  if (!container) return;
  const events = cfg.events || [];
  container.innerHTML = events.map(e => `
    <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--dark);cursor:pointer;padding:6px 12px;border:1.5px solid var(--border);border-radius:8px;user-select:none;">
      <input type="checkbox" data-test-event="${e.id}" checked style="accent-color:#B85C38;width:15px;height:15px;">
      ${e.emoji ? e.emoji + ' ' : ''}${e.name}
    </label>
  `).join('');
}

/* ── Populate all simple data-cfg fields ────────────────── */
function populateFields() {
  // Text / date / url / email fields
  document.querySelectorAll('[data-cfg]').forEach(el => {
    const val = getPath(cfg, el.dataset.cfg);
    if (val !== undefined) el.value = val;
    el.addEventListener('change', () => { setPath(cfg, el.dataset.cfg, el.value); markDirty(); });
  });

  // Boolean toggles
  document.querySelectorAll('[data-cfg-bool]').forEach(el => {
    const val = getPath(cfg, el.dataset.cfgBool);
    if (val !== undefined) el.checked = Boolean(val);
    el.addEventListener('change', () => { setPath(cfg, el.dataset.cfgBool, el.checked); markDirty(); });
  });

  // Array fields (comma-separated)
  document.querySelectorAll('[data-cfg-array]').forEach(el => {
    const val = getPath(cfg, el.dataset.cfgArray);
    if (Array.isArray(val)) el.value = val.join(', ');
    el.addEventListener('change', () => {
      setPath(cfg, el.dataset.cfgArray, el.value.split(',').map(s => s.trim()).filter(Boolean));
      markDirty();
    });
  });
}

/* ── Save all ──────────────────────────────────────────── */
let dirty = false;
function markDirty() { dirty = true; setStatus('Unsaved changes', ''); }

document.getElementById('save-all-btn').addEventListener('click', saveAll);

async function saveAll() {
  const btn = document.getElementById('save-all-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const res = await apiFetch('/api/config', 'POST', cfg);
    if (res.ok) {
      dirty = false;
      setStatus('All changes saved ✓', 'saved');
      btn.textContent = 'Save All Changes';
      btn.disabled = false;
      setTimeout(() => setStatus('', ''), 4000);
    } else {
      setStatus('Save failed — try again', 'error');
      btn.textContent = 'Save All Changes';
      btn.disabled = false;
    }
  } catch {
    setStatus('Server unreachable', 'error');
    btn.disabled = false; btn.textContent = 'Save All Changes';
  }
}

function setStatus(msg, cls) {
  const el = document.getElementById('global-status');
  el.textContent = msg;
  el.className = 'save-status' + (cls ? ' ' + cls : '');
}

/* ── Test Gmail Connection ─────────────────────────────── */
async function testGmailConnection() {
  const btn    = document.getElementById('test-connection-btn');
  const result = document.getElementById('test-connection-result');
  btn.disabled = true;
  btn.textContent = 'Testing…';
  result.style.display = 'none';

  // Save current settings first so the server reads the latest credentials
  await apiFetch('/api/config', 'POST', cfg);

  try {
    const res  = await apiFetch('/api/test-connection', 'POST', {});
    const data = await res.json();
    result.style.display = '';
    if (res.ok && data.success) {
      result.textContent = '✓ ' + data.message;
      result.style.color = '#2E7D32';
    } else {
      result.textContent = '✗ ' + (data.error || 'Connection failed');
      result.style.color = '#C62828';
    }
  } catch (e) {
    result.style.display = '';
    result.textContent = '✗ Server error: ' + e.message;
    result.style.color = '#C62828';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Test Gmail Connection';
  }
}

/* ── Test email send ───────────────────────────────────── */
function emailLog(msg) {
  const wrap = document.getElementById('email-log-wrap');
  const log  = document.getElementById('email-log');
  if (!wrap || !log) return;
  wrap.style.display = '';
  const ts = new Date().toLocaleTimeString();
  log.textContent += `[${ts}] ${msg}\n`;
  log.scrollTop = log.scrollHeight;
}

function showResult(el, msg, isErr) {
  el.textContent = msg;
  el.className = 'test-result' + (isErr ? ' err' : '');
  el.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
  const btn    = document.getElementById('btn-send-test');
  const result = document.getElementById('test-unified-result');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const email     = document.getElementById('test-send-to')?.value?.trim();
    const emailType = document.getElementById('test-email-type')?.value || 'invite';
    const guests    = parseInt(document.getElementById('test-guest-count')?.value) || 2;
    const kids      = parseInt(document.getElementById('test-kids-count')?.value)  || 0;
    const checkedEvents = [...document.querySelectorAll('[data-test-event]:checked')]
      .map(el => parseInt(el.dataset.testEvent));

    if (!email)                { showResult(result, 'Enter an email address first', true); return; }
    if (!checkedEvents.length) { showResult(result, 'Select at least one event', true); return; }

    btn.disabled = true; btn.textContent = 'Sending…';
    result.style.display = 'none';

    emailLog(`Sending test "${emailType}" to ${email} (events: ${checkedEvents.join(', ')})…`);
    try {
      const res  = await apiFetch('/api/test-send', 'POST', {
        testCaseId:  `test_${emailType}`,
        sendTo:      email,
        events:      checkedEvents,
        guestCount:  guests,
        kidsCount:   kids,
        emailType,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        emailLog(`✓ ${data.emailResult || 'Done'}`);
        if (data.rsvpUrl) emailLog(`RSVP link: ${data.rsvpUrl}`);
        showResult(result, `✓ ${data.emailResult || 'Sent!'}`, false);
      } else {
        emailLog(`✗ ${data.error || 'Failed'}`);
        showResult(result, data.error || 'Failed', true);
      }
    } catch (e) {
      emailLog(`✗ Server error: ${e.message}`);
      showResult(result, 'Server error: ' + e.message, true);
    } finally {
      btn.disabled = false; btn.textContent = 'Send Test Email ↗';
    }
  });
});

/* ── Helpers ───────────────────────────────────────────── */
function apiFetch(url, method = 'GET', body = null, token = null) {
  const t = token || adminToken;
  const opts = {
    method,
    headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts);
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}
function setPath(obj, path, val) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]]) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = val;
}

function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function timeToInput(t) {
  if (!t) return '';
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!m) return '';
  let h = parseInt(m[1]), min = m[2];
  if (m[3]?.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[3]?.toUpperCase() === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2,'0')}:${min}`;
}

function formatDateDisplay(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

function togglePass() {
  const el = document.getElementById('app-pass-input');
  const btn = el.nextElementSibling;
  if (el.type === 'password') { el.type = 'text'; btn.textContent = 'Hide'; }
  else { el.type = 'password'; btn.textContent = 'Show'; }
}

// Warn before leaving with unsaved changes
window.addEventListener('beforeunload', e => {
  if (dirty) { e.preventDefault(); e.returnValue = ''; }
});
