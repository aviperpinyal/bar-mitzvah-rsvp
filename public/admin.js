/* ═══════════════════════════════════════════════════════
   Alex's Bar Mitzvah — Admin Dashboard Script
   ═══════════════════════════════════════════════════════ */

'use strict';

const EVENT_DATE = new Date('2026-08-22T18:30:00');

let allRsvps   = [];
let allEvents  = [];   // from site-config
let adminToken = '';

/* ── Auth ──────────────────────────────────────────────── */
const loginScreen = document.getElementById('login-screen');
const dashboard   = document.getElementById('dashboard');
const tokenInput  = document.getElementById('token-input');
const loginBtn    = document.getElementById('login-btn');
const loginError  = document.getElementById('login-error');

// Restore session
const saved = localStorage.getItem('alex_admin_token');
if (saved) { adminToken = saved; showDashboard(); }
else { loginScreen.style.display = 'flex'; }

loginBtn.addEventListener('click', tryLogin);
tokenInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });

async function tryLogin() {
  const token = tokenInput.value.trim();
  if (!token) return;

  loginBtn.disabled    = true;
  loginBtn.textContent = 'Checking…';
  loginError.style.display = 'none';

  try {
    const res = await fetch('/api/rsvps', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      adminToken = token;
      localStorage.setItem('alex_admin_token', token);
      const data = await res.json();
      await loadEvents();
      populate(data);
      loginScreen.style.display = 'none';
      dashboard.classList.add('visible');
    } else {
      loginError.style.display = 'block';
      loginBtn.disabled    = false;
      loginBtn.textContent = 'Sign In';
    }
  } catch {
    loginError.textContent = 'Server unreachable. Is the server running?';
    loginError.style.display = 'block';
    loginBtn.disabled    = false;
    loginBtn.textContent = 'Sign In';
  }
}

async function showDashboard() {
  try {
    const [rsvpRes] = await Promise.all([
      fetch('/api/rsvps', { headers: { 'Authorization': `Bearer ${adminToken}` } }),
      loadEvents(),
    ]);
    if (!rsvpRes.ok) { localStorage.removeItem('alex_admin_token'); loginScreen.style.display = 'flex'; return; }
    const data = await rsvpRes.json();
    loginScreen.style.display = 'none';
    dashboard.classList.add('visible');
    populate(data);
  } catch {
    localStorage.removeItem('alex_admin_token');
    loginScreen.style.display = 'flex';
  }
}

async function loadEvents() {
  try {
    const res = await fetch('/api/site-config');
    if (res.ok) {
      const cfg = await res.json();
      allEvents = cfg.events || [];
    }
  } catch { /* non-fatal */ }
}

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('alex_admin_token');
  location.reload();
});

/* ── Populate dashboard ────────────────────────────────── */
function populate({ stats, rsvps }) {
  allRsvps = rsvps;

  // Main stats
  document.getElementById('s-total').textContent     = stats.total;
  document.getElementById('s-attending').textContent  = stats.attending;
  document.getElementById('s-not').textContent       = stats.notAttending;
  document.getElementById('s-guests').textContent    = stats.totalGuests;

  const daysLeft = Math.max(0, Math.ceil((EVENT_DATE - new Date()) / (1000 * 60 * 60 * 24)));
  document.getElementById('s-pending').textContent   = daysLeft;

  // Per-event headcounts (from new token-based RSVPs)
  renderEventCounts(stats.eventCounts || {});

  // Table
  renderTable(rsvps);
}

