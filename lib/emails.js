/**
 * Alex's Bar Mitzvah — Shared Email Builders
 * Used by both server.js (individual sends) and scripts/ (batch sends).
 */
'use strict';

// ── Shared HTML shell ─────────────────────────────────────────────────────────
function shell(headerHtml, bodyHtml, footerNote, config) {
  const contact = config.contact || {};
  const fromName = contact.fromName || 'Jordan & Taylor Sample';
  const replyTo  = contact.replyTo  || contact.fromEmail || '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,300&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F5EDE6;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#F5EDE6">
<tr><td align="center" style="padding:40px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.1);">

  <!-- Header -->
  <tr><td align="center" style="background:linear-gradient(160deg,#0E0606,#1A0906);padding:44px 40px 36px;">
    <img src="https://rsvp.example.com/logo.png" alt="AS" width="90" style="display:block;margin:0 auto 16px;height:auto;">
    ${headerHtml}
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:40px 48px 32px;">
    ${bodyHtml}
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#0E0606;padding:24px 40px;text-align:center;">
    <p style="margin:0 0 6px;font-family:'Georgia',serif;font-size:22px;font-weight:300;font-style:italic;color:rgba(255,255,255,0.88);">${fromName}</p>
    ${footerNote ? `<p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">${footerNote}</p>` : ''}
    ${replyTo ? `<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.55);">Questions? <a href="mailto:${replyTo}" style="color:#EAAC2C;">${replyTo}</a></p>` : ''}
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Greeting helper ───────────────────────────────────────────────────────────
function greetingName(guest) {
  // Use first name if available and short, otherwise household name
  if (guest.firstName && guest.firstName.length < 20) return guest.firstName;
  return guest.household || guest.name;
}

// ── Guest count phrase ────────────────────────────────────────────────────────
function guestPhrase(count) {
  if (!count || count <= 1) return 'you';
  if (count === 2) return 'you and your guest';
  return `you and your ${count - 1} guests`;
}

// ── RSVP button ───────────────────────────────────────────────────────────────
function rsvpButton(url) {
  return `<table cellpadding="0" cellspacing="0" width="100%">
  <tr><td align="center" style="padding:8px 0 32px;">
    <a href="${url}" style="display:inline-block;padding:16px 52px;background:linear-gradient(135deg,#C83A18,#D96818,#EAAC2C);color:#fff;text-decoration:none;border-radius:50px;font-family:'Georgia',serif;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">
      RSVP Now
    </a>
  </td></tr>
</table>
<p style="margin:0;font-size:11px;color:#9B7060;">Or copy this link: <a href="${url}" style="color:#C83A18;word-break:break-all;">${url}</a></p>`;
}

// ── Deadline line ─────────────────────────────────────────────────────────────
function deadlineLine(config) {
  if (!config.site?.rsvpDeadline) return '';
  const d = new Date(config.site.rsvpDeadline + 'T12:00:00');
  const fmt = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `<tr><td style="background:#FDF5F0;padding:14px 48px;border-top:1px solid #F0E0D8;text-align:center;">
    <p style="margin:0;font-size:16px;color:#C83A18;font-weight:600;">Kindly reply by <strong style="color:#EAAC2C;">${fmt}</strong></p>
  </td></tr>`;
}

// ── Plain text helper ─────────────────────────────────────────────────────────
function plainText(lines) {
  return lines.filter(Boolean).join('\n\n');
}

// ── Body text → HTML paragraphs ───────────────────────────────────────────────
// Preserves paragraph breaks (blank lines) and soft line breaks within paragraphs.
function bodyToHtml(text) {
  if (!text) return '';
  return text.split(/\n\n+/).map(para =>
    `<p style="margin:0 0 16px;font-size:15px;color:#5A3020;line-height:1.8;">${para.trim().replace(/\n/g, '<br>')}</p>`
  ).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// SAVE THE DATE
// ══════════════════════════════════════════════════════════════════════════════
function buildSaveTheDateHtml(guest, config) {
  const tmpl    = config.saveTheDate || {};
  const siteUrl = tmpl.websiteUrl || 'https://rsvp.example.com';
  const name    = greetingName(guest);

  const header = `
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.4);">
      Save the Date
    </p>
    <h1 style="margin:0 0 10px;font-family:'Georgia',serif;font-size:36px;font-weight:300;font-style:italic;color:#fff;line-height:1.2;">
      the Bar Mitzvah of
    </h1>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 60" width="420" style="display:block;margin:0 auto 18px;max-width:100%;"><text x="210" y="48" font-family="Georgia, serif" font-size="44" font-weight="300" font-style="italic" text-anchor="middle" fill="#EAAC2C">Alex Sample</text></svg>
    <p style="margin:0;font-size:13px;letter-spacing:3px;color:rgba(255,255,255,0.5);text-transform:uppercase;">
      August 22, 2026 &nbsp;·&nbsp; Saturday
    </p>`;

  const body = `
    <p style="margin:0 0 20px;font-size:16px;color:#5A3020;">Dear ${name},</p>
    <p style="margin:0 0 20px;font-size:15px;color:#5A3020;line-height:1.8;">
      ${tmpl.openingLine || 'We are so excited to share with you that our son Alex is becoming a Bar Mitzvah, and we would love for you to celebrate with us.'}
    </p>

    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="background:#FDF5F0;border-radius:12px;padding:24px 28px;text-align:center;">
        <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9B7060;">Please save the date</p>
        <p style="margin:0 0 4px;font-family:'Georgia',serif;font-size:32px;font-weight:300;font-style:italic;color:#C83A18;">Saturday, August 22, 2026</p>
        <p style="margin:0;font-size:13px;color:#9B7060;">Chicago, IL</p>
      </td></tr>
    </table>

    <p style="margin:24px 0;font-size:15px;color:#5A3020;line-height:1.8;">
      ${tmpl.closingLine || 'Formal invitations with full details will follow. We can\'t wait to celebrate with you!'}
    </p>

    <table cellpadding="0" cellspacing="0" width="100%">
      <tr><td align="center" style="padding:0 0 24px;">
        <a href="${siteUrl}" style="display:inline-block;padding:14px 40px;background:rgba(200,58,24,0.08);border:1px solid rgba(200,58,24,0.25);color:#C83A18;text-decoration:none;border-radius:50px;font-family:'Georgia',serif;font-size:13px;letter-spacing:1.5px;">
          Visit the Event Website →
        </a>
      </td></tr>
    </table>`;

  return shell(header, body, 'Formal invitation to follow.', config);
}

function buildSaveTheDateText(guest, config) {
  const tmpl = config.saveTheDate || {};
  const name = greetingName(guest);
  return plainText([
    `Dear ${name},`,
    tmpl.openingLine || 'We are so excited to share that our son Alex is becoming a Bar Mitzvah, and we would love for you to celebrate with us.',
    'SAVE THE DATE\nSaturday, August 22, 2026 · Chicago, IL',
    tmpl.closingLine || 'Formal invitations with full details will follow.',
    `Visit: ${tmpl.websiteUrl || 'https://rsvp.example.com'}`,
    `— ${config.contact?.fromName || 'Jordan & Taylor Sample'}`,
  ]);
}

// ── Email divider (fading lines + diamond) ───────────────────────────────────
function emailDivider(topPad) {
  const pad = topPad || 8;
  return `<tr><td style="padding:${pad}px 40px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="middle">
      <td style="padding:0;"><div style="height:1px;background:linear-gradient(to right,rgba(184,92,56,0) 0%,rgba(184,92,56,0.32) 100%);font-size:0;line-height:0;"></div></td>
      <td style="width:24px;text-align:center;padding:0 5px;line-height:1;"><span style="font-size:10px;color:#B85C38;">&#9670;</span></td>
      <td style="padding:0;"><div style="height:1px;background:linear-gradient(to left,rgba(184,92,56,0) 0%,rgba(184,92,56,0.32) 100%);font-size:0;line-height:0;"></div></td>
    </tr></table>
  </td></tr>`;
}

// ── Event icon for email (hosted PNG — works in Gmail, Outlook, Apple Mail) ───
// Gmail blocks data: URIs in CSS background-image; <img> with an absolute HTTPS
// URL is the only approach that renders reliably across all major clients.
function emailEventIcon(emoji) {
  const iconMap = {
    '✡':  'event-star',
    '🕍': 'event-book',
    '🌅': 'event-sparkle',
    '✨': 'event-sparkle',
    '☕': 'event-coffee',
  };
  const name = iconMap[emoji] || 'event-star';
  const url  = `https://rsvp.example.com/icons/${name}.png`;
  return `<td style="width:36px;vertical-align:top;padding-top:3px;">
    <table cellpadding="0" cellspacing="0" border="0" style="width:28px;height:28px;background-color:#f8f0ec;border:1px solid #e0c0b0;" bgcolor="#f8f0ec">
      <tr><td align="center" valign="middle" style="padding:0;">
        <img src="${url}" width="14" height="14" alt="" border="0" style="display:block;outline:none;">
      </td></tr>
    </table>
  </td>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// INVITATION
// ══════════════════════════════════════════════════════════════════════════════
function buildInviteHtml(guest, config, siteUrl) {
  const tmpl      = config.emailTemplates?.invitation || {};
  const allEvents = config.events || [];
  const rsvpUrl   = `${siteUrl}/rsvp/${guest.token}`;
  const contact   = config.contact || {};
  const replyTo   = contact.replyTo || contact.fromEmail || '';
  const count     = guest.guestCount || 1;

  const guestEvents = allEvents.filter(e => guest.events.includes(e.id));

  const eventRows = guestEvents.map(e => {
    const date = e.isoDate
      ? new Date(e.isoDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
      : e.displayDate || '';
    const venueLine = e.venueName
      ? `<div style="font-size:13px;font-weight:600;color:#2C1810;margin-bottom:2px;">${e.venueName}</div>` : '';
    const addrLine  = (e.address || e.city)
      ? `<div style="font-size:12px;color:#8B6050;margin-bottom:6px;">${[e.address, e.city].filter(Boolean).join(', ')}</div>` : '';
    return `<tr><td style="padding:5px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDFAF7;border:1px solid rgba(184,92,56,0.16);border-radius:8px;"><tr><td style="padding:14px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          ${emailEventIcon(e.emoji)}
          <td style="padding-left:12px;vertical-align:top;">
            <div style="font-family:'Georgia',serif;font-size:16px;font-style:italic;color:#B85C38;margin-bottom:3px;">${e.name}</div>
            ${venueLine}${addrLine}
            <span style="display:inline-block;padding:3px 10px;background:rgba(184,92,56,0.07);border:1px solid rgba(184,92,56,0.14);border-radius:20px;font-size:11px;color:#8B6050;margin-right:6px;">${date}</span>
            <span style="display:inline-block;padding:3px 10px;background:rgba(184,92,56,0.07);border:1px solid rgba(184,92,56,0.14);border-radius:20px;font-size:11px;color:#8B6050;">${e.time}</span>
          </td>
        </tr></table>
      </td></tr></table>
    </td></tr>`;
  }).join('');

  const guestNote = count > 1
    ? `<p style="margin:0 0 0 0;font-family:'Georgia',serif;font-size:14px;font-style:italic;color:#9B7060;">We are delighted to welcome ${guestPhrase(count)} to celebrate with us.</p>` : '';

  const deadline = config.site?.rsvpDeadline
    ? (() => {
        const d = new Date(config.site.rsvpDeadline + 'T12:00:00');
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      })() : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,600;1,300;1,600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F5EDE6;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#F5EDE6">
<tr><td align="center" style="padding:40px 16px 48px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FDFAF7;border-radius:20px;overflow:hidden;box-shadow:0 4px 40px rgba(0,0,0,0.1);">

  <!-- Logo -->
  <tr><td align="center" style="padding:44px 40px 0;">
    <img src="https://rsvp.example.com/logo.png" alt="AS" width="80" style="display:block;margin:0 auto;height:auto;">
  </td></tr>

  <!-- Divider -->
  ${emailDivider(20)}

  <!-- Host + Alex headline -->
  <tr><td align="center" style="padding:8px 40px 0;">
    <p style="margin:0 0 6px;font-family:'Georgia',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#C4A898;">Together with their family</p>
    <p style="margin:0 0 4px;font-family:'Georgia',serif;font-size:24px;font-weight:600;color:#2C1810;">${contact.fromName || 'Jordan &amp; Taylor Sample'}</p>
    <p style="margin:0 0 20px;font-family:'Georgia',serif;font-size:15px;font-style:italic;color:#8B6050;">joyfully invite you to celebrate the Bar Mitzvah of their son</p>
    <p style="margin:0 0 4px;font-family:'Georgia',serif;font-size:64px;font-weight:600;color:#B85C38;line-height:1;">Alex Joel</p>
    <p style="margin:0 0 8px;font-family:'Georgia',serif;font-size:14px;letter-spacing:5px;text-transform:uppercase;color:#2C1810;">Sample</p>
    <p style="margin:0;font-family:'Georgia',serif;font-size:13px;font-style:italic;color:#9B7060;">as he is called to the Torah</p>
  </td></tr>

  ${emailDivider()}

  <!-- Weekend of celebrations -->
  <tr><td style="padding:4px 40px 8px;">
    <p style="margin:0 0 18px;font-family:'Georgia',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#C4A898;text-align:center;">Weekend of Celebrations</p>
    <table width="100%" cellpadding="0" cellspacing="0">${eventRows}</table>
  </td></tr>

  ${emailDivider()}

  <!-- RSVP CTA -->
  <tr><td align="center" style="padding:20px 40px 0;">
    <p style="margin:0 0 20px;font-family:'Georgia',serif;font-size:14px;font-style:italic;color:#8B6050;">${deadline ? `Kindly respond by <strong style="color:#B85C38;">${deadline}</strong>` : 'Kindly respond at your earliest convenience'}</p>
    <a href="${rsvpUrl}" style="display:inline-block;padding:15px 52px;background:#B85C38;color:#fff;text-decoration:none;border-radius:50px;font-family:'Georgia',serif;font-size:12px;font-weight:bold;letter-spacing:2.5px;text-transform:uppercase;">RSVP Now</a>
    <p style="margin:14px 0 0;font-size:11px;color:#C4A898;">Or copy this link: <a href="${rsvpUrl}" style="color:#B85C38;word-break:break-all;">${rsvpUrl}</a></p>
  </td></tr>

  <!-- Footer -->
  <tr><td align="center" style="padding:28px 40px 36px;">
    ${replyTo ? `<p style="margin:0 0 12px;font-family:'Georgia',serif;font-size:13px;color:#9B7060;">Questions? <a href="mailto:${replyTo}" style="color:#B85C38;text-decoration:none;">${replyTo}</a></p>` : ''}
    <p style="margin:0;font-family:'Georgia',serif;font-size:13px;font-style:italic;color:#C4A898;">We look forward to celebrating this joyful milestone with you.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildInviteText(guest, config, siteUrl) {
  const tmpl      = config.emailTemplates?.invitation || {};
  const allEvents = config.events || [];
  const rsvpUrl   = `${siteUrl}/rsvp/${guest.token}`;
  const name      = greetingName(guest);
  const guestEvents = allEvents.filter(e => guest.events.includes(e.id));
  const evtLines  = guestEvents.map(e => {
    const date = e.isoDate
      ? new Date(e.isoDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : e.displayDate || '';
    return `  ${e.emoji || '✡'} ${e.name}\n  ${date} · ${e.time}`;
  }).join('\n\n');
  return plainText([
    `Dear ${name},`,
    tmpl.openingLine || 'We are so pleased to invite you to celebrate with us as our son Alex becomes a Bar Mitzvah.',
    `YOUR INVITATIONS:\n${evtLines}`,
    tmpl.closingLine || 'Please RSVP using your personal link below.',
    `RSVP: ${rsvpUrl}`,
    `— ${config.contact?.fromName || 'Jordan & Taylor Sample'}`,
  ]);
}

// ── Pre-event group resolver ──────────────────────────────────────────────────
// Checks config.emailTemplates.preEvent.groups (array) for the first group
// whose ifAnyEventIn list overlaps the guest's attendingEventIds.
// Falls back to top-level preEvent values, then hardcoded defaults.
function resolvePreEventGroup(config, attendingEventIds) {
  const tmpl   = config.emailTemplates?.preEvent || {};
  const groups = Array.isArray(tmpl.groups) ? tmpl.groups : [];
  const ids    = attendingEventIds || [];
  const match  = groups.find(g =>
    Array.isArray(g.ifAnyEventIn) && g.ifAnyEventIn.some(id => ids.includes(id))
  );
  return {
    subject:     match?.subject     || tmpl.subject     || "We can't wait to see you — Alex's Bar Mitzvah is almost here!",
    body:        match?.body        || tmpl.body        || null,
    openingLine: match?.openingLine || tmpl.openingLine || "We are so excited to celebrate with you in just a few days! Here are all the details you'll need.",
    closingLine: match?.closingLine || tmpl.closingLine || "If you have any questions, please don't hesitate to reach out. We can't wait to see you there!",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// REMINDER
// ══════════════════════════════════════════════════════════════════════════════
function buildReminderHtml(guest, config, siteUrl) {
  const tmpl      = config.emailTemplates?.reminder || {};
  const rsvpUrl   = `${siteUrl}/rsvp/${guest.token}`;
  const name      = greetingName(guest);
  const allEvents = config.events || [];
  const guestEvents = allEvents.filter(e => guest.events.includes(e.id));
  const contact   = config.contact || {};
  const replyTo   = contact.replyTo || contact.fromEmail || '';

  const deadline = config.site?.rsvpDeadline
    ? new Date(config.site.rsvpDeadline + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const eventRows = guestEvents.map(e => {
    const date = e.isoDate
      ? new Date(e.isoDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
      : e.displayDate || '';
    const venueLine = e.venueName ? `<div style="font-size:13px;font-weight:600;color:#2C1810;margin-bottom:2px;">${e.venueName}</div>` : '';
    const addrLine  = (e.address || e.city)
      ? `<div style="font-size:12px;color:#8B6050;margin-bottom:6px;">${[e.address, e.city].filter(Boolean).join(', ')}</div>` : '';
    return `<tr><td style="padding:5px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDFAF7;border:1px solid rgba(184,92,56,0.16);border-radius:8px;"><tr><td style="padding:14px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          ${emailEventIcon(e.emoji)}
          <td style="padding-left:12px;vertical-align:top;">
            <div style="font-family:'Georgia',serif;font-size:16px;font-style:italic;color:#B85C38;margin-bottom:3px;">${e.name}</div>
            ${venueLine}${addrLine}
            <span style="display:inline-block;padding:3px 10px;background:rgba(184,92,56,0.07);border:1px solid rgba(184,92,56,0.14);border-radius:20px;font-size:11px;color:#8B6050;margin-right:6px;">${date}</span>
            <span style="display:inline-block;padding:3px 10px;background:rgba(184,92,56,0.07);border:1px solid rgba(184,92,56,0.14);border-radius:20px;font-size:11px;color:#8B6050;">${e.time}</span>
          </td>
        </tr></table>
      </td></tr></table>
    </td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,600;1,300;1,600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F5EDE6;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#F5EDE6">
<tr><td align="center" style="padding:40px 16px 48px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FDFAF7;border-radius:20px;overflow:hidden;box-shadow:0 4px 40px rgba(0,0,0,0.1);">

  <!-- Logo -->
  <tr><td align="center" style="padding:44px 40px 0;">
    <img src="https://rsvp.example.com/logo.png" alt="AS" width="80" style="display:block;margin:0 auto;height:auto;">
  </td></tr>

  ${emailDivider(20)}

  <!-- Title -->
  <tr><td align="center" style="padding:8px 40px 0;">
    <p style="margin:0 0 6px;font-family:'Georgia',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#C4A898;">A gentle reminder</p>
    <p style="margin:0 0 4px;font-family:'Georgia',serif;font-size:24px;font-weight:600;color:#2C1810;">${contact.fromName || 'Jordan &amp; Taylor Sample'}</p>
    <p style="margin:0 0 20px;font-family:'Georgia',serif;font-size:15px;font-style:italic;color:#8B6050;">would love to hear from you</p>
  </td></tr>

  ${emailDivider()}

  <!-- Body -->
  <tr><td style="padding:20px 40px 8px;">
    <p style="margin:0 0 18px;font-size:16px;color:#5A3020;">Dear ${name},</p>
    <p style="margin:0 0 18px;font-size:15px;color:#5A3020;line-height:1.8;">${tmpl.openingLine || 'We wanted to send a friendly reminder that the RSVP deadline is coming up soon.'}</p>
    ${deadline ? `<p style="margin:0 0 20px;font-family:'Georgia',serif;font-size:14px;font-style:italic;color:#8B6050;">Kindly respond by <strong style="color:#B85C38;">${deadline}</strong></p>` : ''}
    <p style="margin:0 0 10px;font-family:'Georgia',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#C4A898;">Your Events</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">${eventRows}</table>
    <p style="margin:0 0 8px;font-size:15px;color:#5A3020;line-height:1.8;">${tmpl.closingLine || "If you've already responded, thank you! If not, we'd love to hear from you."}</p>
  </td></tr>

  ${emailDivider()}

  <!-- RSVP CTA -->
  <tr><td align="center" style="padding:20px 40px 0;">
    <a href="${rsvpUrl}" style="display:inline-block;padding:15px 52px;background:#B85C38;color:#fff;text-decoration:none;border-radius:50px;font-family:'Georgia',serif;font-size:12px;font-weight:bold;letter-spacing:2.5px;text-transform:uppercase;">RSVP Now</a>
    <p style="margin:14px 0 0;font-size:11px;color:#C4A898;">Or copy this link: <a href="${rsvpUrl}" style="color:#B85C38;word-break:break-all;">${rsvpUrl}</a></p>
  </td></tr>

  <!-- Footer -->
  <tr><td align="center" style="padding:28px 40px 36px;">
    ${replyTo ? `<p style="margin:0 0 12px;font-family:'Georgia',serif;font-size:13px;color:#9B7060;">Questions? <a href="mailto:${replyTo}" style="color:#B85C38;text-decoration:none;">${replyTo}</a></p>` : ''}
    <p style="margin:0;font-family:'Georgia',serif;font-size:13px;font-style:italic;color:#C4A898;">We look forward to celebrating this joyful milestone with you.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildReminderText(guest, config, siteUrl) {
  const tmpl      = config.emailTemplates?.reminder || {};
  const rsvpUrl   = `${siteUrl}/rsvp/${guest.token}`;
  const name      = greetingName(guest);
  const allEvents = config.events || [];
  const guestEvents = allEvents.filter(e => guest.events.includes(e.id));
  const deadline  = config.site?.rsvpDeadline
    ? new Date(config.site.rsvpDeadline + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const evtLines = guestEvents.map(e => {
    const date = e.isoDate
      ? new Date(e.isoDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : e.displayDate || '';
    return `  ${e.emoji || '✡'} ${e.name}\n  ${date} · ${e.time}`;
  }).join('\n\n');
  return plainText([
    `Dear ${name},`,
    tmpl.openingLine || 'We wanted to send a friendly reminder that the RSVP deadline is coming up soon.',
    deadline ? `Kindly respond by ${deadline}.` : null,
    `YOUR EVENTS:\n${evtLines}`,
    tmpl.closingLine || "If you've already responded, thank you! If not, we'd love to hear from you.",
    `RSVP: ${rsvpUrl}`,
    `— ${config.contact?.fromName || 'Jordan & Taylor Sample'}`,
  ]);
}

// ══════════════════════════════════════════════════════════════════════════════
// PRE-EVENT UPDATE
// ══════════════════════════════════════════════════════════════════════════════
function buildPreEventHtml(guest, config, siteUrl, attendingEventIds) {
  const tmpl        = resolvePreEventGroup(config, attendingEventIds);
  const travel      = config.travel || {};
  const name        = greetingName(guest);
  const allEvents   = config.events || [];
  const evts        = allEvents.filter(e => attendingEventIds.includes(e.id));
  const contact     = config.contact || {};
  const replyTo     = contact.replyTo || contact.fromEmail || '';
  const previewText = config.emailTemplates?.preEvent?.previewText || '';

  const eventRows = evts.map(e => {
    const date = e.isoDate
      ? new Date(e.isoDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
      : e.displayDate || '';
    const venueLine = e.venueName
      ? `<div style="font-size:13px;font-weight:600;color:#2C1810;margin-bottom:2px;">${e.venueName}</div>` : '';
    const addrLine  = (e.address || e.city)
      ? `<div style="font-size:12px;color:#8B6050;margin-bottom:6px;">${[e.address, e.city].filter(Boolean).join(', ')}</div>` : '';
    const dressLine = e.dressCode
      ? `<div style="font-size:12px;color:#9B7060;font-style:italic;margin-top:4px;">Attire: ${e.dressCode}</div>` : '';
    const notesLine = e.additionalNotes
      ? `<div style="font-size:12px;color:#9B7060;margin-top:4px;">${e.additionalNotes}</div>` : '';
    return `<tr><td style="padding:5px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDFAF7;border:1px solid rgba(184,92,56,0.16);border-radius:8px;"><tr><td style="padding:14px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          ${emailEventIcon(e.emoji)}
          <td style="padding-left:12px;vertical-align:top;">
            <div style="font-family:'Georgia',serif;font-size:16px;font-style:italic;color:#B85C38;margin-bottom:3px;">${e.name}</div>
            ${venueLine}${addrLine}
            <span style="display:inline-block;padding:3px 10px;background:rgba(184,92,56,0.07);border:1px solid rgba(184,92,56,0.14);border-radius:20px;font-size:11px;color:#8B6050;margin-right:6px;">${date}</span>
            <span style="display:inline-block;padding:3px 10px;background:rgba(184,92,56,0.07);border:1px solid rgba(184,92,56,0.14);border-radius:20px;font-size:11px;color:#8B6050;">${e.time}</span>
            ${dressLine}${notesLine}
          </td>
        </tr></table>
      </td></tr></table>
    </td></tr>`;
  }).join('');

  const parkingHtml = travel.parkingInfo
    ? `<tr><td style="padding:12px 16px;background:#FDFAF7;border:1px solid rgba(184,92,56,0.16);border-radius:8px;margin-bottom:8px;">
        <div style="font-family:'Georgia',serif;font-size:13px;font-weight:600;color:#2C1810;margin-bottom:4px;">Parking</div>
        <div style="font-size:13px;color:#5A3020;line-height:1.6;">${travel.parkingInfo}</div>
      </td></tr>` : '';
  const hotelHtml = travel.hotelName
    ? `<tr><td style="padding:12px 16px;background:#FDFAF7;border:1px solid rgba(184,92,56,0.16);border-radius:8px;">
        <div style="font-family:'Georgia',serif;font-size:13px;font-weight:600;color:#2C1810;margin-bottom:4px;">Hotel</div>
        <div style="font-size:13px;color:#5A3020;line-height:1.6;">${travel.hotelName}${travel.hotelBookingCode ? ` — mention &ldquo;${travel.hotelBookingCode}&rdquo; when booking` : ''}</div>
      </td></tr>` : '';
  const travelSection = (parkingHtml || hotelHtml)
    ? `${emailDivider()}
       <tr><td style="padding:4px 40px 8px;">
         <p style="margin:0 0 10px;font-family:'Georgia',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#C4A898;">Getting There</p>
         <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 8px;">${parkingHtml}${hotelHtml}</table>
       </td></tr>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,600;1,300;1,600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F5EDE6;font-family:'Georgia',serif;">
${previewText ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#F5EDE6;">${previewText}&nbsp;${'&zwnj;&nbsp;'.repeat(50)}</div>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#F5EDE6">
<tr><td align="center" style="padding:40px 16px 48px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FDFAF7;border-radius:20px;overflow:hidden;box-shadow:0 4px 40px rgba(0,0,0,0.1);">

  <!-- Logo -->
  <tr><td align="center" style="padding:44px 40px 0;">
    <img src="https://rsvp.example.com/logo.png" alt="AS" width="80" style="display:block;margin:0 auto;height:auto;">
  </td></tr>

  ${emailDivider(20)}

  <!-- Title -->
  <tr><td align="center" style="padding:8px 40px 0;">
    <p style="margin:0 0 6px;font-family:'Georgia',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#C4A898;">We can't wait to see you!</p>
    <p style="margin:0 0 4px;font-family:'Georgia',serif;font-size:24px;font-weight:600;color:#2C1810;">${contact.fromName || 'Jordan &amp; Taylor Sample'}</p>
    <p style="margin:0 0 20px;font-family:'Georgia',serif;font-size:15px;font-style:italic;color:#8B6050;">Alex&rsquo;s Bar Mitzvah · August 22, 2026</p>
  </td></tr>

  ${emailDivider()}

  <!-- Body -->
  <tr><td style="padding:20px 40px 8px;">
    <p style="margin:0 0 18px;font-size:16px;color:#5A3020;">Dear ${name},</p>
    ${tmpl.body ? bodyToHtml(tmpl.body) : `<p style="margin:0 0 20px;font-size:15px;color:#5A3020;line-height:1.8;">${tmpl.openingLine || "We're so excited to celebrate with you soon! Here are all the details you'll need."}</p>`}
    <p style="margin:0 0 10px;font-family:'Georgia',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#C4A898;">Your Events</p>
    <table width="100%" cellpadding="0" cellspacing="0">${eventRows}</table>
  </td></tr>

  ${travelSection}

  ${emailDivider()}

  <!-- Closing (only shown when no body field is set) -->
  ${tmpl.body ? '' : `<tr><td align="center" style="padding:20px 40px 0;">
    <p style="margin:0 0 8px;font-family:'Georgia',serif;font-size:15px;font-style:italic;color:#8B6050;">${tmpl.closingLine || "We can't wait to celebrate this joyful milestone together!"}</p>
  </td></tr>`}

  <!-- Footer -->
  <tr><td align="center" style="padding:20px 40px 36px;">
    ${replyTo ? `<p style="margin:0 0 12px;font-family:'Georgia',serif;font-size:13px;color:#9B7060;">Questions? <a href="mailto:${replyTo}" style="color:#B85C38;text-decoration:none;">${replyTo}</a></p>` : ''}
    <p style="margin:0;font-family:'Georgia',serif;font-size:13px;font-style:italic;color:#C4A898;">With love, ${contact.fromName || 'Jordan &amp; Taylor Sample'}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// RSVP CONFIRMATION (sent to guest immediately after submission)
// ══════════════════════════════════════════════════════════════════════════════
function buildRsvpConfirmationHtml(guest, rsvp, config, siteUrl) {
  const name        = greetingName(guest);
  const isAttending = rsvp.attending;
  const contact     = config.contact || {};
  const replyTo     = contact.replyTo || contact.fromEmail || '';
  const siteEvents  = config.events || [];
  const acceptedEvts = siteEvents.filter(e => rsvp.events && rsvp.events[String(e.id)] === true);

  const evtCards = acceptedEvts.map(e => {
    const dayFmt = e.isoDate
      ? new Date(e.isoDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
      : e.displayDate || '';
    const venueLine = e.venueName ? `<div style="font-size:13px;font-weight:600;color:#2C1810;margin-bottom:2px;">${e.venueName}</div>` : '';
    const addrLine  = (e.address || e.city) ? `<div style="font-size:12px;color:#8B6050;margin-bottom:6px;">${[e.address, e.city].filter(Boolean).join(', ')}</div>` : '';
    return `<tr><td style="padding:5px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDFAF7;border:1px solid rgba(184,92,56,0.16);border-radius:8px;"><tr><td style="padding:12px 14px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          ${emailEventIcon(e.emoji)}
          <td style="padding-left:10px;vertical-align:top;">
            <div style="font-family:'Georgia',serif;font-size:15px;font-style:italic;color:#B85C38;margin-bottom:2px;">${e.name}</div>
            ${venueLine}${addrLine}
            <span style="display:inline-block;padding:2px 9px;background:rgba(184,92,56,0.07);border:1px solid rgba(184,92,56,0.14);border-radius:20px;font-size:11px;color:#8B6050;margin-right:4px;">${dayFmt}</span>
            <span style="display:inline-block;padding:2px 9px;background:rgba(184,92,56,0.07);border:1px solid rgba(184,92,56,0.14);border-radius:20px;font-size:11px;color:#8B6050;">${e.time}</span>
          </td>
        </tr></table>
      </td></tr></table>
    </td></tr>`;
  }).join('');

  const evtSection = acceptedEvts.length > 0 ? `
    <p style="margin:0 0 10px;font-family:'Georgia',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#C4A898;text-align:center;">Events You're Attending</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">${evtCards}</table>` : '';

  const hoodiesHtml = Array.isArray(rsvp.hoodiesSizes) && rsvp.hoodiesSizes.length > 0
    ? `<p style="margin:0 0 6px;font-family:'Georgia',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#C4A898;text-align:center;">Hoodie Sizes</p>
       <p style="margin:0 0 20px;font-size:14px;color:#8B6050;text-align:center;">${rsvp.hoodiesSizes.join(', ')}</p>` : '';

  const rsvpUrl = siteUrl ? `${siteUrl}/rsvp/${guest.token}` : '';
  const updateBtn = rsvpUrl ? `<table cellpadding="0" cellspacing="0" width="100%">
    <tr><td align="center" style="padding:4px 0 8px;">
      <a href="${rsvpUrl}" style="display:inline-block;padding:14px 48px;background:linear-gradient(to right,#9E3A22,#C87040);color:#fff;text-decoration:none;border-radius:50px;font-family:'Georgia',serif;font-size:11px;font-weight:bold;letter-spacing:2.5px;text-transform:uppercase;">Update My RSVP</a>
    </td></tr>
  </table>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,600;1,300;1,600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#F5EDE6;font-family:'Georgia',serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#F5EDE6">
<tr><td align="center" style="padding:40px 16px 48px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FDFAF7;border-radius:10px;border:1px solid rgba(184,92,56,0.22);overflow:hidden;box-shadow:0 4px 40px rgba(0,0,0,0.1);">

  <!-- Logo -->
  <tr><td align="center" style="padding:40px 40px 0;">
    <img src="https://rsvp.example.com/logo.png" alt="AS" width="90" style="display:block;margin:0 auto;height:auto;">
  </td></tr>

  ${emailDivider(20)}

  <!-- Title -->
  <tr><td align="center" style="padding:4px 40px 8px;">
    <p style="margin:0 0 6px;font-family:'Georgia',serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#9B7060;">${isAttending ? 'RSVP Confirmed' : 'RSVP Received'}</p>
    <p style="margin:0 0 6px;font-family:'Georgia',serif;font-size:52px;font-weight:400;font-style:italic;color:#B85C38;line-height:1.05;">${isAttending ? 'Toda Raba!' : 'We\'ll Miss You'}</p>
    <p style="margin:0;font-family:'Georgia',serif;font-size:14px;font-style:italic;color:#8B6050;">${isAttending
      ? `Thank you, ${name} — we\'re so glad you\'ll be celebrating with us.`
      : `Thank you, ${name} — Alex sends his warmest wishes.`}</p>
  </td></tr>

  ${emailDivider()}

  <!-- Event summary -->
  <tr><td style="padding:4px 40px 8px;">
    ${evtSection}
    ${hoodiesHtml}
    ${updateBtn}
  </td></tr>

  <!-- Footer -->
  <tr><td align="center" style="padding:8px 40px 36px;">
    ${replyTo ? `<p style="margin:0 0 10px;font-family:'Georgia',serif;font-size:13px;color:#9B7060;">Questions? <a href="mailto:${replyTo}" style="color:#B85C38;text-decoration:none;">${replyTo}</a></p>` : ''}
    <p style="margin:0;font-family:'Georgia',serif;font-size:13px;font-style:italic;color:#C4A898;">We look forward to celebrating this joyful milestone with you.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildRsvpConfirmationText(guest, rsvp, config) {
  const name        = greetingName(guest);
  const isAttending = rsvp.attending;
  const siteEvents  = config.events || [];
  const acceptedEvts = siteEvents.filter(e => rsvp.events && rsvp.events[String(e.id)] === true);
  const siteUrl     = config.saveTheDate?.websiteUrl || '';

  const lines = [
    isAttending ? 'Toda Raba! Your RSVP is confirmed.' : "We'll Miss You — RSVP received.",
    '',
    `Dear ${name},`,
    '',
    isAttending
      ? "Thank you for your RSVP — we're so glad you'll be joining us to celebrate Alex's Bar Mitzvah!"
      : "Thank you for letting us know. We'll miss having you with us.",
  ];

  if (acceptedEvts.length > 0) {
    lines.push('', 'EVENTS YOU\'RE ATTENDING', '─────────────────────────────');
    for (const e of acceptedEvts) {
      const dayFmt = e.isoDate
        ? new Date(e.isoDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : e.displayDate || '';
      lines.push('', `${e.emoji || ''} ${e.name}`, `${dayFmt} · ${e.time}`);
      if (e.venueName) lines.push(e.venueName);
      if (e.address || e.city) lines.push([e.address, e.city].filter(Boolean).join(', '));
    }
  }

  if (Array.isArray(rsvp.hoodiesSizes) && rsvp.hoodiesSizes.length > 0) {
    lines.push('', 'HOODIE SIZES', '─────────────────────────────', rsvp.hoodiesSizes.join(', '));
  }

  if (siteUrl) lines.push('', `View event details: ${siteUrl}`);
  lines.push('', '— Jordan & Taylor Sample');
  return lines.join('\n');
}

// ── Create nodemailer transporter ─────────────────────────────────────────────
function createTransporter(config) {
  let nodemailer;
  try { nodemailer = require('nodemailer'); }
  catch { throw new Error('nodemailer not installed — run: npm install'); }

  const contact = config.contact || {};
  if (!contact.gmailUser || !contact.gmailAppPassword || contact.gmailAppPassword === 'REPLACE_WITH_YOUR_APP_PASSWORD') {
    throw new Error('Gmail not configured. Add your App Password in Settings → Email & Contact.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: contact.gmailUser, pass: contact.gmailAppPassword },
  });
}

// ── Send one email ────────────────────────────────────────────────────────────
async function sendEmail({ to, name, subject, html, text }, config) {
  const transporter = createTransporter(config);
  const contact     = config.contact || {};
  return transporter.sendMail({
    from:    `"${contact.fromName || 'Jordan & Taylor Sample'}" <${contact.gmailUser}>`,
    to:      name ? `"${name}" <${to}>` : to,
    replyTo: contact.replyTo || contact.fromEmail,
    subject,
    text,
    html,
  });
}

module.exports = {
  buildSaveTheDateHtml, buildSaveTheDateText,
  buildInviteHtml, buildInviteText,
  buildReminderHtml, buildReminderText,
  buildPreEventHtml,
  buildRsvpConfirmationHtml, buildRsvpConfirmationText,
  sendEmail,
  greetingName,
  resolvePreEventGroup,
  bodyToHtml,
};
