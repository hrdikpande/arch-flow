# WhatsApp worker image (Hostinger VPS). See README for the run command.
FROM node:22-bookworm-slim

# Chromium is used by whatsapp-web.js. Set PUPPETEER_EXECUTABLE_PATH to this binary.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY apps/worker/package.json apps/worker/
RUN npm ci --workspace @arch-flow/worker --workspace @arch-flow/domain --include-workspace-root=false

COPY packages/domain packages/domain
COPY apps/worker apps/worker
RUN npm run build -w @arch-flow/domain && npm run build -w @arch-flow/worker

# Session data lives on a volume, encrypted at the host level (O-T4).
VOLUME ["/app/apps/worker/.wwebjs_auth"]
USER node
CMD ["node", "apps/worker/dist/index.js"]
