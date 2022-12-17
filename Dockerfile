FROM python:3.11

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

# Lootscraper: Make folder
RUN mkdir /app
WORKDIR /app

# Lootscraper: Install Python libraries and save list of installed packages (for debugging)
COPY requirements.txt /app
RUN pip install --upgrade pip \
    && pip install -r requirements.txt \
    && pip freeze > installed_packages.txt
RUN playwright install chromium

# Lootscraper: Add
COPY lootscraper.py \
    config.default.ini \
    alembic.ini \
    /app/
COPY app /app/app/
COPY alembic /app/alembic/
COPY js /app/js/

# Lootscraper: Run
CMD [ "python", "lootscraper.py", "--docker" ]

# Config
VOLUME /data