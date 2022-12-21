from typing import Type

from lootscraper.scraper.loot.amazon_games import AmazonGamesScraper
from lootscraper.scraper.loot.amazon_loot import AmazonLootScraper
from lootscraper.scraper.loot.apple_games import AppleGamesScraper
from lootscraper.scraper.loot.epic_games import EpicGamesScraper
from lootscraper.scraper.loot.gog_games import GogGamesScraper
from lootscraper.scraper.loot.gog_games_alwaysfree import GogGamesAlwaysFreeScraper
from lootscraper.scraper.loot.google_games import GoogleGamesScraper
from lootscraper.scraper.loot.humble_games import HumbleGamesScraper
from lootscraper.scraper.loot.itch_games import ItchGamesScraper
from lootscraper.scraper.loot.scraper import Scraper
from lootscraper.scraper.loot.steam_games import SteamGamesScraper
from lootscraper.scraper.loot.steam_loot import SteamLootScraper


def get_all_scrapers() -> list[Type[Scraper]]:
    return [
        AmazonGamesScraper,
        AmazonLootScraper,
        AppleGamesScraper,
        EpicGamesScraper,
        GogGamesScraper,
        GogGamesAlwaysFreeScraper,
        GoogleGamesScraper,
        HumbleGamesScraper,
        ItchGamesScraper,
        SteamGamesScraper,
        SteamLootScraper,
    ]
