########## Build stage
FROM node:22-slim AS builder
WORKDIR /app

# Set CI var to skip lefthook prepare script
ENV CI=true

# Install pnpm by package.json config
RUN corepack enable

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile 

# Copy source and build
COPY src/ ./src/
COPY tsconfig.json vite.config.ts package.json pnpm-lock.yaml global.d.ts ./
RUN pnpm build

########## Production stage
FROM node:22-slim
WORKDIR /app

# Set environment variables
ENV \
DEBIAN_FRONTEND=noninteractive \ 
NODE_ENV=production \
DOCKER_CONTAINER=true

# Install system dependencies
RUN \
apt-get update && \
apt-get install -y \
-o APT::Install-Recommends=false \
-o APT::Install-Suggests=false \
xvfb \
xauth \
tini && \
rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["/usr/bin/tini", "--"]

# Create data directory
RUN \
mkdir -p /data
# chown -R node:node /data

# Install pnpm by package.json config
RUN corepack enable

# Copy package files first
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

# Install dependencies
RUN \
pnpm install --frozen-lockfile --prod && \
# Install playwright browsers into the user's home directory
pnpm playwright install firefox --with-deps && \
# Remove pnpm cache and other unnecessary files
pnpm store prune && \
rm -rf /root/.cache/node /root/.cache/pnpm /root/.npm /root/.pnpm-store /root/.local

# Copy built files and templates
COPY --from=builder /app/dist ./dist
COPY templates ./templates

# TODO: Use non-root user
# The playwright browsers have to be installed in the user's home directory for this
# PLAYWRIGHT_BROWSERS_PATH=/home/node/.cache/ms-playwright pnpm playwright ...
# USER node

# Volume for persistent data
VOLUME ["/data"]

# Start the application
CMD ["xvfb-run", "--auto-servernum", "node", "dist/main.js"]