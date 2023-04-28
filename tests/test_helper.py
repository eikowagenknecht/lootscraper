from __future__ import annotations

import unittest
from datetime import datetime, timezone

from lootscraper.scraper.info.utils import (
    calc_real_valid_to,
    clean_loot_title,
    get_match_score,
)


class LocalTests(unittest.TestCase):
    def test_similarity_1(self: LocalTests) -> None:
        search = "Rainbow Six Siege"
        result = "Tom Clancy's Rainbow Six® Siege"

        score = get_match_score(search, result)
        assert score == 0.99

    def test_similarity_2(self: LocalTests) -> None:
        search = "Fall Guys"
        result = "Fall Guy"

        score = get_match_score(search, result)
        assert score < 0.99

    def test_loot_title_cleaning_1(self: LocalTests) -> None:
        title = "Tom Clancy's Rainbow Six® Siege"
        cleaned = "Tom Clancy's Rainbow Six® Siege"

        assert clean_loot_title(title) == cleaned

    def test_loot_title_cleaning_2(self: LocalTests) -> None:
        title = "Lords Mobile: Warlord Pack"
        cleaned = "Lords Mobile"

        assert clean_loot_title(title) == cleaned

    def test_loot_title_cleaning_3(self: LocalTests) -> None:
        title = "Mobile Legends: Bang Bang: Amazon Prime Chest"
        cleaned = "Mobile Legends: Bang Bang"

        assert clean_loot_title(title) == cleaned

    def test_loot_title_cleaning_4(self: LocalTests) -> None:
        title = "Get up to GTA$400,000 this month in GTA Online"
        cleaned = "GTA Online"

        assert clean_loot_title(title) == cleaned

    def test_loot_title_cleaning_5(self: LocalTests) -> None:
        title = "Get up to GTA$400,000 this week in GTA Online"
        cleaned = "GTA Online"

        assert clean_loot_title(title) == cleaned

    def test_loot_title_cleaning_6(self: LocalTests) -> None:
        title = "World of Warships — Starter Pack: Dreadnought"
        cleaned = "World of Warships"

        assert clean_loot_title(title) == cleaned

    def test_real_valid_to_date(self: LocalTests) -> None:
        seen_last = datetime(2020, 6, 1, 0, 0, 0, tzinfo=timezone.utc)
        valid_to = datetime(2020, 6, 15, 0, 0, 0, tzinfo=timezone.utc)
        forced_now = datetime(2022, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

        real_valid_to = calc_real_valid_to(seen_last, valid_to, forced_now=forced_now)

        assert real_valid_to == seen_last

    def test_real_valid_to_date2(self: LocalTests) -> None:
        seen_last = datetime(2020, 6, 1, 0, 0, 0, tzinfo=timezone.utc)
        valid_to = datetime(2020, 6, 15, 0, 0, 0, tzinfo=timezone.utc)
        forced_now = datetime(2020, 6, 1, 0, 0, 1, tzinfo=timezone.utc)

        real_valid_to = calc_real_valid_to(seen_last, valid_to, forced_now=forced_now)

        assert real_valid_to == valid_to

    def test_real_valid_to_date3(self: LocalTests) -> None:
        seen_last = datetime(2020, 6, 1, 0, 0, 0, tzinfo=timezone.utc)
        valid_to = None
        forced_now = datetime(2020, 6, 1, 0, 0, 1, tzinfo=timezone.utc)

        real_valid_to = calc_real_valid_to(seen_last, valid_to, forced_now=forced_now)

        assert real_valid_to is None

    def test_real_valid_to_date4(self: LocalTests) -> None:
        seen_last = datetime(2020, 6, 1, 0, 0, 0, tzinfo=timezone.utc)
        valid_to = None
        forced_now = datetime(2020, 6, 3, 0, 0, 0, tzinfo=timezone.utc)

        real_valid_to = calc_real_valid_to(seen_last, valid_to, forced_now=forced_now)

        assert real_valid_to == seen_last

    def test_real_valid_to_date5(self: LocalTests) -> None:
        seen_last = datetime(2020, 6, 1, 0, 0, 0, tzinfo=timezone.utc)
        valid_to = datetime(2020, 6, 1, 6, 0, 0, tzinfo=timezone.utc)
        forced_now = datetime(2020, 6, 1, 2, 0, 0, tzinfo=timezone.utc)

        real_valid_to = calc_real_valid_to(seen_last, valid_to, forced_now=forced_now)

        assert real_valid_to == valid_to

    def test_real_valid_to_date6(self: LocalTests) -> None:
        seen_last = datetime(2020, 6, 1, 0, 0, 0, tzinfo=timezone.utc)
        valid_to = datetime(2020, 6, 1, 6, 0, 0, tzinfo=timezone.utc)
        forced_now = datetime(2020, 6, 2, 0, 0, 0, tzinfo=timezone.utc)

        real_valid_to = calc_real_valid_to(seen_last, valid_to, forced_now=forced_now)

        assert real_valid_to == seen_last


if __name__ == "__main__":
    unittest.main()
