# Script to copy over all data from the old database to the new one.
# The new one should be generated with a run of lootscraper without an existing
# database file.
import sqlite3

source_conn = sqlite3.connect("lootscraper.db")
target_conn = sqlite3.connect("lootscraper_refreshed.db")

source_cursor = source_conn.cursor()
target_cursor = target_conn.cursor()

# Disable foreign keys
source_cursor.execute("PRAGMA foreign_keys = OFF;")
target_cursor.execute("PRAGMA foreign_keys = OFF;")

# Get the list of all tables in source database
source_cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = source_cursor.fetchall()

# Copy data from source to target database
for table in tables:
    table_name = table[0]
    source_cursor.execute(f"SELECT * FROM {table_name};")  # noqa: S608

    rows = source_cursor.fetchall()
    if not rows:
        continue

    placeholders = ", ".join(["?"] * len(rows[0]))
    target_cursor.executemany(
        f"INSERT INTO {table_name} VALUES ({placeholders});",  # noqa: S608
        rows,
    )

# Enable foreign keys
source_cursor.execute("PRAGMA foreign_keys = ON;")
target_cursor.execute("PRAGMA foreign_keys = ON;")

source_conn.commit()
target_conn.commit()

source_conn.close()
target_conn.close()
