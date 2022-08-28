FROM python:3.10

# Tini (init): Add
ENV TINI_VERSION v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

# xvfb: Set display port as an environment variable
ENV DISPLAY=:99

# xvfb (virtual desktop): Install
RUN apt-get install -y xvfb

# Chrome: Add google repo with keys
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'

# Chrome: Install
RUN apt-get install -y google-chrome-stable

# Linux: Update to latest version
RUN apt-get -y update

# Lootscraper: Make folder
RUN mkdir /app
WORKDIR /app

# Lootscraper: Install Python libraries
COPY requirements.txt /app
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Lootscraper: Add
COPY lootscraper.py /app
COPY config.default.ini /app
COPY alembic.ini /app
COPY app /app/app
COPY alembic /app/alembic
COPY js /app/js

# Lootscraper: Run
CMD [ "python", "lootscraper.py", "--docker" ]

# Config
VOLUME /data
