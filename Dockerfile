FROM python:3.12.7-bullseye

# Set environment variables
# - Tini version
# - Linux: Skip interactive prompts
# - xvfb: Set display port as an environment variable
# - venv path
ENV TINI_VERSION=v0.19.0 \
    DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:99

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

# Install uv and create virtual environment
RUN pip install uv && \
    uv venv

# Create and switch into app directory
RUN mkdir /app
WORKDIR /app

# Install Python dependency file
COPY pyproject.toml \
    alembic.ini \
    README.md \
    /app/

# Copy app files (has to be done before installing deps)
COPY /src/ /app/src/

# Install Python dependencies
RUN uv pip install . && \
    uv run playwright install chromium && \
    uv run playwright install-deps
    
# Lootscraper: Run
CMD [ "uv", "run", "lootscraper" ]

# Config
VOLUME /data
