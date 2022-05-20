FROM python:3.10

# Adding trusting keys to apt for repositories
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -

# Add Chrome to the repositories
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'

# Install Chrome
RUN apt-get -y update
RUN apt-get install -y google-chrome-stable

# Install xvfb (virtual desktop) so Chrome can run in non-headless mode
RUN apt-get install -y xvfb

# Install Unzip
#RUN apt-get install -yqq unzip

# Download Chrome Driver
#RUN wget -O /tmp/chromedriver.zip http://chromedriver.storage.googleapis.com/`curl -sS chromedriver.storage.googleapis.com/LATEST_RELEASE`/chromedriver_linux64.zip

# Unzip Chrome Driver into /usr/local/bin directory
#RUN unzip /tmp/chromedriver.zip chromedriver -d /usr/local/bin/

# Set display port as an environment variable
ENV DISPLAY=:99

# Add the script
RUN mkdir /app
WORKDIR /app

# Install needed Python libraries
COPY requirements.txt /app
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Add the script
COPY lootscraper.py /app
COPY config.default.ini /app
COPY alembic.ini /app
COPY app /app/app
COPY alembic /app/alembic
COPY js /app/js

# Run the script
CMD [ "python", "lootscraper.py", "--docker" ]

VOLUME /data
