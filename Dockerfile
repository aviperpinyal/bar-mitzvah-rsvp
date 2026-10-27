# ── Alex's Bar Mitzvah — Dockerfile ─────────────────────────────────────────
# Builds a minimal Node.js container for the bar mitzvah website.
# The web server has zero npm dependencies, so the image is very small.
#
# Build:  docker build -t bar-mitzvah-rsvp .
# Run:    docker-compose up -d

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (lets Docker cache the npm install layer)
COPY package.json package-lock.json* ./

# Install ONLY the script dependencies (nodemailer, xlsx)
# The web server itself needs nothing — skip devDeps
RUN npm install --omit=dev 2>/dev/null || npm install

# Copy application source
COPY server.js ./
COPY public/   ./public/
COPY lib/      ./lib/

# The data directory is NOT baked into the image.
# It is mounted as a volume at runtime (see docker-compose.yml)
# so that guest data, RSVPs, and config survive container rebuilds.

# Create the data directory so the mount point exists
RUN mkdir -p /app/data

# Expose the port the server listens on
EXPOSE 10003

# Health check — nginx proxy manager will also check this
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:10003/ > /dev/null || exit 1

# Start the server
CMD ["node", "server.js"]
