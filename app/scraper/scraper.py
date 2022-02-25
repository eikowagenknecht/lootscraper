from app.common import LootOffer


class Scraper:
    @staticmethod
    def scrape(options: dict[str, bool] = None) -> list[LootOffer]:
        raise NotImplementedError("Please implement this method")
