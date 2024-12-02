# Use a Python image with uv pre-installed
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# Install the project into `/app`
WORKDIR /app

# Set environment variables
# - Tini version
# - Linux: Skip interactive prompts
# - xvfb: Set display port as an environment variable
# - uv: Enable bytecode compilation
# - uv: Copy from the cache instead of linking since it's a mounted volume
# - Place executables in the environment at the front of the path
ENV TINI_VERSION=v0.19.0 \
    DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:99 \
    UV_COMPILE_BYTECODE=1 \ 
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

# Install Tini
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

# Install system dependencies
RUN apt-get update && \
    apt-get install -y \
    -o APT::Install-Recommends=false \
    -o APT::Install-Suggests=false \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Install the project's dependencies using the lockfile and settings
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project --no-dev

# Install Python dependencies
RUN playwright install chromium && \
    playwright install-deps

# Copy app files (has to be done before installing deps)
COPY pyproject.toml \
    uv.lock \
    alembic.ini \
    README.md \
    /app/
COPY /src/ /app/src/

# Install app separately from its dependencies allows optimal layer caching
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# Lootscraper: Run
CMD [ "uv", "run", "lootscraper" ]

# Config
VOLUME /data
