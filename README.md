# Bar Mitzvah RSVP Site

A self-hosted event website and RSVP system built for a family Bar Mitzvah weekend.

- **Personal RSVP links.** Each household gets a unique link and answers only for the events it was invited to.
- **Admin dashboard.** Manage guests, track responses, and edit all site text and event details without touching code.
- **Email.** Save-the-dates, invitations, reminders, and pre-event updates are sent through Gmail with Nodemailer.
- **Live display page.** A full-screen animated page for a TV or projector at the event.
- **Simple deployment.** A single-file Node.js server with no runtime dependencies, run in Docker on a home server.

> All names, emails, and venues in this repository are fictional sample data.

## Deploy to your home server

**No npm install required.** Just copy the folder and run:

```bash
node server.js
```

The site will be live at `http://YOUR-SERVER-IP:10003`

---

## Configuration

| Environment variable | Default        | What it does                    |
|---------------------|----------------|---------------------------------|
| `PORT`              | `10003`        | Port the server listens on      |
| `ADMIN_TOKEN`       | *(required)* | Password for the admin dashboard |

**Change the admin token before going live:**
```bash
ADMIN_TOKEN=yourStrongPassword node server.js
```

Or set it permanently in your system environment / systemd service file.

---

## File structure

```
bar-mitzvah-rsvp/
├── server.js          ← Node.js server (no dependencies)
├── package.json
├── data/
│   └── rsvps.json     ← All RSVP data (auto-created)
└── public/
    ├── index.html     ← Main event site
    ├── admin.html     ← RSVP dashboard
    ├── styles.css     ← All styles
    ├── script.js      ← Frontend JS
    └── admin.js       ← Dashboard JS
```

---

## Admin dashboard

Navigate to `http://YOUR-SERVER/admin`  
Enter the admin token you set in `ADMIN_TOKEN`

**Features:**
- Live stats: total RSVPs, attending, not attending, guest count
- Meal breakdown (chicken / fish / vegetarian)
- Full searchable guest list
- Delete individual RSVPs
- Export to CSV (Excel-compatible)
- Auto-refreshes every 60 seconds

---

## Content to fill in

Search `index.html` for these placeholders and replace with real info:

| Placeholder | What to add |
|-------------|-------------|
| `[TIME]` | Morning service time (e.g., 10:00 AM) |
| `[SYNAGOGUE NAME]` | Name of the synagogue |
| `[VENUE NAME]` | Reception venue name |
| `[Street Address]` | Addresses for both venues |
| `[Parasha Name]` | Alex's Torah portion |
| `[Hotel Name]` | Hotel block information |
| `[Cutoff Date]` | Hotel booking deadline |
| `[Airport Name]` | Nearest airport |

---

## Running as a systemd service (optional)

To run automatically on boot, create `/etc/systemd/system/bar-mitzvah-rsvp.service`:

```ini
[Unit]
Description=Alex Bar Mitzvah Website
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/path/to/bar-mitzvah-rsvp
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=PORT=10003
Environment=ADMIN_TOKEN=yourStrongPassword

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable bar-mitzvah-rsvp
sudo systemctl start bar-mitzvah-rsvp
```

---

*Made with ❤️ for Alex · Sample Family · 2026*
