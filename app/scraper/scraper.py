from app.common import LootOffer


class Scraper:
    @staticmethod
    def scrape(options: dict[str, bool] = None) -> dict[str, list[LootOffer]]:
        raise NotImplementedError("Please implement this method")
