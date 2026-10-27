/* ═══════════════════════════════════════════════════════
   Alex's Bar Mitzvah — Guest Management Dashboard
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── Auth ────────────────────────────────────────────────
const TOKEN_KEY = 'alex_admin_token';
let authToken   = localStorage.getItem(TOKEN_KEY) || '';
let allGuests   = [];
let rsvpMap     = {};   // guestId → rsvp record
let siteEvents  = [];   // from /api/site-config
let currentFilter = 'all';

function headers() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` };
}

// ── Toast ────────────────────────────────────────────────
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'visible' + (isError ? ' error' : '');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = ''; }, 3200);
}

// ── Login flow ───────────────────────────────────────────
function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').classList.add('visible');
  loadAll();
}

async function tryLogin() {
  const candidate = document.getElementById('token-input').value.trim();
  if (!candidate) return;
  const r = await fetch('/api/guests', { headers: { Authorization: `Bearer ${candidate}` } });
  if (r.ok) {
    authToken = candidate;
    localStorage.setItem(TOKEN_KEY, authToken);
    showDashboard();
  } else {
    document.getElementById('login-error').style.display = '';
  }
}

if (authToken) {
  fetch('/api/guests', { headers: headers() })
    .then(r => {
      if (r.ok) showDashboard();
      else { localStorage.removeItem(TOKEN_KEY); document.getElementById('login-screen').style.display = 'flex'; }
    });
} else {
  document.getElementById('login-screen').style.display = 'flex';
}

document.getElementById('login-btn').addEventListener('click', tryLogin);
document.getElementById('token-input').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem(TOKEN_KEY);
  location.reload();
});

// ── Load all data ────────────────────────────────────────
async function loadAll() {
  try {
    const [gRes, rRes, cRes] = await Promise.all([
      fetch('/api/guests',     { headers: headers() }),
      fetch('/api/rsvps',      { headers: headers() }),
      fetch('/api/site-config'),
    ]);

    const gData = gRes.ok  ? await gRes.json()  : { guests: [] };
    const rData = rRes.ok  ? await rRes.json()  : { rsvps:  [] };
    const cData = cRes.ok  ? await cRes.json()  : { events: [] };

    allGuests  = (gData.guests || []).filter(g => !g.isTest);
    siteEvents = cData.events || [];

    // Build rsvp map keyed by guestId (and by token as fallback)
    rsvpMap = {};
    for (const r of (rData.rsvps || [])) {
      if (r.guestId) rsvpMap[r.guestId] = r;
      if (r.token)   rsvpMap[r.token]   = rsvpMap[r.token] || r;
    }

    // Build modal event checkboxes
    buildModalEvents();

    updateSummary();
    renderTable();

    document.getElementById('table-loading').style.display = 'none';
    document.getElementById('guest-table').style.display   = '';
  } catch (err) {
    console.error('Load error:', err);
    toast('Failed to load data.', true);
  }
}

// ── Summary ──────────────────────────────────────────────
function updateSummary() {
  const total   = allGuests.length;
  const stdSent = allGuests.filter(g => g.emails?.saveTheDate).length;
  const invSent = allGuests.filter(g => g.emails?.invite).length;
  const rsvped  = allGuests.filter(g => rsvpMap[g.id] || rsvpMap[g.token]).length;
  const pax     = allGuests.reduce((s, g) => s + (g.guestCount || 1), 0);

  document.getElementById('s-total').textContent    = total;
  document.getElementById('s-std-sent').textContent = stdSent;
  document.getElementById('s-inv-sent').textContent = invSent;
  document.getElementById('s-rsvped').textContent   = rsvped;
  document.getElementById('s-pax').textContent      = pax;
}

// ── Filter + Search ──────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTable();
  });
});

document.getElementById('search').addEventListener('input', renderTable);

// ── Render table ─────────────────────────────────────────
function renderTable() {
  const q      = document.getElementById('search').value.toLowerCase().trim();
  const tbody  = document.getElementById('guest-body');
  const empty  = document.getElementById('table-empty');

  let guests = allGuests;

  // Apply filter
  if (currentFilter === 'no-std') {
    guests = guests.filter(g => !g.emails?.saveTheDate);
  } else if (currentFilter === 'no-invite') {
    guests = guests.filter(g => !g.emails?.invite);
  } else if (currentFilter === 'no-rsvp') {
    guests = guests.filter(g => !(rsvpMap[g.id] || rsvpMap[g.token]));
  }

  // Apply search
  if (q) {
    guests = guests.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      (g.household || '').toLowerCase().includes(q)
    );
  }

  const filterLabel = {
    all: 'All Guests', 'no-std': 'No Save-the-Date',
    'no-invite': 'No Invite', 'no-rsvp': 'No RSVP',
  };
  document.getElementById('list-title').textContent =
    `${filterLabel[currentFilter] || 'Guests'} (${guests.length})`;

  if (guests.length === 0) {
    tbody.innerHTML = '';
    empty.style.display  = '';
    document.getElementById('guest-table').style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  document.getElementById('guest-table').style.display = '';

  tbody.innerHTML = guests.map((g, i) => {
    const rsvp    = rsvpMap[g.id] || rsvpMap[g.token];
    const rsvpHtml = buildRsvpBadge(g, rsvp);
    const evtHtml  = buildEventPills(g.events || []);
    const emailHtml = buildEmailStatus(g);

    return `<tr data-id="${g.id}">
      <td style="color:var(--light);font-size:12px">${i + 1}</td>
      <td class="td-name">${esc(g.name)}<small>${esc(g.household || '')}</small></td>
      <td class="td-email">${esc(g.email)}</td>
      <td class="td-count">${g.guestCount || 1}</td>
      <td class="td-count" style="color:var(--sky)">${g.kidsCount || 0}</td>
      <td>${evtHtml}</td>
      <td>${emailHtml}</td>
      <td>${rsvpHtml}</td>
      <td style="font-size:12px;color:var(--light);max-width:140px">${esc(g.notes || '')}</td>
      <td class="td-actions">
        <button class="btn-action send" title="Send invitation" data-action="invite" data-id="${g.id}">✉</button>
        <button class="btn-action" title="Copy RSVP link" data-action="copy" data-id="${g.id}" data-token="${g.token}">🔗</button>
        <button class="btn-action" title="Delete guest" data-action="delete" data-id="${g.id}">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Event pills ──────────────────────────────────────────
const EVT_SHORT = { 1: 'Shabbat', 2: 'Service', 3: 'Party', 4: 'Breakfast' };

function buildEventPills(eventIds) {
  return `<div class="event-pills">${
    eventIds.map(id => `<span class="pill pill-${id}">${siteEvents.find(e=>e.id===id)?.shortName || EVT_SHORT[id] || id}</span>`).join('')
  }</div>`;
}

// ── RSVP badge ───────────────────────────────────────────
function buildRsvpBadge(guest, rsvp) {
  if (!rsvp) return `<span class="rsvp-pill rsvp-none">Pending</span>`;

  if (rsvp.events && typeof rsvp.events === 'object') {
    const guestEventIds = guest.events || [];
    const allYes = guestEventIds.every(id => rsvp.events[String(id)] === true);
    const allNo  = guestEventIds.every(id => rsvp.events[String(id)] === false);
    const anyYes = guestEventIds.some(id  => rsvp.events[String(id)] === true);
    if (allYes) return `<span class="rsvp-pill rsvp-attending">✓ Attending</span>`;
    if (allNo)  return `<span class="rsvp-pill rsvp-declined">✗ Declined</span>`;
    if (anyYes) return `<span class="rsvp-pill rsvp-partial">Partial</span>`;
  }

  if (rsvp.attending === true)  return `<span class="rsvp-pill rsvp-attending">✓ Attending</span>`;
  if (rsvp.attending === false) return `<span class="rsvp-pill rsvp-declined">✗ Declined</span>`;
  return `<span class="rsvp-pill rsvp-none">Pending</span>`;
}

// ── Email status badges ──────────────────────────────────
const EMAIL_TYPES = [
  { key: 'saveTheDate', label: 'Save Date' },
  { key: 'invite',      label: 'Invite'    },
  { key: 'reminder',    label: 'Reminder'  },
];

function buildEmailStatus(g) {
  return `<div class="email-status">${
    EMAIL_TYPES.map(({ key, label }) => {
      const sentAt = g.emails?.[key];
      if (sentAt) {
        const d = new Date(sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `<span class="em-badge em-sent" title="${label} sent ${d}">✓ ${label}</span>`;
      }
      // Unsent — clickable to send
      if (key === 'reminder' && !g.emails?.invite) {
        // Can't send reminder before invite
        return `<span class="em-badge" style="background:#F5F5F5;color:#E0D0C8;cursor:not-allowed" title="Send invite first">— ${label}</span>`;
      }
      return `<span class="em-badge em-unsent" title="Click to send ${label}" data-send="${key}" data-gid="${g.id}">↑ ${label}</span>`;
    }).join('')
  }</div>`;
}

// ── Table click delegation ────────────────────────────────
document.getElementById('guest-body').addEventListener('click', async (e) => {
  // Email send badge
  const badge = e.target.closest('[data-send]');
  if (badge) {
    const type = badge.dataset.send;
    const gid  = badge.dataset.gid;
    await sendEmail(gid, type, badge);
    return;
  }

  // Action buttons
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id, token } = btn.dataset;

  if (action === 'copy') {
    const rsvpUrl = `${location.origin}/rsvp/${token}`;
    try {
      await navigator.clipboard.writeText(rsvpUrl);
      toast('RSVP link copied!');
    } catch {
      prompt('Copy this RSVP link:', rsvpUrl);
    }
    return;
  }

  if (action === 'invite') {
    const g = allGuests.find(g => g.id === id);
    if (!g) return;
    const type = g.emails?.saveTheDate ? 'invite' : 'saveTheDate';
    await sendEmail(id, type, btn);
    return;
  }

  if (action === 'delete') {
    const g = allGuests.find(g => g.id === id);
    if (!g) return;
    if (!confirm(`Delete "${g.name}" (${g.email})?\n\nThis removes them from the guest list only — any RSVP they submitted is kept.`)) return;
    const r = await fetch(`/api/guests/${id}`, { method: 'DELETE', headers: headers() });
    if (r.ok) {
      toast(`${g.name} removed.`);
      await loadAll();
    } else {
      toast('Delete failed.', true);
    }
  }
});

// ── Send email ───────────────────────────────────────────
async function sendEmail(guestId, type, triggerEl) {
  const typeLabel = { saveTheDate: 'Save-the-Date', invite: 'Invitation', reminder: 'Reminder' }[type] || type;
  const g = allGuests.find(g => g.id === guestId);
  if (!g) return;

  if (!confirm(`Send ${typeLabel} to ${g.name} (${g.email})?`)) return;

  if (triggerEl) {
    triggerEl.textContent = '…';
    triggerEl.className = 'em-badge em-sending';
  }

  try {
    const r = await fetch('/api/send-email', {
      method:  'POST',
      headers: headers(),
      body:    JSON.stringify({ guestId, type }),
    });
    const data = await r.json();
    if (r.ok && data.success) {
      toast(`✓ ${typeLabel} sent to ${g.email}`);
      await loadAll();
    } else {
      toast(data.error || 'Send failed.', true);
      if (triggerEl) renderTable();
    }
  } catch (err) {
    toast('Network error — could not send.', true);
    if (triggerEl) renderTable();
  }
}

// ── Export / Import ──────────────────────────────────────
document.getElementById('export-btn').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = '/api/guests/export';
  a.setAttribute('Authorization', '');   // can't set auth header on anchor; use fetch below
  // Fetch with auth then trigger download
  fetch('/api/guests/export', { headers: headers() })
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `alex-guests-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(() => toast('Export failed.', true));
});

document.getElementById('import-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  e.target.value = '';   // reset so same file can be re-imported
  try {
    const r = await fetch('/api/guests/import', {
      method:  'POST',
      headers: { ...headers(), 'Content-Type': 'text/csv' },
      body:    text,
    });
    const data = await r.json();
    if (r.ok) {
      toast(`Import done: ${data.created} added, ${data.updated} updated, ${data.skipped} skipped`);
      await loadAll();
    } else {
      toast(data.error || 'Import failed.', true);
    }
  } catch {
    toast('Network error during import.', true);
  }
});

// ── Add Guest Modal ──────────────────────────────────────
function buildModalEvents() {
  const container = document.getElementById('modal-events');
  container.innerHTML = siteEvents.map(e =>
    `<label class="evt-label" data-id="${e.id}">
      <input type="checkbox" value="${e.id}"> ${e.emoji || ''} ${e.shortName || e.name}
    </label>`
  ).join('');

  // Toggle checked class
  container.querySelectorAll('.evt-label').forEach(lbl => {
    lbl.querySelector('input').addEventListener('change', () => {
      lbl.classList.toggle('checked', lbl.querySelector('input').checked);
    });
  });
}

document.getElementById('add-guest-btn').addEventListener('click', () => {
  clearModal();
  document.getElementById('modal-overlay').classList.add('open');
});
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

function clearModal() {
  ['m-first','m-last','m-household','m-email','m-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('m-count').value = 1;
  document.getElementById('m-kids').value  = 0;
  document.querySelectorAll('#modal-events input').forEach(cb => {
    cb.checked = false;
    cb.closest('.evt-label').classList.remove('checked');
  });
  document.getElementById('modal-error').style.display = 'none';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

document.getElementById('modal-save').addEventListener('click', async () => {
  const errEl = document.getElementById('modal-error');
  errEl.style.display = 'none';

  const firstName = document.getElementById('m-first').value.trim();
  const lastName  = document.getElementById('m-last').value.trim();
  const household = document.getElementById('m-household').value.trim();
  const email     = document.getElementById('m-email').value.trim();
  const guestCount = parseInt(document.getElementById('m-count').value) || 1;
  const kidsCount  = parseInt(document.getElementById('m-kids').value)  || 0;
  const notes     = document.getElementById('m-notes').value.trim();
  const events    = [...document.querySelectorAll('#modal-events input:checked')].map(cb => parseInt(cb.value));

  // Derive name
  const name = [firstName, lastName].filter(Boolean).join(' ') || household;

  // Validate
  if (!household) { errEl.textContent = 'Household name is required.'; errEl.style.display = 'block'; return; }
  if (!email)     { errEl.textContent = 'Email address is required.';  errEl.style.display = 'block'; return; }
  if (!email.includes('@')) { errEl.textContent = 'Please enter a valid email.'; errEl.style.display = 'block'; return; }
  if (!events.length) { errEl.textContent = 'Please select at least one event.'; errEl.style.display = 'block'; return; }

  const saveBtn = document.getElementById('modal-save');
  saveBtn.textContent = 'Adding…';
  saveBtn.disabled    = true;

  try {
    const r = await fetch('/api/guests', {
      method:  'POST',
      headers: headers(),
      body:    JSON.stringify({ name, household, firstName: firstName || null, lastName: lastName || null, email, guestCount, kidsCount, events, notes: notes || null }),
    });
    const data = await r.json();
    if (r.ok && data.success) {
      toast(`✓ ${data.guest.name} added!`);
      closeModal();
      await loadAll();
    } else {
      errEl.textContent = data.error || 'Could not add guest.';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = 'Network error.';
    errEl.style.display = 'block';
  } finally {
    saveBtn.textContent = 'Add Guest';
    saveBtn.disabled    = false;
  }
});

// ── Send Invites ─────────────────────────────────────────
const inviteOverlay = document.getElementById('invite-modal-overlay');
let inviteSelection  = new Set();
let inviteJobId      = null;
let inviteJobPoll    = null;
let inviteEmailType  = 'invite';

const EMAIL_TYPE_TITLES = {
  invite:        'Send Invitations',
  reminder:      'Send 1st RSVP Reminder',
  finalReminder: 'Send Final RSVP Reminder',
  preEvent:      'Send Pre-Event Details',
};
const EMAIL_STATUS_COL = {
  invite:        'Invite Sent',
  reminder:      '1st Reminder Sent',
  finalReminder: 'Final Reminder Sent',
  preEvent:      'Pre-Event Sent',
};
const EMAIL_TYPE_VERB = {
  invite:        'Invitation',
  reminder:      'Reminder',
  finalReminder: 'Final Reminder',
  preEvent:      'Pre-Event Email',
};

function isEligibleForType(g, type) {
  if (!g.email || !g.events?.length) return false;
  if (type === 'reminder' || type === 'finalReminder') return !!g.emails?.invite && !rsvpMap[g.id];
  if (type === 'preEvent') return !!rsvpMap[g.id]?.attending;
  return true;
}

function isUnsentForType(g, type) {
  if (type === 'invite')        return !g.emails?.invite;
  if (type === 'reminder')      return !g.emails?.reminder;
  if (type === 'finalReminder') return !g.emails?.finalReminder;
  if (type === 'preEvent')      return !g.emails?.preEvent;
  return true;
}

document.getElementById('send-invites-btn').addEventListener('click', openInviteModal);
document.getElementById('invite-cancel').addEventListener('click', closeInviteModal);
inviteOverlay.addEventListener('click', e => { if (e.target === inviteOverlay) closeInviteModal(); });

document.getElementById('invite-email-type').addEventListener('change', e => {
  inviteEmailType = e.target.value;
  document.getElementById('invite-modal-title').textContent = EMAIL_TYPE_TITLES[inviteEmailType] || 'Send Emails';
  inviteSelection = new Set();
  document.querySelectorAll('.invite-quick-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('inv-btn-unsent').classList.add('active');
  selectInviteGuests('unsent');
});

document.querySelectorAll('.invite-quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.invite-quick-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectInviteGuests(btn.dataset.select);
  });
});

document.getElementById('invite-search').addEventListener('input', () => renderInviteTable());
document.getElementById('invite-delay').addEventListener('input', updateInviteFooter);
document.getElementById('invite-limit').addEventListener('input', updateInviteFooter);
document.getElementById('invite-dryrun').addEventListener('change', updateInviteFooter);
document.getElementById('invite-send-btn').addEventListener('click', startInviteJob);

function openInviteModal() {
  inviteSelection  = new Set();
  inviteEmailType  = 'invite';
  inviteJobId      = null;
  if (inviteJobPoll) clearInterval(inviteJobPoll);
  document.getElementById('invite-email-type').value        = 'invite';
  document.getElementById('invite-modal-title').textContent = EMAIL_TYPE_TITLES.invite;
  document.getElementById('invite-search').value    = '';
  document.getElementById('invite-delay').value     = '1000';
  document.getElementById('invite-limit').value     = '';
  document.getElementById('invite-dryrun').checked  = false;
  document.getElementById('invite-progress').style.display = 'none';
  document.getElementById('invite-selection-panel').style.display = '';
  document.getElementById('invite-cancel').textContent = 'Cancel';
  document.getElementById('invite-cancel').disabled    = false;
  document.getElementById('invite-prog-log').innerHTML = '';
  document.querySelectorAll('.invite-quick-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('inv-btn-unsent').classList.add('active');
  selectInviteGuests('unsent');
  inviteOverlay.classList.add('open');
}

function closeInviteModal() {
  if (inviteJobPoll) clearInterval(inviteJobPoll);
  inviteJobId  = null;
  inviteJobPoll = null;
  inviteOverlay.classList.remove('open');
}

function selectInviteGuests(mode) {
  const q = document.getElementById('invite-search').value.toLowerCase().trim();
  let pool = allGuests.filter(g => isEligibleForType(g, inviteEmailType));
  if (q) pool = pool.filter(g =>
    g.name.toLowerCase().includes(q) ||
    g.email.toLowerCase().includes(q) ||
    (g.household||'').toLowerCase().includes(q)
  );
  if (mode === 'unsent') {
    pool.forEach(g => {
      if (isUnsentForType(g, inviteEmailType)) inviteSelection.add(g.id);
      else                                     inviteSelection.delete(g.id);
    });
  } else if (mode === 'all')  { pool.forEach(g => inviteSelection.add(g.id)); }
  else if (mode === 'none')   { pool.forEach(g => inviteSelection.delete(g.id)); }
  renderInviteTable();
  updateInviteFooter();
}

function renderInviteTable() {
  const q     = document.getElementById('invite-search').value.toLowerCase().trim();
  const tbody = document.getElementById('invite-tbody');
  const colHdr = document.getElementById('invite-status-col-header');
  if (colHdr) colHdr.textContent = EMAIL_STATUS_COL[inviteEmailType] || 'Status';

  let pool = allGuests.filter(g => isEligibleForType(g, inviteEmailType));
  if (q) pool = pool.filter(g =>
    g.name.toLowerCase().includes(q) ||
    g.email.toLowerCase().includes(q) ||
    (g.household||'').toLowerCase().includes(q)
  );
  tbody.innerHTML = pool.map(g => {
    const checked = inviteSelection.has(g.id);
    const sentAt  = inviteEmailType === 'invite'        ? g.emails?.invite
                  : inviteEmailType === 'reminder'      ? g.emails?.reminder
                  : inviteEmailType === 'finalReminder' ? g.emails?.finalReminder
                  : inviteEmailType === 'preEvent'      ? g.emails?.preEvent
                  : null;
    const rsvp = rsvpMap[g.id];
    let statusHtml;
    if (sentAt) {
      statusHtml = `<span style="color:#2E7D32;font-size:11px;">✓ ${new Date(sentAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>`;
    } else if ((inviteEmailType === 'reminder' || inviteEmailType === 'finalReminder') && rsvp) {
      statusHtml = `<span style="color:#1565C0;font-size:11px;">✓ RSVP'd</span>`;
    } else {
      statusHtml = `<span style="color:#BDBDBD;font-size:11px;">—</span>`;
    }
    const evtPills = (g.events||[]).map(id=>`<span class="pill pill-${id}">${EVT_SHORT[id]||id}</span>`).join('');
    return `<tr class="${checked?'invite-row-selected':''}" style="border-bottom:1px solid #F8EDE8;">
      <td style="padding:8px 12px;text-align:center;">
        <input type="checkbox" class="invite-cb" data-gid="${g.id}" ${checked?'checked':''}>
      </td>
      <td style="padding:8px 12px;" class="td-name">${esc(g.name)}<small>${esc(g.household||'')}</small></td>
      <td style="padding:8px 12px;" class="td-email">${esc(g.email)}</td>
      <td style="padding:8px 12px;"><div class="event-pills">${evtPills}</div></td>
      <td style="padding:8px 12px;">${statusHtml}</td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.invite-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) inviteSelection.add(cb.dataset.gid);
      else            inviteSelection.delete(cb.dataset.gid);
      cb.closest('tr').classList.toggle('invite-row-selected', cb.checked);
      updateInviteFooter();
    });
  });
}

function updateInviteFooter() {
  const eligible = allGuests.filter(g => isEligibleForType(g, inviteEmailType));
  const unsent   = eligible.filter(g => isUnsentForType(g, inviteEmailType)).length;
  const sent     = eligible.length - unsent;
  const sel      = inviteSelection.size;
  const limit    = parseInt(document.getElementById('invite-limit').value) || 0;
  const toSend   = limit > 0 ? Math.min(sel, limit) : sel;
  const isDry    = document.getElementById('invite-dryrun').checked;
  const verb     = EMAIL_TYPE_VERB[inviteEmailType] || 'Email';

  document.getElementById('invite-count-info').textContent =
    `${sel} selected · ${unsent} unsent · ${sent} already sent`;

  const btn = document.getElementById('invite-send-btn');
  if (toSend > 0) {
    btn.textContent = isDry
      ? `▶ Dry Run ${toSend} ${verb}${toSend!==1?'s':''}`
      : `▶ Send ${toSend} ${verb}${toSend!==1?'s':''}`;
    btn.disabled = false;
  } else {
    btn.textContent = 'Select Recipients First';
    btn.disabled = true;
  }
}

async function startInviteJob() {
  const isDry   = document.getElementById('invite-dryrun').checked;
  const delayMs = parseInt(document.getElementById('invite-delay').value) || 1000;
  const limit   = parseInt(document.getElementById('invite-limit').value) || 0;
  let guestIds  = [...inviteSelection];
  if (limit > 0) guestIds = guestIds.slice(0, limit);
  if (!guestIds.length) return;

  const verb = EMAIL_TYPE_VERB[inviteEmailType] || 'Email';
  if (!isDry) {
    const alreadySent = guestIds.filter(id => {
      const g = allGuests.find(g => g.id === id);
      return g && !isUnsentForType(g, inviteEmailType);
    }).length;
    let msg = `Send ${verb.toLowerCase()}s to ${guestIds.length} guest${guestIds.length!==1?'s':''}?`;
    if (alreadySent > 0) msg += `\n\n⚠ ${alreadySent} of them already received this email — they'll get a second one.`;
    msg += '\n\nThis will send real emails.';
    if (!confirm(msg)) return;
  }

  // Switch to progress view
  document.getElementById('invite-selection-panel').style.display = 'none';
  document.getElementById('invite-progress').style.display = '';
  document.getElementById('invite-prog-log').innerHTML = '';
  document.getElementById('invite-prog-stats').textContent = '';
  document.getElementById('invite-prog-current').textContent = '';
  document.getElementById('invite-prog-bar').style.width = '0%';
  document.getElementById('invite-prog-text').textContent = `0 / ${guestIds.length}`;
  document.getElementById('invite-prog-title').textContent = isDry ? 'Dry Run…' : 'Sending…';
  document.getElementById('invite-send-btn').disabled = true;
  document.getElementById('invite-cancel').disabled   = true;
  document.getElementById('invite-cancel').textContent = 'Running…';

  try {
    const r = await fetch('/api/invites/start', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ guestIds, dryRun: isDry, delayMs, emailType: inviteEmailType }),
    });
    const data = await r.json();
    if (!r.ok) {
      toast(data.error || 'Failed to start.', true);
      document.getElementById('invite-cancel').disabled   = false;
      document.getElementById('invite-cancel').textContent = 'Close';
      return;
    }
    inviteJobId = data.jobId;
    pollInviteJob();
  } catch (err) {
    toast('Network error: ' + err.message, true);
    document.getElementById('invite-cancel').disabled   = false;
    document.getElementById('invite-cancel').textContent = 'Close';
  }
}

function pollInviteJob() {
  if (inviteJobPoll) clearInterval(inviteJobPoll);
  inviteJobPoll = setInterval(async () => {
    if (!inviteJobId) { clearInterval(inviteJobPoll); return; }
    try {
      const r = await fetch(`/api/invites/job/${inviteJobId}`, { headers: headers() });
      if (!r.ok) return;
      const job = await r.json();
      updateInviteProgress(job);
      if (job.status === 'done') {
        clearInterval(inviteJobPoll);
        inviteJobId  = null;
        inviteJobPoll = null;
        document.getElementById('invite-prog-title').textContent = job.dryRun ? 'Dry Run Complete' : 'Done!';
        document.getElementById('invite-cancel').disabled   = false;
        document.getElementById('invite-cancel').textContent = 'Close';
        toast(`✓ ${job.dryRun?'Dry run':'Send'} complete: ${job.sent.length} sent, ${job.failed.length} failed, ${job.skipped.length} skipped`);
        await loadAll();
      }
    } catch { /* ignore transient poll errors */ }
  }, 1500);
}

