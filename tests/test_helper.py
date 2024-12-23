from __future__ import annotations

import unittest
from datetime import UTC, datetime

from lootscraper.utils import (
    calc_real_valid_to,
    clean_combined_title,
    clean_game_title,
    get_match_score,
)


class LocalTests(unittest.TestCase):
    def test_similarity_1(self) -> None:
        search = "Rainbow Six Siege"
        result = "Tom Clancy's Rainbow Six® Siege"

        score = get_match_score(search, result)
        assert score == 0.99

    def test_similarity_2(self) -> None:
        search = "Fall Guys"
        result = "Fall Guy"

        score = get_match_score(search, result)
        assert score < 0.99

    def test_loot_title_cleaning_1(self) -> None:
        title = "Tom Clancy's Rainbow Six® Siege"
        cleaned = "Tom Clancy's Rainbow Six® Siege"

        assert clean_game_title(title) == cleaned

    def test_loot_title_cleaning_2(self) -> None:
        title = "Lords Mobile: Warlord Pack"
        cleaned_game = "Lords Mobile"
        cleaned_offer = "Lords Mobile - Warlord Pack"

        assert clean_combined_title(title) == (cleaned_game, cleaned_offer)

    def test_loot_title_cleaning_3(self) -> None:
        title = "Mobile Legends: Bang Bang: Amazon Prime Chest"
        cleaned_game = "Mobile Legends: Bang Bang"
        cleaned_offer = "Mobile Legends: Bang Bang - Amazon Prime Chest"

        assert clean_combined_title(title) == (cleaned_game, cleaned_offer)

    def test_loot_title_cleaning_4(self) -> None:
        title = "Get up to GTA$400,000 this month in GTA Online"
        cleaned_game = "GTA Online"
        cleaned_offer = "GTA Online - Up to GTA$400,000 this month"

        assert clean_combined_title(title) == (cleaned_game, cleaned_offer)

    def test_loot_title_cleaning_5(self) -> None:
        title = "World of Warships — Starter Pack: Dreadnought"
        cleaned_game = "World of Warships"
        cleaned_offer = "World of Warships - Starter Pack: Dreadnought"

        assert clean_combined_title(title) == (cleaned_game, cleaned_offer)

    def test_real_valid_to_date(self) -> None:
        seen_last = datetime(2020, 6, 1, 0, 0, 0, tzinfo=UTC)
        valid_to = datetime(2020, 6, 15, 0, 0, 0, tzinfo=UTC)
        forced_now = datetime(2022, 1, 1, 0, 0, 0, tzinfo=UTC)

        real_valid_to = calc_real_valid_to(seen_last, valid_to, forced_now=forced_now)

        assert real_valid_to == seen_last

    def test_real_valid_to_date2(self) -> None:
        seen_last = datetime(2020, 6, 1, 0, 0, 0, tzinfo=UTC)
        valid_to = datetime(2020, 6, 15, 0, 0, 0, tzinfo=UTC)
        forced_now = datetime(2020, 6, 1, 0, 0, 1, tzinfo=UTC)

        real_valid_to = calc_real_valid_to(seen_last, valid_to, forced_now=forced_now)

        assert real_valid_to == valid_to

    def test_real_valid_to_date3(self) -> None:
        seen_last = datetime(2020, 6, 1, 0, 0, 0, tzinfo=UTC)
        valid_to = None
        forced_now = datetime(2020, 6, 1, 0, 0, 1, tzinfo=UTC)

        real_valid_to = calc_real_valid_to(seen_last, valid_to, forced_now=forced_now)

        assert real_valid_to is None

    def test_real_valid_to_date4(self) -> None:
        seen_last = datetime(2020, 6, 1, 0, 0, 0, tzinfo=UTC)
        valid_to = None
        forced_now = datetime(2020, 6, 3, 0, 0, 0, tzinfo=UTC)

        real_valid_to = calc_real_valid_to(seen_last, valid_to, forced_now=forced_now)

        assert real_valid_to == seen_last

    def test_real_valid_to_date5(self) -> None:
        seen_last = datetime(2020, 6, 1, 0, 0, 0, tzinfo=UTC)
        valid_to = datetime(2020, 6, 1, 6, 0, 0, tzinfo=UTC)
        forced_now = datetime(2020, 6, 1, 2, 0, 0, tzinfo=UTC)

        real_valid_to = calc_real_valid_to(seen_last, valid_to, forced_now=forced_now)

        assert real_valid_to == valid_to

    def test_real_valid_to_date6(self) -> None:
        seen_last = datetime(2020, 6, 1, 0, 0, 0, tzinfo=UTC)
        valid_to = datetime(2020, 6, 1, 6, 0, 0, tzinfo=UTC)
        forced_now = datetime(2020, 6, 2, 0, 0, 0, tzinfo=UTC)

        real_valid_to = calc_real_valid_to(seen_last, valid_to, forced_now=forced_now)

        assert real_valid_to == seen_last


if __name__ == "__main__":
    unittest.main()
