/* ═══════════════════════════════════════════════════════
   Alex's Bar Mitzvah — Personalized RSVP Page
   ═══════════════════════════════════════════════════════ */
'use strict';

/* ── Starfield (spiky stars + shooting stars, matches main page) ─ */
(function initStars() {
  const canvas = document.getElementById('stars');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [], shooters = [];
  let nextShoot = Date.now() + 6000 + Math.random() * 6000;

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }

  function makeStars(count) {
    stars = [];
    for (let i = 0; i < count; i++) {
      const warm = Math.random() > 0.82;
      stars.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        r: Math.random() * 1.4 + 0.2, alpha: Math.random(),
        speed: (Math.random() * 0.006 + 0.002) * (Math.random() > 0.5 ? 1 : -1),
        color: warm ? (Math.random() > 0.5 ? '#EAAC2C' : '#D96818') : (Math.random() > 0.7 ? '#A4CCEA' : '#FFFFFF'),
      });
    }
  }

  function drawSpike(x, y, outer, inner) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }

  function spawnShooter() {
    const angle = Math.PI / 5 + Math.random() * (Math.PI / 8);
    const speed = 9 + Math.random() * 7;
    shooters.push({
      x: Math.random() * canvas.width * 0.75 + 20, y: Math.random() * canvas.height * 0.38,
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
      life: 1, decay: 0.022 + Math.random() * 0.012, tail: 110 + Math.random() * 90,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.alpha += s.speed;
      if (s.alpha <= 0 || s.alpha >= 1) s.speed *= -1;
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, s.alpha)) * 0.85;
      ctx.fillStyle = s.color; drawSpike(s.x, s.y, s.r * 2.2, s.r * 0.35); ctx.restore();
    }
    const now = Date.now();
    if (now >= nextShoot) { spawnShooter(); nextShoot = now + 8000 + Math.random() * 9000; }
    for (let i = shooters.length - 1; i >= 0; i--) {
      const s = shooters[i];
      s.x += s.dx; s.y += s.dy; s.life -= s.decay;
      if (s.life <= 0) { shooters.splice(i, 1); continue; }
      const dist = Math.hypot(s.dx, s.dy);
      const tailX = s.x - s.dx * (s.tail / dist), tailY = s.y - s.dy * (s.tail / dist);
      const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.7, `rgba(255,240,220,${s.life * 0.5})`);
      grad.addColorStop(1, `rgba(255,255,255,${s.life})`);
      ctx.save(); ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(s.x, s.y); ctx.stroke();
      ctx.globalAlpha = s.life * 0.9; ctx.fillStyle = '#fff'; drawSpike(s.x, s.y, 2.5, 0.6);
      ctx.restore();
    }
    requestAnimationFrame(draw);
  }

  resize(); makeStars(220); draw();
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { resize(); makeStars(220); }, 200); });
})();

