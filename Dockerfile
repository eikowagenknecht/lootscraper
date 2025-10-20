########## Build stage
FROM node:25-slim AS builder
WORKDIR /app

# Set CI var to skip lefthook prepare script
ENV CI=true

# Install Python and build tools needed for node-gyp
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install pnpm by package.json config
RUN npm i -g corepack@latest
RUN corepack enable

# Install dependencies
COPY package.json pnpm-lock.yaml ./
# Set timeouts for GH Actions and other CI environments
RUN \
pnpm config set fetch-retry-mintimeout 20000 && \
pnpm config set fetch-retry-maxtimeout 120000 && \
pnpm config set fetch-retries 5
RUN pnpm install --frozen-lockfile 

# Copy source and build
COPY src/ ./src/
COPY tsconfig.json vite.config.ts package.json pnpm-lock.yaml global.d.ts ./
RUN pnpm build

########## Production stage
FROM node:25-slim
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
RUN npm i -g corepack@latest
RUN corepack enable

# Copy package files first
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

# Install dependencies
RUN \
# Install build tools needed for node-gyp / better-sqlite
apt-get update && apt-get install -y python3 make g++ && \
# Set timeouts for GH Actions and other CI environments
pnpm config set fetch-retry-mintimeout 20000 && \
pnpm config set fetch-retry-maxtimeout 120000 && \
pnpm config set fetch-retries 5 && \
# Install production dependencies
pnpm install --frozen-lockfile --prod && \
# Install playwright browsers into the user's home directory
pnpm playwright install firefox --with-deps && \
# Remove pnpm cache and other unnecessary files
pnpm store prune && \
# Remove build tools
apt-get purge -y python3 make g++ && \
apt-get autoremove -y && \
apt-get clean && \
# Remove unnecessary files
rm -rf /root/.cache/node /root/.cache/pnpm /root/.npm /root/.pnpm-store /root/.local /var/lib/apt/lists/*

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