from typing import Type

from app.scraper.loot.amazon_games import AmazonGamesScraper
from app.scraper.loot.amazon_loot import AmazonLootScraper
from app.scraper.loot.epic_games import EpicGamesScraper
from app.scraper.loot.gog_games import GogGamesScraper
from app.scraper.loot.gog_games_alwaysfree import GogGamesAlwaysFreeScraper
from app.scraper.loot.humble_games import HumbleGamesScraper
from app.scraper.loot.itch_games import ItchGamesScraper
from app.scraper.loot.scraper import Scraper
from app.scraper.loot.steam_games import SteamGamesScraper
from app.scraper.loot.steam_loot import SteamLootScraper


def get_all_scrapers() -> list[Type[Scraper]]:
    return [
        AmazonGamesScraper,
        AmazonLootScraper,
        EpicGamesScraper,
        GogGamesScraper,
        GogGamesAlwaysFreeScraper,
        HumbleGamesScraper,
        SteamGamesScraper,
        SteamLootScraper,
        ItchGamesScraper,
    ]