function updateInviteProgress(job) {
  const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;
  document.getElementById('invite-prog-bar').style.width  = pct + '%';
  document.getElementById('invite-prog-text').textContent = `${job.processed} / ${job.total}`;
  document.getElementById('invite-prog-current').textContent =
    job.current ? `Sending to ${job.current}…` : (job.status === 'done' ? '' : 'Starting…');

  const dry = job.dryRun ? ' (dry run)' : '';
  document.getElementById('invite-prog-stats').textContent =
    `✓ ${job.sent.length} sent${dry}   ✗ ${job.failed.length} failed   — ${job.skipped.length} skipped`;

  const entries = [
    ...job.sent.map(e=>({...e, type:'sent'})),
    ...job.failed.map(e=>({...e, type:'failed'})),
    ...job.skipped.map(e=>({...e, type:'skipped'})),
  ];
  document.getElementById('invite-prog-log').innerHTML = entries.map(e => {
    if (e.type === 'sent')    return `<div class="invite-log-row sent">✓ ${esc(e.name)} → ${esc(e.email)}${e.dryRun?' (dry run)':''}</div>`;
    if (e.type === 'failed')  return `<div class="invite-log-row failed">✗ ${esc(e.name)} → ${esc(e.email)}: ${esc(e.error||'Failed')}</div>`;
    return `<div class="invite-log-row skipped">— ${esc(e.name)}: ${esc(e.reason||'Skipped')}</div>`;
  }).join('');
}

