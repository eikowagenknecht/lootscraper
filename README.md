# LootScraper

![image](images/ls_2880x1024.png)

[![Publish to Docker Hub](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish_docker_hub.yml/badge.svg)](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish_docker_hub.yml)
[![Publish to Github Packages](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish_github_packages.yml/badge.svg)](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish_github_packages.yml)
[![CC BY-NC-SA 4.0][cc-by-nc-sa-shield]][cc-by-nc-sa]

You enjoy getting games for free but you *don’t* enjoy having to keep track of the various sources (Amazon Prime, Epic Games, Steam, ...) for free offers? Also your F5 key starts to look a bit worn out? Then this is for you!

## Public feeds / channels / bots

Let's be honest, you're probably not here because you are interested in the technical details of how this works. You just want free games. And that's fine. So without further ado, here's where you find them!

### Telegram channels

Want to get a Telegram notification each time a new offer is discovered? Just subscribe to the Telegram channels.

- Amazon Prime ([games](https://t.me/free_amazon_games_ls) and [ingame loot](https://t.me/free_amazon_loot_ls))
- [Epic Games](https://t.me/free_epic_games_ls)
- [Gog games](https://t.me/free_gog_games_ls)
- [Humble games](https://t.me/free_humble_games_ls)
- [itch.io games](https://t.me/free_itch_games_ls)
- Steam ([games](https://t.me/free_steam_games_ls) and [ingame loot](https://t.me/+ENZ8x3Ec1dwxMThi))

For our mobile gamers:

- [Apple iPhone games](https://t.me/+SOF7VjGTGPw1OTAy)
- [Google Android games](https://t.me/+Vma9PScf1uY3M2Uy)

### Telegram bot

Want to receive only the offers *you* want in one single chat? Subscribe directly to the source: The [Telegram LootScraperBot](https://t.me/LootScraperBot) will happily send you push notifications for new offers. You can choose which categories to subscribe there.

This is what it currently looks like in Telegram:

![image](https://user-images.githubusercontent.com/1475672/166058823-98e2beb9-7eb5-403d-94c7-7e17966fe9b7.png)

### RSS feeds

You prefer the anonymity and manageability of RSS feeds? Sure. You can use the links below.

- Amazon Prime ([games](https://feed.phenx.de/lootscraper_amazon_game.xml) and [ingame loot](https://feed.phenx.de/lootscraper_amazon_loot.xml))
- [Epic Games](https://feed.phenx.de/lootscraper_epic_game.xml)
- [Gog games](https://feed.phenx.de/lootscraper_gog_game.xml)
- [Humble games](https://feed.phenx.de/lootscraper_humble_game.xml)
- [itch.io games](https://feed.phenx.de/lootscraper_itch_game.xml)
- Steam ([games](https://feed.phenx.de/lootscraper_steam_game.xml) and [ingame loot](https://feed.phenx.de/lootscraper_steam_loot.xml))

For our mobile gamers:

- [Apple iPhone games](https://feed.phenx.de/lootscraper_apple_game.xml)
- [Google Android games](https://feed.phenx.de/lootscraper_google_game.xml)

If you want *everything* in one feed, use [this link](https://feed.phenx.de/lootscraper.xml). If you want to get the offers by email instead, you can use free services like <https://blogtrottr.com/> or <https://feedsub.com/> to convert from RSS to email.

This is what it currently looks like in Feedly:

![image](https://user-images.githubusercontent.com/1475672/161056100-2fcf005f-19a9-4279-a2d3-5a90855426ff.png)

## How this works

This Python (3.10+) application uses Selenium to automatically visit sites with free gaming related offers (currently Amazon Prime, Epic Games and Steam are supported, more will follow) and then neatly puts the gathered information into RSS feeds and a Telegram bot. So now you can track the offers using your favorite news reader like Feedly instead of manually visiting the sites or get a message every time a new offer is available.

If you encounter any problems feel free to open an issue here and I'll try my best to help. I'd also really like to hear your feature requests (even though I still have quite some ideas myself)!. This is tracked in the Github issues as well.

### For power users and developers

You can either run this project locally on your computer or in any environment capable of running a Docker container.

If you want to do so or even contribute, please see the [README for developers](README_DEV.md) file.

## License

[![CC BY-NC-SA 4.0][cc-by-nc-sa-image]][cc-by-nc-sa]

This work is licensed under a
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License][cc-by-nc-sa].

[cc-by-nc-sa]: http://creativecommons.org/licenses/by-nc-sa/4.0/
[cc-by-nc-sa-image]: https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png
[cc-by-nc-sa-shield]: https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg
