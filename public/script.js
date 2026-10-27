/* ═══════════════════════════════════════════════════════
   Alex's Bar Mitzvah — Frontend Script
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ── Starfield canvas ──────────────────────────────────── */
(function initStars() {
  const canvas = document.getElementById('stars');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];
  let shooters = [];
  let nextShoot = Date.now() + 6000 + Math.random() * 6000;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function makeStars(count) {
    stars = [];
    for (let i = 0; i < count; i++) {
      const warm = Math.random() > 0.82;
      stars.push({
        x:     Math.random() * canvas.width,
        y:     Math.random() * canvas.height * 0.85,
        r:     Math.random() * 1.4 + 0.2,
        alpha: Math.random(),
        speed: (Math.random() * 0.006 + 0.002) * (Math.random() > 0.5 ? 1 : -1),
        color: warm
          ? (Math.random() > 0.5 ? '#EAAC2C' : '#D96818')
          : (Math.random() > 0.7 ? '#A4CCEA' : '#FFFFFF'),
      });
    }
  }

  // Draw a 4-point spiky star
  function drawSpike(x, y, outer, inner) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function spawnShooter() {
    const angle = (Math.PI / 5) + Math.random() * (Math.PI / 8);
    const speed = 9 + Math.random() * 7;
    shooters.push({
      x:    Math.random() * canvas.width * 0.75 + 20,
      y:    Math.random() * canvas.height * 0.38,
      dx:   Math.cos(angle) * speed,
      dy:   Math.sin(angle) * speed,
      life: 1,
      decay: 0.022 + Math.random() * 0.012,
      tail: 110 + Math.random() * 90,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Twinkle stars (spiky)
    for (const s of stars) {
      s.alpha += s.speed;
      if (s.alpha <= 0 || s.alpha >= 1) s.speed *= -1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, s.alpha)) * 0.85;
      ctx.fillStyle = s.color;
      drawSpike(s.x, s.y, s.r * 2.2, s.r * 0.35);
      ctx.restore();
    }

    // Shooting stars
    const now = Date.now();
    if (now >= nextShoot) {
      spawnShooter();
      nextShoot = now + 8000 + Math.random() * 9000;
    }
    for (let i = shooters.length - 1; i >= 0; i--) {
      const s = shooters[i];
      s.x += s.dx;
      s.y += s.dy;
      s.life -= s.decay;
      if (s.life <= 0) { shooters.splice(i, 1); continue; }

      const tailX = s.x - s.dx * (s.tail / Math.hypot(s.dx, s.dy));
      const tailY = s.y - s.dy * (s.tail / Math.hypot(s.dx, s.dy));
      const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.7, `rgba(255,240,220,${s.life * 0.5})`);
      grad.addColorStop(1,   `rgba(255,255,255,${s.life})`);

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      // Bright head
      ctx.globalAlpha = s.life * 0.9;
      ctx.fillStyle = '#fff';
      drawSpike(s.x, s.y, 2.5, 0.6);
      ctx.restore();
    }

    requestAnimationFrame(draw);
  }

  resize();
  makeStars(220);
  draw();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); makeStars(220); }, 200);
  });
})();


/* ── Navbar scroll behaviour ───────────────────────────── */
(function initNavbar() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  function update() {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
})();


