FROM python:3.10

# Tini (init): Add
ENV TINI_VERSION v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

# Linux: Skip interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# xvfb: Set display port as an environment variable
ENV DISPLAY=:99

# Chrome: Add google repo with keys
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'

# Linux: Get list of latest available packages and install needed libraries.
# Then Remove unnecessary temporary files. All in one command so that no layers are built in between.
RUN apt-get update && apt-get install -y \
    xvfb \
    google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Lootscraper: Make folder
RUN mkdir /app
WORKDIR /app

# Lootscraper: Install Python libraries
COPY requirements.txt /app
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# Lootscraper: Add
COPY lootscraper.py config.default.ini alembic.ini /app/
COPY app /app/app/
COPY alembic /app/alembic/
COPY js /app/js/

# Lootscraper: Run
CMD [ "python", "lootscraper.py", "--docker" ]

# Config
VOLUME /data
