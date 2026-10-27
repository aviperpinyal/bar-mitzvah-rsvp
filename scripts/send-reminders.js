#!/usr/bin/env node
/**
 * Alex's Bar Mitzvah — Send Reminder Emails
 * ───────────────────────────────────────────
 * Sends reminder emails to guests who haven't responded yet.
 * Respects the reminder dates configured in data/config.json.
 *
 * Usage:
 *   node scripts/send-reminders.js --dry-run    # Preview only
 *   node scripts/send-reminders.js              # Send to non-responders
 *   node scripts/send-reminders.js --force      # Send even if not reminder date yet
 *   node scripts/send-reminders.js --email addr # Send only to this email
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

let guests, rsvps, config;
try { guests = JSON.parse(fs.readFileSync(GUESTS_FILE, 'utf8')); }
catch { console.error('\n  ✗  data/guests.json not found.\n'); process.exit(1); }
try { rsvps = JSON.parse(fs.readFileSync(RSVPS_FILE, 'utf8')); }
catch { rsvps = []; }
try { config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
catch { console.error('\n  ✗  data/config.json not found.\n'); process.exit(1); }

const { contact, emailTemplates, site, reminders } = config;

if (!contact?.gmailUser || !contact?.gmailAppPassword || contact.gmailAppPassword === 'REPLACE_WITH_YOUR_APP_PASSWORD') {
  console.error('\n  ✗  Gmail not configured. Set gmailAppPassword in /settings.\n'); process.exit(1);
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

// ── Check if today is a reminder date ────────────────────────────────────────
const activeReminders = (reminders || []).filter(r => {
  if (!r.enabled) return false;
  if (force) return true;
  return r.sendDate <= today; // send if on or after scheduled date
});

if (!force && activeReminders.length === 0) {
  console.log('\n  ℹ  No reminders scheduled for today.');
  const next = (reminders || []).filter(r => r.enabled && r.sendDate > today).sort((a,b) => a.sendDate > b.sendDate ? 1 : -1)[0];
  if (next) console.log(`     Next reminder: ${next.label} on ${next.sendDate}`);
  console.log('     Use --force to send anyway.\n');
  process.exit(0);
}

console.log(`\n  📅 Active reminder: ${activeReminders.map(r => r.label).join(', ')}`);

// ── Find guests who haven't RSVPed ────────────────────────────────────────────
const rsvpedTokens = new Set(rsvps.map(r => r.token));
const rsvpedEmails = new Set(rsvps.map(r => r.email?.toLowerCase()));

let toRemind = guests.filter(g => {
  if (g.isTest) return false;
  if (!g.inviteSent) return false;  // Don't remind if invite wasn't sent yet
  // Check if they've RSVPed
  return !rsvpedTokens.has(g.token) && !rsvpedEmails.has(g.email);
});

if (onlyEmail) toRemind = toRemind.filter(g => g.email === onlyEmail);

if (toRemind.length === 0) {
  console.log('\n  ✓  All invited guests have already responded. No reminders to send.\n');
  process.exit(0);
}

// ── Build reminder email ──────────────────────────────────────────────────────
const emails = require('../lib/emails');

// ── Send ──────────────────────────────────────────────────────────────────────
async function run() {
  const tmpl    = emailTemplates?.reminder || {};
  const subject = tmpl.subject || 'Friendly reminder — Please RSVP for Alex\'s Bar Mitzvah';

  console.log(`\n  ✉  ${dryRun ? '[DRY RUN] ' : ''}Sending reminders to ${toRemind.length} guest${toRemind.length !== 1 ? 's' : ''} who haven\'t responded…\n`);

  let sent = 0, failed = 0;

  for (const guest of toRemind) {
    if (dryRun) {
      console.log(`  📧 Would remind: ${guest.name} <${guest.email}>`);
      sent++;
      continue;
    }
    try {
      await transporter.sendMail({
        from:    `"${contact.fromName || 'Jordan & Taylor Sample'}" <${contact.gmailUser}>`,
        to:      `"${guest.name}" <${guest.email}>`,
        replyTo: contact.replyTo || contact.fromEmail,
        subject,
        html:    emails.buildReminderHtml(guest, config, SITE_URL),
        text:    emails.buildReminderText(guest, config, SITE_URL),
      });
      console.log(`  ✓  Reminded: ${guest.name} <${guest.email}>`);
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