// ── Google Sheet Sync ────────────────────────────────────
const syncOverlay = document.getElementById('sync-modal-overlay');
const syncBody    = document.getElementById('sync-body');
const syncSub     = document.getElementById('sync-sub');
const syncApply   = document.getElementById('sync-apply');

document.getElementById('sheet-sync-btn').addEventListener('click', openSyncModal);
document.getElementById('sync-cancel').addEventListener('click', () => syncOverlay.classList.remove('open'));
syncOverlay.addEventListener('click', e => { if (e.target === syncOverlay) syncOverlay.classList.remove('open'); });

async function openSyncModal() {
  syncBody.innerHTML = '<div class="sync-loading">Fetching sheet data, please wait…</div>';
  syncSub.textContent = 'Checking the guest sheet for changes…';
  syncApply.disabled  = true;
  syncApply.textContent = 'Apply Changes';
  syncOverlay.classList.add('open');

  let diff;
  try {
    const r = await fetch('/api/guests/sheet-diff', { headers: headers() });
    diff = await r.json();
    if (!r.ok) throw new Error(diff.error || 'Unknown error');
  } catch (err) {
    syncBody.innerHTML = `<p style="color:var(--red);font-size:14px;">Could not fetch sheet: ${esc(err.message)}</p>`;
    syncSub.textContent = 'Something went wrong.';
    return;
  }

  const { sheetTotal, added, changed, unchangedCount } = diff;
  syncSub.textContent = `Sheet has ${sheetTotal} valid guests · ${added.length} new, ${changed.length} changed, ${unchangedCount} unchanged`;

  const EVT = { 1:'Shabbat', 2:'Service', 3:'Party', 4:'Breakfast' };

  let html = '';

  // New guests
  html += `<div class="sync-section">
    <div class="sync-section-title added">+ ${added.length} New Guest${added.length !== 1 ? 's' : ''}</div>`;
  if (added.length === 0) {
    html += '<p class="sync-empty">No new guests found.</p>';
  } else {
    html += added.map(g =>
      `<div class="sync-item new">
        <div class="sync-name">${esc(g.name || g.household)}</div>
        <div class="sync-email">${esc(g.email)}</div>
        <div class="sync-detail">${g.guestCount} guest${g.guestCount!==1?'s':''} · ${g.kidsCount} kid${g.kidsCount!==1?'s':''} · Events: ${(g.events||[]).map(id=>EVT[id]||id).join(', ')}</div>
      </div>`
    ).join('');
  }
  html += '</div>';

  // Changed guests
  html += `<div class="sync-section">
    <div class="sync-section-title changed">~ ${changed.length} Updated</div>`;
  if (changed.length === 0) {
    html += '<p class="sync-empty">No changes to existing guests.</p>';
  } else {
    html += changed.map(g =>
      `<div class="sync-item modified">
        <div class="sync-name">${esc(g.name)}</div>
        <div class="sync-email">${esc(g.email)}</div>
        <div class="sync-detail">${g.diffs.map(esc).join(' · ')}</div>
      </div>`
    ).join('');
  }
  html += '</div>';

  // Unchanged count
  html += `<div class="sync-section">
    <div class="sync-section-title ok">✓ ${unchangedCount} Unchanged</div>
  </div>`;

  syncBody.innerHTML = html;

  if (added.length > 0 || changed.length > 0) {
    syncApply.disabled    = false;
    syncApply.textContent = `Apply ${added.length + changed.length} Change${(added.length+changed.length)!==1?'s':''}`;
  } else {
    syncApply.disabled    = true;
    syncApply.textContent = 'No Changes to Apply';
  }
}

syncApply.addEventListener('click', async () => {
  syncApply.disabled    = true;
  syncApply.textContent = 'Applying…';
  try {
    const r = await fetch('/api/guests/sheet-sync', { method: 'POST', headers: headers() });
    const data = await r.json();
    if (r.ok && data.success) {
      syncOverlay.classList.remove('open');
      toast(`✓ Sheet sync done: ${data.created} added, ${data.updated} updated`);
      await loadAll();
    } else {
      toast(data.error || 'Sync failed.', true);
      syncApply.disabled    = false;
      syncApply.textContent = 'Retry';
    }
  } catch {
    toast('Network error during sync.', true);
    syncApply.disabled    = false;
    syncApply.textContent = 'Retry';
  }
});
