# LootScraper

[![Publish to Docker Hub](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish_docker_hub.yml/badge.svg)](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish_docker_hub.yml)
[![Publish to Github Packages](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish_github_packages.yml/badge.svg)](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish_github_packages.yml)
[![CC BY-NC-SA 4.0][cc-by-nc-sa-shield]][cc-by-nc-sa]

You enjoy getting games for free but you *don’t* enjoy having to keep track of the various sources (Amazon Prime, Epic Games, Steam, ...) for free offers? Also your F5 key starts to look a bit worn out? Then this is for you!

This Python (3.10+) application uses Selenium to automatically visit sites with free gaming related offers (currently Amazon Prime, Epic Games and Steam are supported, more will follow) and then neatly puts the gathered information into RSS feeds and a Telegram bot. So now you can track the offers using your favorite news reader like Feedly instead of manually visiting the sites or get a message every time a new offer is available.

## Usage

You can either run this script locally on your computer or in any environment capable of running a Docker container.

Just want the feeds? Sure. You can use the links below. They are updated every 20 minutes.

If you prefer Telegram, you can instead subscribe to the [Telegram LootScraperBot](https://t.me/LootScraperBot) to get push notifications for new offers. You can choose which categories to subscribe there.

- Amazon Prime ([games](https://feed.phenx.de/lootscraper_amazon_game.xml) and [ingame loot](https://feed.phenx.de/lootscraper_amazon_loot.xml))
- [Epic Games](https://feed.phenx.de/lootscraper_epic_game.xml)
- [Gog games](https://feed.phenx.de/lootscraper_gog_game.xml)
- [Humble games](https://feed.phenx.de/lootscraper_humble_game.xml)
- [itch.io games](https://feed.phenx.de/lootscraper_itch_game.xml)
- Steam ([games](https://feed.phenx.de/lootscraper_steam_game.xml) and [ingame loot](https://feed.phenx.de/lootscraper_steam_loot.xml))

For our mobile gamers:

- [Apple iPhone games](https://feed.phenx.de/lootscraper_apple_game.xml)

If you want *everything* in one feed, use [this link](https://feed.phenx.de/lootscraper.xml). If you want to get the offers by email instead, you can use free services like <https://blogtrottr.com/> or <https://feedsub.com/> to convert from RSS to email.

This is what it currently looks like in Feedly:

![image](https://user-images.githubusercontent.com/1475672/161056100-2fcf005f-19a9-4279-a2d3-5a90855426ff.png)

... and in Telegram:

![image](https://user-images.githubusercontent.com/1475672/166058823-98e2beb9-7eb5-403d-94c7-7e17966fe9b7.png)

## State

This project is still in ongoing development, so expect a few rough edges if you try to run it yourself. If you encounter any problems feel free to open an issue here and I'll try to help.

I have quite a few features on my mind that I'd like to implement. I also plan to extend this to more sources for free offers. All of this is tracked in the Github issues.

## For power users and developers

If you want to run this yourself or contribute, please see the [README for developers](README_DEV.md) file.

## License

[![CC BY-NC-SA 4.0][cc-by-nc-sa-image]][cc-by-nc-sa]

This work is licensed under a
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License][cc-by-nc-sa].

[cc-by-nc-sa]: http://creativecommons.org/licenses/by-nc-sa/4.0/
[cc-by-nc-sa-image]: https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png
[cc-by-nc-sa-shield]: https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg
