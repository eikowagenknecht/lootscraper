from dataclasses import dataclass
from enum import Enum


class OfferType(Enum):
    LOOT = "Loot"
    GAME = "Game"


@dataclass
class LootOffer:
    source: str
    type: str
    title: str
    subtitle: str
    publisher: str
    enddate: str
