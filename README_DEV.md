# Readme for developers and power users

Most people will probably just use the feeds and bot I provide, so there is no need to clutter the readme with information only useful for developers or power users that want to self-host.
So this goes here!
It's currently mostly a quick braindump for my convenience.
Often used commands, concepts and tasks.
It is guaranteed to *not* be complete.
At all.

The commands below are for Windows and use `pnpm`.
If you use Linux or other packet managers, you probably know the right substitutes.

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
