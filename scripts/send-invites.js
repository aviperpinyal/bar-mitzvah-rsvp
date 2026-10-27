#!/usr/bin/env node
/**
 * Alex's Bar Mitzvah — Send Invitation Emails
 * ─────────────────────────────────────────────
 * Reads data/guests.json and sends each guest a personalized invitation
 * email with their unique RSVP link.
 *
 * Usage (run from the bar-mitzvah-rsvp folder):
 *   node scripts/send-invites.js --dry-run          # Preview only, no emails sent
 *   node scripts/send-invites.js                    # Send to everyone not yet invited
 *   node scripts/send-invites.js --email joe@x.com  # Send only to this email
 *   node scripts/send-invites.js --resend           # Resend to everyone (incl. already sent)
 *
 * Requires: npm install nodemailer
 * Gmail setup: Add your App Password to data/config.json → contact.gmailAppPassword
 *
 * The script adds a "inviteSent" timestamp to each guest in guests.json so it
 * won't accidentally resend to the same person unless you use --resend.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const dryRun  = args.includes('--dry-run');
const resend  = args.includes('--resend');
const emailIdx = args.indexOf('--email');
const onlyEmail = emailIdx >= 0 ? args[emailIdx + 1]?.toLowerCase().trim() : null;

// ── Paths ─────────────────────────────────────────────────────────────────────
const ROOT        = path.join(__dirname, '..');
const GUESTS_FILE = path.join(ROOT, 'data', 'guests.json');
const CONFIG_FILE = path.join(ROOT, 'data', 'config.json');

// ── Load data ─────────────────────────────────────────────────────────────────
let guests, config;
try { guests = JSON.parse(fs.readFileSync(GUESTS_FILE, 'utf8')); }
catch { console.error('\n  ✗  data/guests.json not found. Run import-guests.js first.\n'); process.exit(1); }

try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
catch { console.error('\n  ✗  data/config.json not found.\n'); process.exit(1); }

const { contact, events: allEvents, emailTemplates, site } = config;

// ── Validate config ───────────────────────────────────────────────────────────
if (!contact?.gmailUser || !contact?.gmailAppPassword || contact.gmailAppPassword === 'REPLACE_WITH_YOUR_APP_PASSWORD') {
  console.error('\n  ✗  Gmail not configured. Go to /settings → Email & Contact and enter your Gmail App Password.\n');
  process.exit(1);
}

// ── Check nodemailer ──────────────────────────────────────────────────────────
let nodemailer;
try { nodemailer = require('nodemailer'); }
catch { console.error('\n  ✗  Missing dependency. Run:\n\n       npm install nodemailer\n'); process.exit(1); }

// ── Create transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: contact.gmailUser, pass: contact.gmailAppPassword },
});

// ── Filter guests to send to ──────────────────────────────────────────────────
let toSend = guests.filter(g => !g.isTest);
if (onlyEmail) toSend = toSend.filter(g => g.email === onlyEmail);
if (!resend)   toSend = toSend.filter(g => !g.inviteSent);

if (toSend.length === 0) {
  console.log('\n  ✓  No guests to invite. Everyone has already been sent an invitation.');
  console.log('     Use --resend to resend to everyone, or --email addr to target one guest.\n');
  process.exit(0);
}

// ── RSVP site URL ─────────────────────────────────────────────────────────────
const SITE_URL = process.env.SITE_URL || 'https://rsvp.example.com';

// ── Build email HTML ──────────────────────────────────────────────────────────
function buildInviteHtml(guest) {
  const tmpl = emailTemplates?.invitation || {};
  const rsvpUrl = `${SITE_URL}/rsvp/${guest.token}`;

  // Get the events this guest is invited to
  const guestEvents = (allEvents || []).filter(e => guest.events.includes(e.id));

  const eventRows = guestEvents.map(e => {
    const date = e.isoDate
      ? new Date(e.isoDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : e.displayDate || '';
    const venue = e.venueName ? `<br><span style="color:#8B6050;font-size:13px;">${e.venueName}</span>` : '';
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #F0E0D8;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:36px;font-size:22px;vertical-align:top;padding-top:2px;">${e.emoji || '✡'}</td>
              <td>
                <strong style="font-size:15px;color:#1A0805;">${e.name}</strong>${venue}<br>
                <span style="font-size:13px;color:#8B6050;">${date} · ${e.time}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }).join('');

  const firstName = guest.name.split(' ')[0];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${tmpl.subject || 'You\'re Invited — Alex\'s Bar Mitzvah'}</title>
</head>
<body style="margin:0;padding:0;background:#F5EDE6;font-family:'Georgia',serif;">

<!-- Wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#F5EDE6">
<tr><td align="center" style="padding:40px 20px;">

  <!-- Card -->
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.1);">

    <!-- Header -->
    <tr>
      <td align="center" style="background:linear-gradient(160deg,#0E0606,#1A0906);padding:48px 40px 36px;">

        <!-- AS Logo (text fallback) -->
        <p style="margin:0 0 20px;font-family:'Georgia',serif;font-size:52px;font-weight:300;font-style:italic;
                  background:linear-gradient(135deg,#C83A18,#D96818,#EAAC2C);
                  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                  color:#D96818;letter-spacing:2px;">AS</p>

        <p style="margin:0 0 8px;font-family:'Georgia',serif;font-size:13px;font-style:italic;
                  color:rgba(255,255,255,0.5);letter-spacing:2px;text-transform:uppercase;">
          You are invited to celebrate
        </p>
        <h1 style="margin:0 0 6px;font-family:'Georgia',serif;font-size:32px;font-weight:300;font-style:italic;
                   color:#fff;line-height:1.2;">the Bar Mitzvah of</h1>
        <h1 style="margin:0 0 20px;font-family:'Georgia',serif;font-size:40px;font-weight:400;font-style:italic;
                   color:#EAAC2C;line-height:1.1;">Alex Sample</h1>
        <p style="margin:0;font-family:'Georgia',serif;font-size:14px;letter-spacing:3px;
                  color:rgba(255,255,255,0.4);text-transform:uppercase;">
          August 22, 2026
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding:40px 48px 32px;">
        <p style="margin:0 0 20px;font-size:16px;color:#5A3020;line-height:1.7;">
          Dear ${firstName},
        </p>
        <p style="margin:0 0 24px;font-size:15px;color:#5A3020;line-height:1.8;">
          ${tmpl.openingLine || 'We are so pleased to invite you to celebrate with us as our son Alex becomes a Bar Mitzvah.'}
        </p>

        <!-- Events -->
        <p style="margin:0 0 10px;font-size:11px;font-weight:bold;letter-spacing:2px;
                  text-transform:uppercase;color:#9B7060;">Your Invitations</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${eventRows}
        </table>

        <p style="margin:28px 0 24px;font-size:15px;color:#5A3020;line-height:1.8;">
          ${tmpl.closingLine || 'We hope you\'ll be able to join us. Please RSVP using your personal link below.'}
        </p>

        <!-- RSVP Button -->
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding:8px 0 32px;">
              <a href="${rsvpUrl}"
                 style="display:inline-block;padding:16px 48px;
                        background:linear-gradient(135deg,#C83A18,#D96818,#EAAC2C);
                        color:#fff;text-decoration:none;border-radius:50px;
                        font-family:'Georgia',serif;font-size:14px;font-weight:bold;
                        letter-spacing:2px;text-transform:uppercase;">
                RSVP Now
              </a>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 8px;font-size:12px;color:#9B7060;">
          Or copy this link into your browser:
        </p>
        <p style="margin:0;font-size:12px;color:#C83A18;word-break:break-all;">
          <a href="${rsvpUrl}" style="color:#C83A18;">${rsvpUrl}</a>
        </p>
      </td>
    </tr>

    <!-- Deadline banner -->
    ${site?.rsvpDeadline ? `
    <tr>
      <td style="background:#FDF5F0;padding:16px 48px;border-top:1px solid #F0E0D8;">
        <p style="margin:0;font-size:13px;color:#9B7060;text-align:center;">
          Kindly reply by
          <strong style="color:#C83A18;">
            ${new Date(site.rsvpDeadline + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </strong>
        </p>
      </td>
    </tr>` : ''}

    <!-- Footer -->
    <tr>
      <td style="background:#0E0606;padding:28px 40px;text-align:center;">
        <p style="margin:0 0 6px;font-family:'Georgia',serif;font-size:18px;font-weight:300;
                  font-style:italic;color:rgba(255,255,255,0.6);">
          ${contact.fromName || 'The Sample Family'}
        </p>
        <p style="margin:0;font-size:11px;letter-spacing:1px;text-transform:uppercase;
                  color:rgba(255,255,255,0.2);">
          Questions? Reply to this email or contact us at
          <a href="mailto:${contact.replyTo || contact.fromEmail}" style="color:#D96818;">
            ${contact.replyTo || contact.fromEmail}
          </a>
        </p>
      </td>
    </tr>

  </table>
</td></tr>
</table>

</body>
</html>`;
}

// ── Plain text fallback ───────────────────────────────────────────────────────
function buildInviteText(guest) {
  const tmpl = emailTemplates?.invitation || {};
  const rsvpUrl = `${SITE_URL}/rsvp/${guest.token}`;
  const guestEvents = (allEvents || []).filter(e => guest.events.includes(e.id));
  const firstName = guest.name.split(' ')[0];

  const eventLines = guestEvents.map(e => {
    const date = e.isoDate
      ? new Date(e.isoDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : e.displayDate || '';
    return `  ${e.name}\n  ${date} · ${e.time}${e.venueName ? '\n  ' + e.venueName : ''}`;
  }).join('\n\n');

  return `Dear ${firstName},

${tmpl.openingLine || 'We are so pleased to invite you to celebrate with us as our son Alex becomes a Bar Mitzvah.'}

YOUR INVITATIONS:
${eventLines}

${tmpl.closingLine || 'We hope you\'ll be able to join us. Please RSVP using your personal link below.'}

RSVP HERE: ${rsvpUrl}

${site?.rsvpDeadline ? `Please respond by ${new Date(site.rsvpDeadline + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.` : ''}

With love,
${contact.fromName || 'Jordan & Taylor Sample'}
`;
}

// ── Main send loop ────────────────────────────────────────────────────────────
async function run() {
  const tmpl     = emailTemplates?.invitation || {};
  const subject  = tmpl.subject || 'You\'re Invited — Alex\'s Bar Mitzvah · August 22, 2026';

  console.log(`\n  ✉  ${dryRun ? '[DRY RUN] ' : ''}Sending invitations to ${toSend.length} guest${toSend.length !== 1 ? 's' : ''}…\n`);

  let sent = 0, failed = 0;

  for (const guest of toSend) {
    const label = `${guest.name} <${guest.email}>`;

    if (dryRun) {
      const evtNames = (allEvents || []).filter(e => guest.events.includes(e.id)).map(e => e.shortName || e.name).join(', ');
      console.log(`  📧 [DRY RUN] Would send to: ${label}`);
      console.log(`     Events: ${evtNames}`);
      console.log(`     RSVP:   ${SITE_URL}/rsvp/${guest.token}\n`);
      sent++;
      continue;
    }

    try {
      await transporter.sendMail({
        from:     `"${contact.fromName || 'Jordan & Taylor Sample'}" <${contact.gmailUser}>`,
        to:       `"${guest.name}" <${guest.email}>`,
        replyTo:  contact.replyTo || contact.fromEmail,
        subject,
        text:     buildInviteText(guest),
        html:     buildInviteHtml(guest),
      });

      // Mark as sent in guests.json
      guest.inviteSent = new Date().toISOString();
      console.log(`  ✓  Sent to: ${label}`);
      sent++;

      // Small delay to avoid Gmail rate limits (1 per second)
      await new Promise(r => setTimeout(r, 1200));

    } catch (err) {
      console.error(`  ✗  Failed: ${label}`);
      console.error(`     ${err.message}`);
      failed++;
    }
  }

  // ── Save updated guests.json ──
  if (!dryRun && sent > 0) {
    fs.writeFileSync(GUESTS_FILE, JSON.stringify(guests, null, 2), 'utf8');
  }

  console.log(`\n  ┌──────────────────────────────┐`);
  console.log(`  │  ${dryRun ? 'Dry Run' : 'Send'} Complete${' '.repeat(dryRun ? 15 : 18)}│`);
  console.log(`  ├──────────────────────────────┤`);
  console.log(`  │  ${dryRun ? 'Would send' : 'Sent'}:   ${String(sent).padStart(4)}               │`);
  if (!dryRun) console.log(`  │  Failed:   ${String(failed).padStart(4)}               │`);
  console.log(`  └──────────────────────────────┘\n`);

  if (failed > 0) {
    console.log('  ⚠  Some emails failed. Check your Gmail App Password in /settings.');
    console.log('     You can re-run with --email addr to retry individual guests.\n');
  }
}

run().catch(err => {
  console.error('\n  ✗  Unexpected error:', err.message, '\n');
  process.exit(1);
});
