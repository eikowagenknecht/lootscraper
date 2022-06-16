# Readme for developers

Most people will probably just use the feeds I provide, so there is no need to clutter the readme with information only useful for developers. So this goes here! It's currently mostly a quick braindump for my convenience. Often used commands, concepts and tasks. It is guaranteed to *not* be complete. At all.

Additional commands for dev:

1. `pip install -r requirements_DEV.txt`

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

## IDs & Secrets for IGDB & Telegram

### IGDB

1. <https://api-docs.igdb.com/#about>

### Telegram

1. <https://t.me/botfather>
2. `/create`
3. AccessToken: "Use this token to access the HTTP API:..."
4. DeveloperChatId: Send `/debug` to <https://t.me/LootScraperBot>