/* ── Fetch site config and populate dynamic content ────── */
(async function initDynamic() {
  let cfg;
  try {
    const res = await fetch('/api/site-config');
    if (!res.ok) throw new Error('Failed to load config');
    cfg = await res.json();
  } catch (e) {
    // If config fails, leave static fallback content in place
    console.warn('Could not load site config:', e);
    return;
  }

  const { site, events, travel, about, contact } = cfg;

  // ── Hero ──
  if (site?.heroEyebrow) {
    const el = document.getElementById('hero-eyebrow');
    if (el) el.textContent = site.heroEyebrow;
  }
  if (site?.heroSubtitle) {
    const el = document.getElementById('hero-subtitle');
    if (el) el.textContent = site.heroSubtitle;
  }
  if (site?.familyName || site?.title) {
    const el = document.getElementById('hero-name');
    if (el && site.title) {
      // Extract name from title like "Alex Sample's Bar Mitzvah"
      const name = site.title.replace(/['']s Bar Mitzvah.*$/i, '').replace(/Bar Mitzvah.*$/i, '').trim();
      if (name) el.textContent = name;
    }
  }

  // ── RSVP section ──
  if (site?.rsvpDeadline) {
    const d = new Date(site.rsvpDeadline + 'T12:00:00');
    const fmt = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const el = document.getElementById('rsvp-deadline-label');
    if (el) el.textContent = `Kindly Reply By ${fmt}`;
    const intro = document.getElementById('rsvp-intro-text');
    if (intro) {
      intro.textContent = `Each guest receives a personal RSVP link by email. Please use your link to let us know which events you'll be attending. Respond by ${fmt}.`;
    }
  }

  if (site?.rsvpOpen === false) {
    const prompt = document.getElementById('rsvp-link-prompt');
    const closed = document.getElementById('rsvp-closed');
    if (prompt) prompt.style.display = 'none';
    if (closed) {
      closed.style.display = '';
      const msgEl = document.getElementById('rsvp-closed-msg');
      if (msgEl) msgEl.textContent = site.rsvpClosedMessage || 'The RSVP period has now closed. Please contact us directly if you have questions.';
    }
  }

  // Contact info in RSVP box
  if (contact) {
    const nameEl  = document.getElementById('contact-name');
    const emailEl = document.getElementById('contact-email');
    if (nameEl  && contact.fromName)  nameEl.textContent  = contact.fromName;
    if (emailEl && contact.fromEmail) {
      emailEl.textContent = contact.fromEmail;
      emailEl.href        = `mailto:${contact.fromEmail}`;
    }
  }

  // ── Event cards ──
  const cardsEl = document.getElementById('event-cards');
  if (cardsEl && events?.length) {
    // Show up to 3 public events (non-inviteOnly or inviteOnly false)
    const publicEvts = events.filter(e => !e.inviteOnly);
    if (publicEvts.length === 0) {
      // All invite-only — show all anyway on the info page
      renderEventCards(cardsEl, events);
    } else {
      renderEventCards(cardsEl, publicEvts);
    }
  }

  // ── About Alex ──
  if (about) {
    if (about.honoreeBlurb) {
      const blurbEl = document.getElementById('about-blurb');
      if (blurbEl) {
        // Split on double newlines to create paragraphs
        const paragraphs = about.honoreeBlurb.split(/\n\n+/).filter(Boolean);
        blurbEl.innerHTML = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
      }
    }

    if (about.torahPortion) {
      const badgeEl  = document.getElementById('torah-badge');
      const portionEl = document.getElementById('torah-portion-text');
      if (badgeEl)   badgeEl.style.display  = '';
      if (portionEl) {
        portionEl.textContent = about.torahPortion +
          (about.torahPortionDescription ? ` — ${about.torahPortionDescription}` : '');
      }
    }
  }

  // ── Travel ──
  if (travel) {
    // Hotel
    const hotelEl = document.getElementById('hotel-text');
    if (hotelEl) {
      if (travel.hotelName) {
        let html = `We have reserved a room block at <strong>${travel.hotelName}</strong> for the weekend of August 21–23, 2026. Mention the <em>${travel.hotelBookingCode || 'Sample Bar Mitzvah'}</em> when booking.`;
        if (travel.hotelDeadline) {
          const d = new Date(travel.hotelDeadline + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
          html += ` Book by <strong>${d}</strong> to guarantee your rate.`;
        }
        if (travel.hotelBookingUrl) {
          html += ` <a href="${travel.hotelBookingUrl}" target="_blank" rel="noopener">Reserve your room →</a>`;
        }
        if (travel.hotelNotes) html += `<br><br>${travel.hotelNotes}`;
        hotelEl.innerHTML = html;
      } else {
        hotelEl.textContent = 'Hotel block details coming soon — check back closer to the event.';
      }
    }

    // Parking
    const parkingEl = document.getElementById('parking-text');
    if (parkingEl && travel.parkingInfo) {
      parkingEl.textContent = travel.parkingInfo;
    }

    // Airport / Getting here
    const airportEl = document.getElementById('airport-text');
    if (airportEl) {
      if (travel.airportName) {
        let html = `The nearest airport is <strong>${travel.airportName}${travel.airportCode ? ` (${travel.airportCode})` : ''}</strong>. Rideshare (Uber/Lyft) and rental cars are readily available.`;
        if (travel.directionsUrl) {
          html += ` <a href="${travel.directionsUrl}" target="_blank" rel="noopener">Get directions to the venue →</a>`;
        }
        airportEl.innerHTML = html;
      }
    }

    // Dress code — morning service only (evening is invite-only, not shown publicly)
    const dressEl = document.getElementById('dresscode-text');
    if (dressEl && travel.dressCodMorning) {
      dressEl.innerHTML = `<strong>Morning Service:</strong> ${travel.dressCodMorning}`;
    }
  }

  // ── Footer tagline ──
  if (site?.footerTagline) {
    const el = document.getElementById('footer-copy');
    if (el) el.textContent = site.footerTagline;
  }
})();


/* ── Render event cards ────────────────────────────────── */
function renderEventCards(container, events) {
  container.innerHTML = '';
  // Pick a style per event type
  const styles = {
    1: 'ceremony',   // Shabbat
    2: 'ceremony',   // Bar Mitzvah Service
    3: 'reception',  // Evening Celebration
    4: 'breakfast',  // Breakfast
  };

  for (const evt of events) {
    const card = document.createElement('div');
    card.className = `event-card ${styles[evt.id] || 'ceremony'}`;

    const dayFmt = evt.isoDate
      ? new Date(evt.isoDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : evt.displayDate || '';

    const venueLine  = evt.venueName  ? `<p class="event-venue">${evt.venueName}</p>` : '';
    const addrLine   = (evt.address || evt.city) ? `<p class="event-address">${[evt.address, evt.city].filter(Boolean).join('<br>')}</p>` : '';
    const dressLine  = evt.dressCode  ? `<p class="event-detail"><em>👔 ${evt.dressCode}</em></p>` : '';
    const notesLine  = evt.additionalNotes ? `<p class="event-note">${evt.additionalNotes}</p>` : '';

    const iconSvgs = {
      '✡':  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,3 20,18 4,18"/><polygon points="12,21 4,6 20,6"/></svg>`,
      '🕍': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,3 20,18 4,18"/><polygon points="12,21 4,6 20,6"/></svg>`,
      '📖': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h7a3 3 0 013 3v13a2.5 2.5 0 00-2.5-2.5H2V4z"/><path d="M22 4h-7a3 3 0 00-3 3v13a2.5 2.5 0 012.5-2.5H22V4z"/></svg>`,
      '📜': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h7a3 3 0 013 3v13a2.5 2.5 0 00-2.5-2.5H2V4z"/><path d="M22 4h-7a3 3 0 00-3 3v13a2.5 2.5 0 012.5-2.5H22V4z"/></svg>`,
      '🌅': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z"/></svg>`,
      '✨': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z"/></svg>`,
      '🎉': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z"/></svg>`,
      '☕': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><path d="M6 2v2M10 2v2M14 2v2"/></svg>`,
    };
    const defaultIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,3 20,18 4,18"/><polygon points="12,21 4,6 20,6"/></svg>`;

    card.innerHTML = `
      <div class="event-icon">${iconSvgs[evt.emoji] || defaultIcon}</div>
      <h3>${evt.name}</h3>
      <p class="event-time">${evt.time ? evt.time + ' · ' : ''}${dayFmt}</p>
      ${venueLine}
      ${addrLine}
      ${evt.description ? `<p class="event-note">${evt.description}</p>` : ''}
      ${dressLine}
      ${notesLine}`;

    container.appendChild(card);
  }
}


/* ── Smooth scroll for anchor links ────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = 72;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});


/* ── Entrance animations (Intersection Observer) ───────── */
(function initAnimations() {
  const observe = () => {
    const els = document.querySelectorAll('.event-card:not([data-observed]), .travel-card, .about-grid, .section-header');
    if (!('IntersectionObserver' in window)) return;

    els.forEach(el => {
      if (el.dataset.observed) return;
      el.dataset.observed = '1';
      el.style.opacity    = '0';
      el.style.transform  = 'translateY(22px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity   = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    els.forEach(el => observer.observe(el));
  };

  // Run on load + after dynamic content may have been inserted
  observe();
  setTimeout(observe, 600);
})();
