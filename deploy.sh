#!/bin/bash
# ── Alex's Bar Mitzvah — Auto-deploy Script ─────────────────────────────────
#
# Run this on your home server. It checks GitHub for new commits and
# rebuilds the container only when something has changed.
#
# Set up as a cron job (runs every 5 minutes):
#   crontab -e
#   */5 * * * * /opt/bar-mitzvah-rsvp/deploy.sh >> /var/log/alex-deploy.log 2>&1
#
# First-time setup on the server:
#   git clone https://github.com/YOUR_USERNAME/bar-mitzvah-rsvp.git /opt/bar-mitzvah-rsvp
#   cd /opt/bar-mitzvah-rsvp
#   cp data/config.json.example data/config.json   # or copy your real config
#   echo "ADMIN_TOKEN=your_strong_password" > .env
#   docker-compose up -d

set -euo pipefail

REPO_DIR="/opt/bar-mitzvah-rsvp"
GITHUB_REPO="https://github.com/YOUR_USERNAME/bar-mitzvah-rsvp.git"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')] [deploy]"

cd "$REPO_DIR"

# ── Fetch latest from GitHub ──────────────────────────────────────────────────
git fetch origin main --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  # No changes — exit silently (cron log stays clean)
  exit 0
fi

echo "$LOG_PREFIX New commits detected. Updating…"
echo "$LOG_PREFIX  Local:  $LOCAL"
echo "$LOG_PREFIX  Remote: $REMOTE"

# ── Pull the new code ─────────────────────────────────────────────────────────
git pull origin main --quiet
echo "$LOG_PREFIX Code updated."

# ── Rebuild and restart the container ────────────────────────────────────────
# --build  : rebuild the image with the new code
# -d       : detached (runs in background)
# --no-deps: don't restart linked services unnecessarily
docker-compose up -d --build --no-deps web
echo "$LOG_PREFIX Container rebuilt and restarted."

# ── Verify it's healthy ───────────────────────────────────────────────────────
sleep 5
if docker-compose ps web | grep -q "Up"; then
  echo "$LOG_PREFIX ✓ Container is running."
else
  echo "$LOG_PREFIX ✗ WARNING: Container may not be running. Check: docker-compose logs web"
  exit 1
fi

echo "$LOG_PREFIX Deploy complete."
