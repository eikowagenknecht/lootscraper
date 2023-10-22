from lootscraper.scraper.amazon_games import AmazonGamesScraper
from lootscraper.scraper.amazon_loot import AmazonLootScraper
from lootscraper.scraper.apple_games import AppleGamesScraper
from lootscraper.scraper.epic_games import EpicGamesScraper
from lootscraper.scraper.gog_games import GogGamesScraper
from lootscraper.scraper.gog_games_alwaysfree import GogGamesAlwaysFreeScraper
from lootscraper.scraper.google_games import GoogleGamesScraper
from lootscraper.scraper.humble_games import HumbleGamesScraper
from lootscraper.scraper.itch_games import ItchGamesScraper
from lootscraper.scraper.scraper_base import Scraper
from lootscraper.scraper.steam_games import SteamGamesScraper
from lootscraper.scraper.steam_loot import SteamLootScraper
from lootscraper.scraper.ubisoft_games import UbisoftGamesScraper


def get_all_scrapers() -> list[type[Scraper]]:
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
        UbisoftGamesScraper,
    ]
