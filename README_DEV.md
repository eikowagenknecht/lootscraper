# Readme for developers and power users

Most people will probably just use the feeds and bot I provide, so there is no need to clutter the readme with information only useful for developers or power users that want to self-host.
So this goes here!
It's currently mostly a quick braindump for my convenience.
Often used commands, concepts and tasks.
It is guaranteed to *not* be complete.
At all.

The commands below are for Windows and use `pnpm`.
If you use Linux or other packet managers, you probably know the right substitutes.

## Version 2.0

In February 2025, I released version 2.0 of this project.
It is a complete rewrite and uses TypeScript instead of Python.
The new version runs a lot faster (10min instead of 22min when I compared a complete run over all scrapers), smaller (900MB Docker image instead of 1.8GB) and should be more reliable.

If you want to migrate from the old version (1.x) to the new one (2.x):

- Keep the old database. It will be automatically migrated.
- Create a new configuration file as its format and options have changed significantly.

You can find the old Python version in the `legacy-python` branch and the new one in `main`.

## Run this locally

To run this yourself, you first need an installed Node.js 22+ environment.

- Download repository
- In terminal go to directory
- Install dependencies: `pnpm install`
- Install playwright browser (`playwright install firefox`)

Run in development mode:

- Run (`pnpm run dev`)

Run in production mode:

- Build: `pnpm run build`
- Start: `pnpm run start`

## Build and run as Docker container

Docker needs to be [downloaded](https://www.docker.com/) and installed first.
If you want to skip the build step, you can use <https://hub.docker.com/r/eikowagenknecht/lootscraper> as the image.
Use the "main" tag to get the latest build from this repository.

To build yourself:

- Download repository
- In terminal go to directory
- Build: `docker build . -t eikowagenknecht/lootscraper:develop`
- Create and start container: `docker run --volume "${PWD}/data:/data" --name lootscraper eikowagenknecht/lootscraper:develop`
  - (You can also add `--detach` to run in the background)
- Update:
  - Stop: `docker stop lootscraper`
  - Remove: `docker container rm lootscraper`
  - Build and start just like above
- Push to Docker Hub: `docker push eikowagenknecht/lootscraper:develop`
- Save image locally: `docker image save -o ./data/lootscraper.tar eikowagenknecht/lootscraper:develop`
- Explore container without lootscraper running: `docker run -it --entrypoint /bin/bash --volume "${PWD}/data:/data" --name lootscraper_debug eikowagenknecht/lootscraper:develop`
- Show logs: `docker logs -f lootscraper`

## Update dependencies

- Sync dependencies with lock file: `pnpm run sync:npm`
- Show outdated packages: `pnpm outdated`
- Update all packages to latest: `pnpm run upgrade:npm`
- Clean up to start fresh: `pnpm run clean:npm`

## Settings

On the first startup, a default configuration file will be created in `./data/config.toml`.
You can edit this file to change the settings (e.g. the sites to visit and the actions to perform).
It also stores the needed API keys (see below), so just put them in there and then restart the application.

### IGDB API Keys

See <https://api-docs.igdb.com/#about> for details on how to get an application ID and secret for the IGDB API.

### Telegram Bot

Start a chat with [Botfather](https://t.me/botfather), send him the `/create` command and follow the guided process.
You will get an access token from him to put in the settings file.
To get your user ID or the id of the group chat you are in, just send `/debug` to my public [Telegram LootScraperBot](https://t.me/LootScraperBot).
You can put that into "DeveloperChatId" config entry.
Telegram related errors will be sent there.

## Contribute

- If you want to contribute, please open an issue first to discuss the changes.
- Please follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for commit messages. The following types can be used:
  - `feat`: A new feature (minor version bump)
  - `fix`: A bug fix (patch version bump)
  - `refactor`: A code change that neither fixes a bug nor adds a feature
  - `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
  - `docs`: Documentation only changes
  - `perf`: A code change that improves performance
  - `test`: Adding missing or correcting existing tests
  - `chore`: Maintenance tasks, dependency updates and other non-user-facing changes
  - `ci`: Changes to the CI configuration files and scripts (GitHub Actions)
  - `revert`: Reverts a previous commit. In the body, it should say: `This reverts commit <hash>.`
- Run `pnpm lint` and `pnpm test` before committing to check for linting or testing errors.

## Detailled Usage Stats

Just in case anyone is interested, these are the stats as of 2024-09-26:

- The Telegram bot has 311 active subscribers (out of a total of 388, so retention is pretty good).
- I can't say for sure how many people use the RSS feeds.
  But my web hosting provider tells me that there is about 10GB of traffic per month from about 2 million hits in total.
  Epic is the most popular with around 600k hits.
  Steam follows with 400k hits, GOG 300k, Humble 200k, Amazon 200k, Ubisoft 150k.
  Itch and the mobile platforms have around 50k each and the all-in-one has 90k.
  How hits translate to users I can't say.
  Since the feeds are probably pulled regularly by readers and aggregators like Feedly, the actual number of users will be lower.
- The HTML pages are a very mixed bag.
  The Epic page is the most popular with about 10k hits per month.
  Steam games get 9k hits per month, the rest are between 5 and 25 hits.
  The all-in-one page is at 400 hits per month.

## Pipeline status

[![Quality Check](https://github.com/eikowagenknecht/lootscraper/actions/workflows/quality-check.yml/badge.svg)](https://github.com/eikowagenknecht/lootscraper/actions/workflows/quality-check.yml)
[![Publish to Docker Hub and Github Packages](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish-docker.yml/badge.svg)](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish-docker.yml)
