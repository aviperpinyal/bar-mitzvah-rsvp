#!/usr/bin/env node
/**
 * Alex's Bar Mitzvah — Send Pre-Event Update Emails
 * ────────────────────────────────────────────────────
 * Sends a logistics email to confirmed guests before the event —
 * venue details, parking, dress code, etc. Only goes to guests
 * who RSVPed YES to at least one event.
 *
 * Usage:
 *   node scripts/send-update.js --dry-run     # Preview only
 *   node scripts/send-update.js               # Send to confirmed guests
 *   node scripts/send-update.js --force       # Skip date check
 *   node scripts/send-update.js --email addr  # Send to one guest only
 *
 * Requires: npm install nodemailer
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const args     = process.argv.slice(2);
const dryRun   = args.includes('--dry-run');
const force    = args.includes('--force');
const emailIdx = args.indexOf('--email');
const onlyEmail = emailIdx >= 0 ? args[emailIdx + 1]?.toLowerCase().trim() : null;

const ROOT        = path.join(__dirname, '..');
const GUESTS_FILE = path.join(ROOT, 'data', 'guests.json');
const RSVPS_FILE  = path.join(ROOT, 'data', 'rsvps.json');
const CONFIG_FILE = path.join(ROOT, 'data', 'config.json');
const { resolvePreEventGroup, bodyToHtml } = require('../lib/emails');

let guests, rsvps, config;
try { guests = JSON.parse(fs.readFileSync(GUESTS_FILE, 'utf8')); }
catch { console.error('\n  ✗  data/guests.json not found.\n'); process.exit(1); }
try { rsvps = JSON.parse(fs.readFileSync(RSVPS_FILE, 'utf8')); }
catch { rsvps = []; }
try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
catch { console.error('\n  ✗  data/config.json not found.\n'); process.exit(1); }

const { contact, emailTemplates, site, events: allEvents, preEventUpdates, travel } = config;

if (!contact?.gmailUser || !contact?.gmailAppPassword || contact.gmailAppPassword === 'REPLACE_WITH_YOUR_APP_PASSWORD') {
  console.error('\n  ✗  Gmail not configured.\n'); process.exit(1);
}

let nodemailer;
try { nodemailer = require('nodemailer'); }
catch { console.error('\n  ✗  Run: npm install nodemailer\n'); process.exit(1); }

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: contact.gmailUser, pass: contact.gmailAppPassword },
});

const SITE_URL = process.env.SITE_URL || 'https://rsvp.example.com';
const today    = new Date().toISOString().split('T')[0];

// ── Determine which pre-event update is active ────────────────────────────────
// Find the update config whose daysBeforeEvent matches today
const eventDate = new Date('2026-08-22T00:00:00');
const daysUntil = Math.ceil((eventDate - new Date()) / (1000 * 60 * 60 * 24));

const activeUpdates = (preEventUpdates || []).filter(u => {
  if (!u.enabled) return false;
  if (force) return true;
  // Send if today is within 0–1 days of the scheduled day
  return Math.abs(daysUntil - u.daysBeforeEvent) <= 1;
});

if (!force && activeUpdates.length === 0) {
  console.log(`\n  ℹ  No pre-event updates scheduled for today (${daysUntil} days until event).`);
  const next = (preEventUpdates || []).filter(u => u.enabled && u.daysBeforeEvent < daysUntil)
    .sort((a,b) => b.daysBeforeEvent - a.daysBeforeEvent)[0];
  if (next) console.log(`     Next update: "${next.label}" — ${next.daysBeforeEvent} days before event.`);
  console.log('     Use --force to send anyway.\n');
  process.exit(0);
}

// ── Find confirmed attending guests ───────────────────────────────────────────
const attending = rsvps.filter(r => {
  const isAtt = r.events
    ? Object.values(r.events).some(Boolean)
    : Boolean(r.attending);
  return isAtt && !r.token?.startsWith('TEST_');
});
const attendingEmails = new Set(attending.map(r => r.email?.toLowerCase()));

let toSend = guests.filter(g => !g.isTest && attendingEmails.has(g.email));
if (onlyEmail) toSend = toSend.filter(g => g.email === onlyEmail);

if (toSend.length === 0) {
  console.log('\n  ℹ  No confirmed guests to send to.\n');
  process.exit(0);
}

// ── Build pre-event HTML ──────────────────────────────────────────────────────
function buildUpdateHtml(guest, guestRsvp) {
  const firstName = guest.name.split(' ')[0];

  const attendingEventIds = guestRsvp?.events
    ? Object.entries(guestRsvp.events).filter(([,v]) => v).map(([k]) => Number(k))
    : guest.events;

  const tmpl        = resolvePreEventGroup(config, attendingEventIds);
  const previewText = config.emailTemplates?.preEvent?.previewText || '';

  const attendingEvents = (allEvents || []).filter(e => attendingEventIds.includes(e.id));

  const eventCards = attendingEvents.map(e => {
    const date = e.isoDate
      ? new Date(e.isoDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : e.displayDate || '';
    const venueLine = e.venueName
      ? `<br><strong style="color:#1A0805;">${e.venueName}</strong>`
      : '';
    const addressLine = e.address
      ? `<br><span style="color:#8B6050;font-size:13px;">${e.address}${e.city ? ', ' + e.city : ''}</span>`
      : '';
    const dressLine = e.dressCode
      ? `<br><span style="font-size:12px;color:#9B7060;font-style:italic;">👔 ${e.dressCode}</span>`
      : '';
    const notesLine = e.additionalNotes
      ? `<br><span style="font-size:12px;color:#9B7060;">📝 ${e.additionalNotes}</span>`
      : '';

    return `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #F0E0D8;">
        <span style="font-size:24px;">${e.emoji || '✡'}</span>
        <strong style="font-size:15px;color:#C83A18;display:block;margin-top:4px;">${e.name}</strong>
        <span style="font-size:13px;color:#8B6050;">${date} · ${e.time}</span>
        ${venueLine}${addressLine}${dressLine}${notesLine}
      </td>
    </tr>`;
  }).join('');

  const parkingHtml = travel?.parkingInfo
    ? `<p style="margin:0 0 24px;font-size:14px;color:#5A3020;line-height:1.7;"><strong>🚗 Parking:</strong> ${travel.parkingInfo}</p>`
    : '';

  const hotelHtml = travel?.hotelName
    ? `<p style="margin:0 0 24px;font-size:14px;color:#5A3020;line-height:1.7;"><strong>🏨 Hotel:</strong> A room block is reserved at ${travel.hotelName}${travel.hotelBookingCode ? ' — mention "' + travel.hotelBookingCode + '"' : ''}.</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5EDE6;font-family:'Georgia',serif;">
${previewText ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#F5EDE6;">${previewText}&nbsp;${'&zwnj;&nbsp;'.repeat(50)}</div>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#F5EDE6">
<tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.1);">
  <tr><td align="center" style="background:linear-gradient(160deg,#0E0606,#1A0906);padding:36px 40px 28px;">
    <p style="margin:0 0 8px;font-family:'Georgia',serif;font-size:36px;font-weight:300;font-style:italic;color:#D96818;">AS</p>
    <h2 style="margin:0;font-family:'Georgia',serif;font-size:22px;font-weight:300;font-style:italic;color:rgba(255,255,255,0.85);">
      Alex's Bar Mitzvah is almost here!
    </h2>
    <p style="margin:8px 0 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.35);">
      August 22, 2026
    </p>
  </td></tr>
  <tr><td style="padding:36px 48px 28px;">
    <p style="margin:0 0 18px;font-size:16px;color:#5A3020;">Dear ${firstName},</p>
    ${tmpl.body ? bodyToHtml(tmpl.body) : `<p style="margin:0 0 24px;font-size:15px;color:#5A3020;line-height:1.8;">${tmpl.openingLine || 'We are so excited to celebrate with you in just a few days! Here are all the details you\'ll need.'}</p>`}

    <p style="margin:0 0 10px;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#9B7060;">
      Your Events
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${eventCards}
    </table>

    <div style="margin:28px 0;">
      ${parkingHtml}
      ${hotelHtml}
    </div>

    <p style="margin:0 0 24px;font-size:15px;color:#5A3020;line-height:1.8;">
      ${tmpl.closingLine || 'If you have any questions, please don\'t hesitate to reach out. We can\'t wait to see you there!'}
    </p>
  </td></tr>
  <tr><td style="background:#0E0606;padding:24px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);">
      ${contact.fromName || 'Jordan & Taylor Sample'} ·
      <a href="mailto:${contact.replyTo || contact.fromEmail}" style="color:#D96818;">${contact.replyTo || contact.fromEmail}</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Send ──────────────────────────────────────────────────────────────────────
async function run() {

  console.log(`\n  ✉  ${dryRun ? '[DRY RUN] ' : ''}Sending pre-event update to ${toSend.length} confirmed guest${toSend.length !== 1 ? 's' : ''}…\n`);

  let sent = 0, failed = 0;

  for (const guest of toSend) {
    const guestRsvp = rsvps.find(r => r.token === guest.token || r.email === guest.email);
    const attendingIds = guestRsvp?.events
      ? Object.entries(guestRsvp.events).filter(([,v]) => v).map(([k]) => Number(k))
      : guest.events;
    const group   = resolvePreEventGroup(config, attendingIds);
    const subject = group.subject;

    if (dryRun) {
      console.log(`  📧 Would send to: ${guest.name} <${guest.email}> [${group.subject}]`);
      sent++;
      continue;
    }
    try {
      await transporter.sendMail({
        from:    `"${contact.fromName || 'Jordan & Taylor Sample'}" <${contact.gmailUser}>`,
        to:      `"${guest.name}" <${guest.email}>`,
        replyTo: contact.replyTo || contact.fromEmail,
        subject,
        html:    buildUpdateHtml(guest, guestRsvp),
      });
      console.log(`  ✓  Sent to: ${guest.name} <${guest.email}>`);
      sent++;
      await new Promise(r => setTimeout(r, 1200));
    } catch (err) {
      console.error(`  ✗  Failed: ${guest.name} <${guest.email}> — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n  Done — ${sent} sent${failed > 0 ? `, ${failed} failed` : ''}.\n`);
}

run().catch(err => { console.error('\n  ✗  Error:', err.message, '\n'); process.exit(1); });
