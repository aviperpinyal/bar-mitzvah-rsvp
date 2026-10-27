#!/usr/bin/env node
/**
 * Alex's Bar Mitzvah — Guest Import Script
 * ──────────────────────────────────────────
 * Reads the filled-in guest list Excel file and writes data/guests.json.
 * Each guest gets a unique token that powers their personalized RSVP link.
 *
 * Column layout (from "Alex Bar-Mitzvah Guest List"):
 *   A (0): #
 *   B (1): Household Name (used as greeting)
 *   C (2): First Name (optional)
 *   D (3): Last Name (optional)
 *   E (4): Email Address
 *   F (5): Guests Invited (number)
 *   G (6): Shabbat Services & Dinner
 *   H (7): Bar Mitzvah Service & Luncheon
 *   I (8): Evening Celebration (Party)
 *   J (9): Morning After Breakfast
 *   K (10): Internal Notes (not shown to guests)
 *   L (11): Kids Count (number of kids receiving hoodies)
 * Data starts on row 4 (rows 1–3 are headers/instructions).
 *
 * Usage:
 *   node scripts/import-guests.js                         # uses default file
 *   node scripts/import-guests.js --file mylist.xlsx
 *   node scripts/import-guests.js --dry-run
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const args     = process.argv.slice(2);
const dryRun   = args.includes('--dry-run');
const fileIdx  = args.indexOf('--file');
const xlsxPath = fileIdx >= 0
  ? path.resolve(args[fileIdx + 1])
  : (() => {
      // Auto-detect: prefer the populated guest list over the template
      const populated = path.join(__dirname, '..', 'Alex Bar-Mitzvah Guest List (1).xlsx');
      const template  = path.join(__dirname, '..', 'guest-list-template.xlsx');
      return fs.existsSync(populated) ? populated : template;
    })();

const DATA_DIR    = path.join(__dirname, '..', 'data');
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');

let XLSX;
try { XLSX = require('xlsx'); }
catch { console.error('\n  ✗  Run: npm install\n'); process.exit(1); }

if (!fs.existsSync(xlsxPath)) {
  console.error(`\n  ✗  File not found: ${xlsxPath}\n`); process.exit(1);
}

// ── Column positions ──────────────────────────────────────────────────────────
const COL = {
  HOUSEHOLD:   1,
  FIRST_NAME:  2,
  LAST_NAME:   3,
  EMAIL:       4,
  GUEST_COUNT: 5,
  SHABBAT:     6,   // event id 1
  SERVICE:     7,   // event id 2
  PARTY:       8,   // event id 3
  BREAKFAST:   9,   // event id 4
  NOTES:       10,
  KIDS_COUNT:  11,
};

const EVENT_COLS = [
  { col: COL.SHABBAT,   id: 1 },
  { col: COL.SERVICE,   id: 2 },
  { col: COL.PARTY,     id: 3 },
  { col: COL.BREAKFAST, id: 4 },
];

// ── Load existing guests (preserve tokens) ────────────────────────────────────
let existingGuests = [];
try { existingGuests = JSON.parse(fs.readFileSync(GUESTS_FILE, 'utf8')); }
catch { existingGuests = []; }

const existingByEmail = new Map(
  existingGuests.filter(g => !g.isTest).map(g => [g.email.toLowerCase(), g])
);

// ── Token helpers ─────────────────────────────────────────────────────────────
function makeToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
function uniqueToken(used) {
  let t; do { t = makeToken(); } while (used.has(t)); used.add(t); return t;
}

// ── Read workbook ─────────────────────────────────────────────────────────────
console.log(`\n  📋 Reading: ${path.basename(xlsxPath)}`);
const wb    = XLSX.readFile(xlsxPath);
const sheet = wb.Sheets['Guest List'];
if (!sheet) {
  console.error('\n  ✗  Sheet "Guest List" not found.\n'); process.exit(1);
}

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

// ── Process rows ──────────────────────────────────────────────────────────────
const usedTokens = new Set(existingGuests.map(g => g.token));
const newGuests  = [];
const warnings   = [];
let created = 0, updated = 0, skipped = 0;

for (let i = 3; i < rows.length; i++) {
  const row = rows[i];

  const household = String(row[COL.HOUSEHOLD] || '').trim();
  if (!household) { skipped++; continue; }

  const firstName  = String(row[COL.FIRST_NAME]  || '').trim();
  const lastName   = String(row[COL.LAST_NAME]   || '').trim();
  const email      = String(row[COL.EMAIL]        || '').trim().toLowerCase();
  const guestCount = parseInt(row[COL.GUEST_COUNT]) || 1;
  const kidsCount  = parseInt(row[COL.KIDS_COUNT]) || 0;
  const notes      = String(row[COL.NOTES]        || '').trim();

  // Skip placeholder rows (no events, no email)
  const events = EVENT_COLS
    .filter(ec => String(row[ec.col] || '').trim().toUpperCase() === 'YES')
    .map(ec => ec.id);

  if (!email && events.length === 0) { skipped++; continue; }

  if (!email) {
    warnings.push(`Row ${i + 1}: "${household}" has no email — skipped.`);
    skipped++;
    continue;
  }

  if (events.length === 0) {
    warnings.push(`Row ${i + 1}: "${household}" (${email}) has no YES events — skipped.`);
    skipped++;
    continue;
  }

  // Build display name: prefer First + Last, fall back to Household Name
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || household;

  const existing   = existingByEmail.get(email);
  const token      = existing?.token || uniqueToken(usedTokens);
  const existingEmails = existing?.emails || { saveTheDate: null, invite: null, reminder: null, preEvent: null };

  // Migrate legacy inviteSent field
  if (existing?.inviteSent && !existingEmails.invite) {
    existingEmails.invite = existing.inviteSent;
  }

  if (existing) updated++; else created++;

  newGuests.push({
    id:         existing?.id || `g_${String(newGuests.length + 1).padStart(4, '0')}`,
    name:       fullName,
    household,
    firstName:  firstName || null,
    lastName:   lastName  || null,
    email,
    guestCount,
    kidsCount,
    notes:      notes || null,
    events,
    token,
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    emails:     existingEmails,
  });
}

// Re-ID sequentially
newGuests.forEach((g, i) => { g.id = `g_${String(i + 1).padStart(4, '0')}`; });

// Preserve test guests
const testGuests = existingGuests.filter(g => g.isTest);
const allOutput  = [...newGuests, ...testGuests];

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n  ┌──────────────────────────────────────┐`);
console.log(`  │  Guest Import Summary                 │`);
console.log(`  ├──────────────────────────────────────┤`);
console.log(`  │  Created:     ${String(created).padStart(4)}                │`);
console.log(`  │  Updated:     ${String(updated).padStart(4)}                │`);
console.log(`  │  Skipped:     ${String(skipped).padStart(4)}                │`);
console.log(`  │  Total:       ${String(newGuests.length).padStart(4)}                │`);
console.log(`  └──────────────────────────────────────┘`);

const evtNames = { 1: 'Shabbat', 2: 'Service', 3: 'Party', 4: 'Breakfast' };
console.log('\n  Event Breakdown:');
for (const [id, name] of Object.entries(evtNames)) {
  const count = newGuests.filter(g => g.events.includes(Number(id))).length;
  const pax   = newGuests.filter(g => g.events.includes(Number(id))).reduce((s,g) => s + g.guestCount, 0);
  console.log(`    ${name.padEnd(12)} ${String(count).padStart(3)} households · ${String(pax).padStart(3)} guests`);
}

const totalGuests = newGuests.reduce((s, g) => s + g.guestCount, 0);
console.log(`\n  Total expected guests: ${totalGuests}`);

if (warnings.length) {
  console.log('\n  ⚠  Warnings:');
  warnings.forEach(w => console.log(`     ${w}`));
}

if (dryRun) {
  console.log('\n  🔍 DRY RUN — no files written.\n');
  console.log('  First 5 guests:');
  newGuests.slice(0, 5).forEach(g => {
    console.log(`    ${g.name.padEnd(30)} ${g.email.padEnd(35)} ${g.guestCount} guest(s) · events: [${g.events.join(',')}]`);
  });
  console.log(''); process.exit(0);
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(GUESTS_FILE, JSON.stringify(allOutput, null, 2), 'utf8');
console.log(`\n  ✓  Saved to data/guests.json (${allOutput.length} guests)\n`);
console.log('  Next: node scripts/send-save-the-date.js --dry-run\n');
