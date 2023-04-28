# The bahaviour of the config.context object is different in the env.py script,
# so no-member errors must be ignored here. See also:
# https://stackoverflow.com/questions/51203641/attributeerror-module-alembic-context-has-no-attribute-config
from logging.config import fileConfig
from pathlib import Path

from lootscraper import database
from lootscraper.config import Config
from sqlalchemy import create_engine, pool
from sqlalchemy.schema import SchemaItem

from alembic import context

IGNORE_TABLES = ["sqlite_sequence"]

# This is the Alembic Config object, which provides access to the values within
# the .ini file in use.
config = context.config

# Interpret the config file for Python logging. This line sets up loggers basically.
if config.config_file_name is not None and config.attributes.get(
    "configure_logger",
    True,
):
    fileConfig(config.config_file_name)

# Add your model's MetaData object here for 'autogenerate' support.
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = database.Base.metadata

# Other values from the config, defined by the needs of env.py can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def include_object(
    object_: SchemaItem,
    name: str,
    type_: str,
    reflected: bool,
    compare_to: SchemaItem,
) -> bool:
    """
    Should you include this table or not?
    """

    if type_ == "table" and (name in IGNORE_TABLES):
        return False

    return True


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.
    """

    db_file_path = Config.data_path() / Path(Config.get().database_file)
    url = f"sqlite+pysqlite:///{db_file_path}"

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        render_as_batch=True,
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """

    db_file_path = Config.data_path() / Path(Config.get().database_file)
    url = f"sqlite+pysqlite:///{db_file_path}"

    connectable = create_engine(
        url=url,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            render_as_batch=True,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
