# Readme for developers and power users

Most people will probably just use the feeds and bot I provide, so there is no need to clutter the readme with information only useful for developers or power users that want to self-host. So this goes here! It's currently mostly a quick braindump for my convenience. Often used commands, concepts and tasks. It is guaranteed to *not* be complete. At all.

## Run this locally

So if you actually want to run this yourself, you first need an installed Python 3.12+ environment. The commands below are for Windows. If you use Linux, you probably know the right substitutes.

- Download repository
- Install uv (`pip install uv`)
- Create virtual environment (`uv venv`)
- Activate virtual environment (`./.venv/Scripts/activate`)
- Install the required packages (`uv sync`) (or `uv sync --no-dev` for production)
- Install playwright browser (`playwright install chrome`)
- Run (`uv run lootscraper`)

### Settings

On the first startup, a default configuration file will be created in `./data/config.toml`. You can edit this file to change the settings (e.g. the sites to visit and the actions to perform). It also stores the needed API keys (see below), so just put them in there and then start the application again.

#### IGDB API Keys

See <https://api-docs.igdb.com/#about> for details, how to get an application ID and secret for the IGDB API.

#### Telegram Bot

Start a chat with [Botfather](https://t.me/botfather), send him the `/create` command and follow the guided process. You will get an access token from him to put in the settings file. To get your user ID or the id of the group chat you are in, just send `/debug` to my public [Telegram LootScraperBot](https://t.me/LootScraperBot). You can put that into "DeveloperChatId" config entry. Telegram related errors will be sent there.

## Setting up the development environment

In addition to the above steps ("Run this locally"), I recommend installing the recommended VS Code extensions (Extensions > Filter > Recommended).

## Build and run as Docker container

Docker needs to be [downloaded](https://www.docker.com/) and installed first. If you want to skip the build step, you can use <https://hub.docker.com/r/eikowagenknecht/lootscraper> as the image. Use the "main" tag to get the latest build from this repository.

- Download repository
- In terminal go to directory
- First run:
  - Build: `docker build . -t eikowagenknecht/lootscraper:develop`
  - Start: `docker run --detach --volume /your/local/path/to/data:/data --name lootscraper eikowagenknecht/lootscraper:develop`
- Update:
  - Stop: `docker stop lootscraper`
  - Remove: `docker container rm lootscraper`
  - Build without cache: `docker build . --no-cache -t eikowagenknecht/lootscraper:develop`
  - Start: `docker run --detach --volume /your/local/path:/data --name lootscraper eikowagenknecht/lootscraper:develop`
- Push: `docker push eikowagenknecht/lootscraper:develop`
- Save locally: `docker image save -o ./data/lootscraper.tar eikowagenknecht/lootscraper:develop`
- Debug: `docker run -it --entrypoint /bin/bash --volume /your/local/path:/data --name lootscraper_debug eikowagenknecht/lootscraper:develop`
- To stop, run `docker stop lootscraper`

## SQLAlchemy

Overview of modern ORM statements (e.g. select).

- <https://docs.sqlalchemy.org/en/14/changelog/migration_20.html>

## Alembic

New database revisions are created in the following way:

1. Update the metadata / ORM model
2. Create a candidate: `alembic revision --autogenerate -m "Fancy revision description"`
3. Check and edit the candidate
4. Upgrade the database: `alembic upgrade head`

Some quick hints:

- Downgrade 1 revision: `alembic downgrade -1`
- Write custom scripts:
<https://stackoverflow.com/questions/24612395/how-do-i-execute-inserts-and-updates-in-an-alembic-upgrade-script>

## uv

- Synchronize local instal: `uv sync` (with dev deps) or `uv sync --no-dev` (without dev deps)
- Build: `uv build`
- Add package: `uv add <package>` or `uv add <package> --dev`
- Run: `uv run <package>`

### Update dependencies

- Update uv itself: `uv self update`
- Update all dependencies in `pyproject.toml`: Use Dependabot, uv doesn't have this functionality yet (see [this GH issue](https://github.com/astral-sh/uv/issues/6794))
- Show outdated deps: `uv pip list --outdated`

## Profiling

For profiling, run `scalene -m lootscraper`.

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
- Run ruff (`uv run ruff check . --fix`) and ruff format (`uv run ruff format .`) before committing.
