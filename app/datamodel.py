from dataclasses import dataclass


@dataclass
class LootOffer:
    source: str
    type: str
    title: str
    subtitle: str
    publisher: str
    enddate: str
