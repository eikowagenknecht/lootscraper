FROM python:3.12-bullseye

# Tini (init): Add
ENV TINI_VERSION v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

# Linux: Skip interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# xvfb: Set display port as an environment variable
ENV DISPLAY=:99

# Linux: Get list of latest available packages and install needed libraries.
# Then Remove unnecessary temporary files. All in one command so that no layers are built in between.
RUN apt-get update && apt-get install -y \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Prepare installation of poetry
ENV POETRY_HOME="/opt/poetry" \
    POETRY_VERSION=1.5.1
ENV PATH="$POETRY_HOME/bin:$PATH"

# Install poetry (Python package manager)
RUN curl -sSL https://install.python-poetry.org | python3 -

# Create and switch into app directory
RUN mkdir /app
WORKDIR /app

# Install Python libraries
COPY poetry.lock \
    pyproject.toml \
    config.default.toml \
    alembic.ini \
    README.md \
    /app/
COPY /src/ /app/src/

RUN poetry install
RUN poetry run playwright install chromium
RUN poetry run playwright install-deps

# Lootscraper: Run
CMD [ "poetry", "run", "lootscraper" ]

# Config
VOLUME /data