/* ── Monochrome event icons (SVG keyed by actual config emoji values) ─── */
const EVENT_ICONS = {
  // Shabbat — Star of David (proper 12-point hexagram, single polygon)
  '✡': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,3 14.6,7.5 19.8,7.5 17.2,12 19.8,16.5 14.6,16.5 12,21 9.4,16.5 4.2,16.5 6.8,12 4.2,7.5 9.4,7.5"/></svg>`,
  // Bar Mitzvah Service — open Torah/prayer book
  '🕍': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h7a3 3 0 013 3v13a2.5 2.5 0 00-2.5-2.5H2V4z"/><path d="M22 4h-7a3 3 0 00-3 3v13a2.5 2.5 0 012.5-2.5H22V4z"/></svg>`,
  // Evening celebration — 4-pointed sparkle (config uses 🌅)
  '🌅': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z"/></svg>`,
  '✨': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z"/></svg>`,
  '🎉': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z"/></svg>`,
  // Morning After Breakfast — coffee cup
  '☕': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><path d="M6 2v2M10 2v2M14 2v2"/></svg>`,
};
const DEFAULT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,3 14.6,7.5 19.8,7.5 17.2,12 19.8,16.5 14.6,16.5 12,21 9.4,16.5 4.2,16.5 6.8,12 4.2,7.5 9.4,7.5"/></svg>`;

function getEventIcon(emoji) { return EVENT_ICONS[emoji] || DEFAULT_ICON; }

/* ── Main RSVP logic ────────────────────────────────────────── */
(async function initRsvp() {

  const token = window.location.pathname.replace(/^\/rsvp\/?/, '').split('/')[0].trim();

  const elLoading = document.getElementById('state-loading');
  const elError   = document.getElementById('state-error');
  const elContent = document.getElementById('rsvp-content');
  const elSuccess = document.getElementById('state-success');

  function show(el) {
    [elLoading, elError, elContent, elSuccess].forEach(e => e.style.display = 'none');
    el.style.display = '';
  }

  if (!token) {
    document.getElementById('error-message').textContent =
      'No invitation token found in the URL. Please use the personal link from your email.';
    show(elError); return;
  }

  // ── Fetch guest + config ──
  let guest, siteConfig;
  try {
    const [gRes, cRes] = await Promise.all([
      fetch(`/api/guest/${token}`),
      fetch('/api/site-config'),
    ]);
    if (!gRes.ok) {
      const err = await gRes.json().catch(() => ({}));
      document.getElementById('error-message').textContent =
        err.error || 'We couldn\'t find your invitation. Please check the link in your email.';
      show(elError); return;
    }
    guest      = await gRes.json();
    siteConfig = cRes.ok ? await cRes.json() : { events: [] };
  } catch (err) {
    document.getElementById('error-message').textContent =
      'Unable to load your invitation. Please check your connection and try again.';
    show(elError); return;
  }

  // ── Greeting ──
  document.getElementById('guest-name').textContent = guest.name;
  document.title = `RSVP — Alex's Bar Mitzvah`;

  const guestCount = guest.guestCount || 1;
  const countHint  = document.getElementById('guest-count-hint');
  if (countHint) countHint.style.display = 'none';

  // Set "Questions?" footer line
  const replyTo = siteConfig.contact?.replyTo || siteConfig.contact?.fromEmail || '';
  if (replyTo) {
    document.getElementById('rsvp-questions-line').innerHTML =
      `Questions? <a href="mailto:${replyTo}">${replyTo}</a>`;
  }

  // ── Event state tracking ──
  const allEvents   = siteConfig.events || [];
  const invitedIds  = (guest.events || []).map(String);
  const invitedEvts = allEvents.filter(e => invitedIds.includes(String(e.id)));
  const eventStates = {};       // { eventId: true/false }
  const eventGuestCounts = {};  // { eventId: number }
  const kidsCount   = guest.kidsCount || 0;

  // Pre-fill from existing RSVP if returning
  if (guest.alreadyRsvped && guest.rsvp?.events) {
    for (const [id, val] of Object.entries(guest.rsvp.events)) eventStates[id] = val;
    document.getElementById('update-notice').style.display = '';
  }

  // ── Build event cards ──
  const HOODIE_EVENT_ID = '3'; // Evening Celebration
  const eventsList = document.getElementById('events-list');
  eventsList.innerHTML = '';

  for (const evt of invitedEvts) {
    eventGuestCounts[String(evt.id)] = guestCount;

    const dayFmt = new Date(evt.isoDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
    });

    const venueLine  = evt.venueName
      ? `<div class="event-venue-name">${evt.venueName}</div>` : '';
    const addrStr    = [evt.address, evt.city].filter(Boolean).join(', ');
    const addrLine   = addrStr
      ? `<div class="event-addr">${addrStr}</div>` : '';

    const card = document.createElement('div');
    card.className = 'event-rsvp-card';
    card.dataset.eventId = evt.id;

    card.innerHTML = `
      <div class="card-status-bar" id="status-header-${evt.id}" style="display:none;"></div>
      <div class="card-body-wrap">
        <div class="card-icon-circle">${getEventIcon(evt.emoji)}</div>
        <div class="card-info">
          <div class="event-card-name">${evt.name}</div>
          ${venueLine}${addrLine}
          <div class="event-pills">
            <span class="event-pill">&#x1F4C5; ${dayFmt}</span>
            <span class="event-pill">&#x23F0; ${evt.time}</span>
          </div>
        </div>
      </div>
      <div class="card-guest-count" id="count-row-${evt.id}" style="display:none;">
        <div>
          <div class="count-label">Number of Guests</div>
          <div class="count-sub">Adjust if needed</div>
        </div>
        <div class="count-stepper">
          <button type="button" class="stepper-btn" data-evt="${evt.id}" data-dir="-1">&#8964;</button>
          <span class="stepper-val" id="count-val-${evt.id}">${guestCount}</span>
          <button type="button" class="stepper-btn" data-evt="${evt.id}" data-dir="1">&#8963;</button>
        </div>
      </div>
      <div class="card-actions" id="card-actions-${evt.id}">
        <button type="button" class="attend-btn attend-btn-yes" data-evt="${evt.id}" data-val="true">✓ Accept</button>
        <button type="button" class="attend-btn attend-btn-no"  data-evt="${evt.id}" data-val="false">✗ Decline</button>
      </div>
      <div class="card-change" id="card-change-${evt.id}" style="display:none;">
        <button type="button" class="change-response-btn" data-evt="${evt.id}">Change response</button>
      </div>`;

    eventsList.appendChild(card);

    // Apply existing state for returning guests
    if (eventStates[String(evt.id)] !== undefined) {
      applyEventResponse(String(evt.id), eventStates[String(evt.id)]);
    }
  }

  // ── State machine helpers ──
  function applyEventResponse(evtId, val) {
    const card      = eventsList.querySelector(`[data-event-id="${evtId}"]`);
    const header    = document.getElementById(`status-header-${evtId}`);
    const actions   = document.getElementById(`card-actions-${evtId}`);
    const changeEl  = document.getElementById(`card-change-${evtId}`);
    const countRow  = document.getElementById(`count-row-${evtId}`);

    eventStates[evtId] = val;

    header.textContent = val ? '✓  ACCEPTED' : '✗  DECLINED';
    header.className   = 'card-status-bar ' + (val ? 'status-accepted' : 'status-declined');
    header.style.display = '';

    actions.style.display  = 'none';
    changeEl.style.display = '';
    countRow.style.display = val ? '' : 'none';

    card.classList.remove('attending-yes', 'attending-no');
    card.classList.add(val ? 'attending-yes' : 'attending-no');

    updateDetailsVisibility();
  }

  function resetEventResponse(evtId) {
    const card     = eventsList.querySelector(`[data-event-id="${evtId}"]`);
    const header   = document.getElementById(`status-header-${evtId}`);
    const actions  = document.getElementById(`card-actions-${evtId}`);
    const changeEl = document.getElementById(`card-change-${evtId}`);
    const countRow = document.getElementById(`count-row-${evtId}`);

    delete eventStates[evtId];

    header.style.display   = 'none';
    actions.style.display  = '';
    changeEl.style.display = 'none';
    countRow.style.display = 'none';

    card.classList.remove('attending-yes', 'attending-no');
    updateDetailsVisibility();
  }

  function updateDetailsVisibility() {
    const anyYes = Object.values(eventStates).some(v => v === true);
    const sec    = document.getElementById('details-section');
    sec.style.display = anyYes ? '' : 'none';

    // Dietary card
    const dietaryCard = document.getElementById('dietary-card');
    if (dietaryCard) dietaryCard.style.display = anyYes ? '' : 'none';

    // Hoodies only for Evening Celebration (event 3)
    const hoodieSection = document.getElementById('hoodie-section');
    if (hoodieSection && kidsCount > 0) {
      hoodieSection.style.display = eventStates[HOODIE_EVENT_ID] === true ? '' : 'none';
    }
  }

  // ── Click delegation ──
  eventsList.addEventListener('click', (e) => {
    // Stepper
    const stepBtn = e.target.closest('.stepper-btn');
    if (stepBtn) {
      const evtId   = stepBtn.dataset.evt;
      const dir     = parseInt(stepBtn.dataset.dir);
      const current = eventGuestCounts[evtId] ?? guestCount;
      const newVal  = Math.max(1, Math.min(guestCount, current + dir));
      eventGuestCounts[evtId] = newVal;
      const valEl = document.getElementById(`count-val-${evtId}`);
      if (valEl) valEl.textContent = newVal;
      return;
    }
    // Change response
    const changeBtn = e.target.closest('.change-response-btn');
    if (changeBtn) { resetEventResponse(changeBtn.dataset.evt); return; }
    // Accept / Decline
    const btn = e.target.closest('.attend-btn');
    if (!btn) return;
    applyEventResponse(btn.dataset.evt, btn.dataset.val === 'true');
  });

  // ── Build hoodie size fields ──
  const hoodieSection = document.getElementById('hoodie-section');
  if (kidsCount > 0 && hoodieSection) {
    hoodieSection.innerHTML = `
      <div class="divider" style="margin:20px 0 16px;"><div class="divider-line"></div><span class="divider-gem">◆</span><div class="divider-line"></div></div>
      <div style="background:var(--white);border:1px solid rgba(184,92,56,0.12);border-radius:var(--radius);padding:20px 20px 16px;margin-bottom:12px;">
        <div class="form-card-label">Hoodie Sizes <span style="color:var(--terra)">*</span></div>
        <div class="form-card-sub">Each younger guest receives a monogrammed hoodie. Enter a size or describe (e.g. Youth M, Adult S).</div>
        ${Array.from({length: kidsCount}, (_, i) => `
          <div class="form-group">
            <label>Child ${i + 1} Hoodie Size</label>
            <input type="text" id="hoodie-${i}" placeholder="e.g. Youth M, Adult S, size 10/12…" autocomplete="off">
          </div>`).join('')}
      </div>`;
  }

  // ── Pre-fill existing RSVP data ──
  if (guest.alreadyRsvped && guest.rsvp) {
    const r = guest.rsvp;
    if (r.hoodiesSizes && Array.isArray(r.hoodiesSizes)) {
      r.hoodiesSizes.forEach((size, i) => {
        const el = document.getElementById(`hoodie-${i}`);
        if (el) el.value = size;
      });
    }
    if (r.eventGuests && typeof r.eventGuests === 'object') {
      for (const [id, count] of Object.entries(r.eventGuests)) {
        if (count > 0) {
          eventGuestCounts[id] = count;
          const valEl = document.getElementById(`count-val-${id}`);
          if (valEl) valEl.textContent = count;
        }
      }
    }
    if (r.mailingAddress) document.getElementById('mailing-address').value = r.mailingAddress;
    if (r.dietary)        document.getElementById('dietary').value = r.dietary;
    if (r.message)        document.getElementById('message').value = r.message;
  }

  updateDetailsVisibility();
  show(elContent);

  // ── Submit ──
  document.getElementById('submit-btn').addEventListener('click', async () => {
    const errorEl  = document.getElementById('form-error');
    const submitBtn = document.getElementById('submit-btn');

    // All events must have a response
    const unanswered = invitedEvts.filter(e => eventStates[String(e.id)] === undefined);
    if (unanswered.length > 0) {
      errorEl.textContent = `Please respond to all your invitations (${unanswered.map(e => e.name).join(', ')}).`;
      errorEl.classList.add('visible');
      errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    const anyYes = Object.values(eventStates).some(v => v === true);

    // Build events payload
    const eventsPayload = {};
    for (const [id, val] of Object.entries(eventStates)) eventsPayload[id] = val;

    // Validate hoodie sizes
    const hoodieRequired = anyYes && kidsCount > 0 && eventStates[HOODIE_EVENT_ID] === true;
    if (hoodieRequired) {
      const missing = Array.from({length: kidsCount}, (_, i) => document.getElementById(`hoodie-${i}`)?.value || '').some(v => !v);
      if (missing) {
        errorEl.textContent = `Please enter a hoodie size for ${kidsCount === 1 ? 'your child' : 'each child'}.`;
        errorEl.classList.add('visible');
        errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
    }

    // Build per-event guest counts
    const eventGuestsPayload = {};
    for (const [id, attending] of Object.entries(eventsPayload)) {
      if (attending) {
        const n = eventGuestCounts[id] ?? guestCount;
        if (n < 1 || n > guestCount) {
          errorEl.textContent = `Guest count must be between 1 and ${guestCount}.`;
          errorEl.classList.add('visible'); return;
        }
        eventGuestsPayload[id] = n;
      } else {
        eventGuestsPayload[id] = 0;
      }
    }

    // Mailing address required
    const mailingAddress = document.getElementById('mailing-address').value.trim();
    if (!mailingAddress) {
      errorEl.textContent = 'Please enter your mailing address.';
      errorEl.classList.add('visible');
      document.getElementById('mailing-address').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    errorEl.classList.remove('visible');
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Sending…';

    try {
      const res = await fetch('/api/rsvp-token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          token,
          events:        eventsPayload,
          eventGuests:   eventGuestsPayload,
          hoodiesSizes:  hoodieRequired
            ? Array.from({length: kidsCount}, (_, i) => document.getElementById(`hoodie-${i}`)?.value || '').filter(Boolean)
            : null,
          mailingAddress,
          dietary: document.getElementById('dietary').value.trim() || null,
          message: document.getElementById('message').value.trim()  || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess(invitedEvts, eventsPayload, anyYes);
      } else {
        errorEl.textContent = data.error || 'Something went wrong. Please try again.';
        errorEl.classList.add('visible');
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Send RSVP';
      }
    } catch {
      errorEl.textContent = 'Unable to reach the server. Please check your connection and try again.';
      errorEl.classList.add('visible');
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Send RSVP';
    }
  });

  // ── Success screen ──
  function showSuccess(events, responses, anyYes) {
    const titleEl    = document.getElementById('success-title');
    const subtitleEl = document.getElementById('success-subtitle');
    const eventsEl   = document.getElementById('success-events');

    if (!anyYes) {
      titleEl.textContent    = 'We\'ll Miss You';
      subtitleEl.textContent = 'Thank you for letting us know. Alex sends his warmest wishes.';
    } else {
      titleEl.textContent    = 'Toda Raba!';
      subtitleEl.textContent = 'Your RSVP is confirmed. We\'re so glad you\'ll be joining us to celebrate Alex\'s Bar Mitzvah.';
    }

    eventsEl.innerHTML = events.map(e => {
      const attending = responses[String(e.id)];
      return `<div class="success-event-row ${attending ? 'yes' : 'no'}">
        <div class="card-icon-circle" style="width:28px;height:28px;flex-shrink:0;">${getEventIcon(e.emoji)}</div>
        <span class="success-event-name">${e.name}</span>
        <span class="success-event-status">${attending ? 'Attending' : 'Regrets'}</span>
      </div>`;
    }).join('');

    show(elSuccess);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.getElementById('update-btn').addEventListener('click', () => {
    show(elContent);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

})();
