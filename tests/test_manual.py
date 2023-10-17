# type: ignore
from __future__ import annotations

import unittest

from lootscraper.tools import run_cleanup


class ManualTests(unittest.IsolatedAsyncioTestCase):
    """
    Convenience class to run specific funktions. These are *not* tests and
    some actually manipulate the database. Run with utmost caution.
    """

    @unittest.skip("Do *not* run this as a test. It's for manual execution only.")
    async def test_run_db_cleanup(self: ManualTests) -> None:
        run_cleanup()


if __name__ == "__main__":
    unittest.main()