/* ── SVG icon helper (matches rsvp.js icon set) ─────────────── */
const ADMIN_ICONS = {
  '✡':  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,3 14.6,7.5 19.8,7.5 17.2,12 19.8,16.5 14.6,16.5 12,21 9.4,16.5 4.2,16.5 6.8,12 4.2,7.5 9.4,7.5"/></svg>`,
  '🕍': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h7a3 3 0 013 3v13a2.5 2.5 0 00-2.5-2.5H2V4z"/><path d="M22 4h-7a3 3 0 00-3 3v13a2.5 2.5 0 012.5-2.5H22V4z"/></svg>`,
  '🌅': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z"/></svg>`,
  '☕': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><path d="M6 2v2M10 2v2M14 2v2"/></svg>`,
};
function adminIcon(emoji) {
  return ADMIN_ICONS[emoji] || ADMIN_ICONS['✡'];
}

/* ── Per-event headcount row ───────────────────────────── */
function renderEventCounts(eventCounts) {
  const container = document.getElementById('event-counts-row');
  if (!container) return;

  if (!allEvents.length || !Object.keys(eventCounts).length) {
    container.style.display = 'none';
    return;
  }

  // Fix: must explicitly set flex — CSS defines display:flex but inline
  // style="display:none" on the element overrides until we clear it here.
  container.style.display = 'flex';
  container.innerHTML = allEvents.map(evt => {
    const counts = eventCounts[String(evt.id)] || { attending: 0, notAttending: 0, guests: 0 };
    const paxStr = counts.guests > 0 ? `<span class="ec-pax">${counts.guests} guests</span>` : '';
    return `
      <div class="event-count-chip">
        <div class="event-count-icon">${adminIcon(evt.emoji)}</div>
        <div class="event-count-info">
          <div class="event-count-name">${evt.shortName || evt.name}</div>
          <div class="event-count-nums">
            <span class="ec-yes">${counts.attending} going</span>
            ${paxStr}
            <span class="ec-no">${counts.notAttending} regrets</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ── Table ─────────────────────────────────────────────── */
function renderTable(rsvps) {
  const loading = document.getElementById('table-loading');
  const table   = document.getElementById('rsvp-table');
  const empty   = document.getElementById('table-empty');
  const tbody   = document.getElementById('rsvp-body');

  loading.style.display = 'none';

  if (rsvps.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  table.style.display = '';
  empty.style.display = 'none';

  tbody.innerHTML = rsvps.map((r) => {
    const date = new Date(r.updated_at || r.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

    // Support both old format (attending: bool) and new (events: object)
    const isAttending = r.events
      ? Object.values(r.events).some(Boolean)
      : Boolean(r.attending);

    // Status column — show event chips if token-based, otherwise simple badge
    let statusHtml;
    if (r.events && allEvents.length) {
      statusHtml = allEvents
        .filter(e => r.events[String(e.id)] !== undefined)
        .map(e => {
          const att = r.events[String(e.id)];
          const pax = att && r.eventGuests && r.eventGuests[String(e.id)];
          const paxStr = pax > 1 ? ` ×${pax}` : '';
          return `<span class="event-chip ${att ? 'chip-yes' : 'chip-no'}" title="${att ? 'Attending' : 'Not attending'}">${e.shortName || e.name}${paxStr}</span>`;
        }).join('');
      if (!statusHtml) statusHtml = '<span style="color:#C4A898">—</span>';
    } else {
      statusHtml = isAttending
        ? '<span class="badge badge-yes">✓ Attending</span>'
        : '<span class="badge badge-no">✗ Not Attending</span>';
    }

    const msg = r.message
      ? `<span title="${escHtml(r.message)}">${escHtml(r.message)}</span>`
      : `<span style="color:#C4A898">—</span>`;

    const isTest = r.token?.startsWith('TEST_')
      ? '<span class="test-badge">TEST</span> '
      : '';

    const searchText = escHtml((r.name + ' ' + r.email + ' ' + (r.message || '')).toLowerCase());

    return `<tr data-id="${r.id}" data-search="${searchText}">
      <td style="color:#C4A898;font-size:12px">${r.id}</td>
      <td class="td-name">${isTest}${escHtml(r.name)}</td>
      <td class="td-email">${escHtml(r.email)}</td>
      <td class="td-status">${statusHtml}</td>
      <td style="text-align:center;color:#6B4030">${isAttending ? (r.guests || 1) : '—'}</td>
      <td style="font-size:12px;color:#6B4030">${Array.isArray(r.hoodiesSizes) && r.hoodiesSizes.length ? escHtml(r.hoodiesSizes.join(', ')) : '<span style="color:#C4A898">—</span>'}</td>
      <td style="font-size:11px;color:#6B4030;max-width:160px;word-break:break-word">${r.mailingAddress ? escHtml(r.mailingAddress) : '<span style="color:#C4A898">—</span>'}</td>
      <td style="font-size:12px;color:#6B4030">${r.dietary ? escHtml(r.dietary) : '<span style="color:#C4A898">—</span>'}</td>
      <td class="td-msg">${msg}</td>
      <td class="td-date">${date}</td>
      <td><button class="btn-delete" onclick="deleteRsvp(${r.id})" title="Delete RSVP">✕</button></td>
    </tr>`;
  }).join('');
}

/* ── Search ────────────────────────────────────────────── */
document.getElementById('search').addEventListener('input', function () {
  const q = this.value.toLowerCase().trim();
  const rows = document.querySelectorAll('#rsvp-body tr');
  rows.forEach(row => {
    row.style.display = (!q || row.dataset.search.includes(q)) ? '' : 'none';
  });
});

/* ── Delete ────────────────────────────────────────────── */
window.deleteRsvp = async function(id) {
  if (!confirm('Delete this RSVP? This cannot be undone.')) return;
  try {
    const res = await fetch(`/api/rsvps/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (res.ok) {
      allRsvps = allRsvps.filter(r => r.id !== id);
      const row = document.querySelector(`tr[data-id="${id}"]`);
      if (row) row.remove();
      if (allRsvps.length === 0) renderTable([]);
    }
  } catch { alert('Failed to delete. Please try again.'); }
};

/* ── CSV Export ────────────────────────────────────────── */
document.getElementById('export-btn').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/rsvps/export', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `alex-rsvps-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch { alert('Export failed. Please try again.'); }
});

/* ── Auto-refresh every 60 seconds ────────────────────── */
setInterval(async () => {
  if (!adminToken) return;
  try {
    const res = await fetch('/api/rsvps', { headers: { 'Authorization': `Bearer ${adminToken}` } });
    if (res.ok) { const data = await res.json(); populate(data); }
  } catch { /* silent */ }
}, 60_000);

/* ── Helpers ───────────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
