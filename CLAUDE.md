# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the server

```bash
node server.js                        # start directly (no npm needed)
npm start                             # same via package.json

# With Docker (production setup on Windows/WSL2):
docker-compose up -d                  # start in background
docker-compose up -d --build          # rebuild after code changes
docker-compose logs -f                # stream logs
docker-compose down                   # stop

# Scripts (need npm install first — only for scripts/, not server.js):
npm install
node scripts/import-guests.js         # import Excel → data/guests.json
node scripts/import-guests.js --dry-run
node scripts/send-invites.js          # send invite emails to all guests
node scripts/send-reminders.js        # send RSVP reminder emails
node scripts/send-save-the-date.js    # send save-the-date emails
```

There are no tests and no linter configured.

## Deployment workflow

Production runs on Docker Desktop / WSL2 on a Windows home server, fronted by Nginx Proxy Manager (NPM) on a separate machine. The live site is `https://rsvp.example.com`.

**To deploy changes:**
1. Commit and push from Mac
2. On the Windows/WSL machine (`ssh user@your-server`):
```bash
cp data/config.json /tmp/config_backup.json && git checkout data/config.json && git pull && cp /tmp/config_backup.json data/config.json && docker-compose up -d --build --force-recreate
```

The `config.json` dance is necessary because the live config has real credentials and event settings that differ from the committed version. `data/guests.json` and `data/rsvps.json` are gitignored and live only on the server as a Docker volume — they are never overwritten by a pull.

**Important:** `saveTheDate.websiteUrl` in `config.json` must be `https://rsvp.example.com` for RSVP links in emails to work correctly. Set this via the Settings UI.

## Architecture

**`server.js`** is a single-file, zero-npm-dependency HTTP server using only Node.js built-ins (`http`, `fs`, `path`, `url`). It handles all API routes and serves static files from `public/`. It reads `nodemailer` lazily at runtime (only when email endpoints are called), which is why npm install is only needed for scripts.

**`data/`** is the entire database — three JSON files mounted as a Docker volume so they survive container rebuilds:
- `guests.json` — the guest list; each guest has a unique `token` that powers their personalized RSVP URL (`/rsvp/:token`)
- `rsvps.json` — submitted RSVP responses, keyed by `guestId` and `token`
- `config.json` — all site content, event details, email credentials, and settings; editable via the admin settings UI at `/settings`

**Two parallel RSVP flows exist in server.js:**
1. Legacy `POST /api/rsvp` — open form, email-deduplication (not used in current UI)
2. Token-based `POST /api/rsvp-token` — the active flow; guest loads `/rsvp/:token`, JS fetches `GET /api/guest/:token`, submits per-event attendance as `{ events: { "1": true, "2": false, ... } }`

**`lib/emails.js`** — shared email builder used by both `server.js` (individual sends via admin UI) and `scripts/` (batch sends). Exports: `buildSaveTheDateHtml`, `buildSaveTheDateText`, `buildInviteHtml`, `buildInviteText`, `buildReminderHtml`, `sendEmail`.

**Admin is auth-gated by a bearer token** (`ADMIN_TOKEN` env var, required — the server will not start without it). The HTML pages at `/admin`, `/guests`, `/settings` load publicly — all data calls send `Authorization: Bearer <token>` from localStorage.

**`/api/site-config`** (public) strips credentials before returning config to the frontend. Never add `gmailAppPassword` or `gmailUser` to this endpoint's response.

## Key config fields in `data/config.json`

- `events[]` — array of event objects; `inviteOnly: true` hides an event from the public homepage (it still appears on personalized RSVP pages for invited guests)
- `contact.gmailUser` / `contact.gmailAppPassword` — Gmail credentials for nodemailer; set via Settings UI, never commit a real password
- `contact.notifyEmails[]` — host email addresses that receive a notification on each RSVP submission
- `saveTheDate.websiteUrl` — used to construct RSVP links in emails (should be `https://rsvp.example.com`)

## Guest import workflow

1. Fill in `"Alex Bar-Mitzvah Guest List.xlsx"` (columns A–K, data from row 4)
2. `node scripts/import-guests.js` — reads the Excel, writes `data/guests.json` with a unique token per guest
3. `node scripts/send-invites.js` — sends personalized emails; tracks send time in `guests.json` so re-runs skip already-sent guests

## What lives where

| Path | Purpose |
|------|---------|
| `server.js` | All API routes + static file serving |
| `lib/emails.js` | Email HTML builders + nodemailer sender |
| `scripts/` | Batch email and import CLI scripts |
| `data/` | Runtime data (Docker volume — not rebuilt) |
| `public/index.html` | Main public site |
| `public/rsvp.html` | Personalized RSVP page (token from URL) |
| `public/admin.html` | RSVP dashboard |
| `public/guests.html` | Guest list management |
| `public/settings.html` | Site config + email settings |
| `public/styles.css` | All styles (one file, no preprocessor) |

## Brand / design constants

Dark background: `#0E0606`. Gradient: `#6B0E05 → #9E1F10 → #C83A18 → #D96818 → #EAAC2C`. Cream: `#F5EDE6`. Logo: `public/logo.svg` (SVG vector with gradient fill). Fonts: Cormorant Garamond (serif headings), Inter (body).
