# Loot Scraper

[![CC BY-NC-SA 4.0][cc-by-nc-sa-shield]][cc-by-nc-sa]

This project reads the free offers from various sources (Amazon Prime, Epic Games, Steam) and puts them in ATOM feeds.

## State

This project is in ongoing development, not yet usable for the average user and might often introduce breaking changes (a.k.a. "alpha" stage).

### TODO

- [ ] Fix SIGINT (Strg+C) handling. Currently it does not exit the script

### Features

- [x] Runnable in a docker container (e.g. on a Synology NAS)
- [x] Scrape offers into a SQLITE database
- [x] Generate ATOM feed from the offers in the database
- [x] Store parsed and interpreted text
- [x] Incrementally update the database and ATOM feed with only new offers
- [x] Upload results with FTP
- [x] Add links to the claim page in the feed
- [x] Make the script run hourly within the Docker container (<https://github.com/dbader/schedule>)
- [ ] Configuration in INI file
- [ ] Add tests (pytest?)

- [ ] Dynamically generate ATOM feeds split by source and type (e.g. only amazon ingame loot) in addition to the full feed
- [ ] Error handling
- [ ] Notify by mail when something goes wrong (e.g. a source cannot be scraped)
- [ ] Better support of timezones
- [ ] Support multiple languages (at least EN and DE)
- [ ] Support start and end dates of offers
- [ ] Push mails for offers that are valid only for a short time (less than 1 day)

### Advanced features

- [ ] Add a preview picture
- [ ] Add the metacritic score for the game and/or other useful information

### Scrapers

- [x] Amazon Prime (Games and InGame)
- [x] Epic Games
- [ ] Steam
- [ ] GOG.com

## Howto

### Run locally

Needs an installed Python 3.10 environment.

- Download repository
- Copy config.example.py to config.py and replace with your settings
- Create virtual environment (`python -m venv .venv`)
- Activate virtual environment (`./.venv/Scripts/Activate`)
- Run (`python ./lootscraper.py`)

### Build and run Docker container

Docker needs to be installed first of course.

- Download repository
- Copy config.example.py to config.py and replace with your settings
- In terminal go to directory
- First run:
  - Build: `docker build . -t eikowagenknecht/lootscraper:latest`
  - Start: `docker run --detach --volume /your/local/path:/data --name lootscraper eikowagenknecht/lootscraper:latest`
- Update:
  - Stop: `docker stop lootscraper`
  - Remove: `docker container rm lootscraper`
  - Build without cache: `docker build . --no-cache -t eikowagenknecht/lootscraper:latest`
  - Start: `docker run --detach --volume /your/local/path:/data --name lootscraper eikowagenknecht/lootscraper:latest`
- Debug: `docker run -it --entrypoint /bin/bash --volume /your/local/path:/data --name lootscraper_debug eikowagenknecht/lootscraper:latest`
- To stop, run `docker stop lootscraper`

## License

[![CC BY-NC-SA 4.0][cc-by-nc-sa-image]][cc-by-nc-sa]

This work is licensed under a
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License][cc-by-nc-sa].

[cc-by-nc-sa]: http://creativecommons.org/licenses/by-nc-sa/4.0/
[cc-by-nc-sa-image]: https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png
[cc-by-nc-sa-shield]: https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg
