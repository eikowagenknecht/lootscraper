# LootScraper

![image](images/ls_2880x1024.png)

[![Publish to Docker Hub and Github Packages](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish-docker.yml/badge.svg)](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish-docker.yml)
[![CC BY-NC-SA 4.0][cc-by-nc-sa-shield]][cc-by-nc-sa]

You like getting games for free but you *don’t* like having to keep track of the various sources (Amazon Prime, Epic Games, Steam, ...) for free offers? Also your F5 key starts to look a bit worn out? Then this is for you!

## Public feeds / channels / bots

Let's face it, you're probably not here because you're interested in the technical details of how this works. You just want free games. And that's fine. So without further ado, here's where to find them! You have the following options:

- [Telegram channels](#telegram-channels)
- [Telegram bot](#telegram-bot)
- [RSS feeds](#rss-feeds)
- [E-Mail](#e-mail)
- [Discord](#discord)
- [HTML pages](#html-pages)

### Telegram channels

Want to get a Telegram notification every time a new offer is discovered? Simply subscribe to the Telegram channels.

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

Want to receive only the offers *you* want in a single chat? Subscribe directly to the source: The [Telegram LootScraperBot](https://t.me/LootScraperBot) will happily send you push notifications for new offers. You can choose which categories you want to subscribe to.

If you want, you can even add the bot to your own groups (including threaded groups) and channels. Just make sure to give it the neccessary permissions (admin rights work best).

This is what it currently looks like in Telegram:

![image](https://user-images.githubusercontent.com/1475672/166058823-98e2beb9-7eb5-403d-94c7-7e17966fe9b7.png)

### RSS feeds

Prefer the anonymity and manageability of RSS feeds? Sure. You can use the links below. These feeds contain all active offers.

- Amazon Prime ([games](https://feed.phenx.de/lootscraper_amazon_game.xml) and [ingame loot](https://feed.phenx.de/lootscraper_amazon_loot.xml))
- [Epic Games](https://feed.phenx.de/lootscraper_epic_game.xml)
- [Gog games](https://feed.phenx.de/lootscraper_gog_game.xml)
- [Humble games](https://feed.phenx.de/lootscraper_humble_game.xml)
- [itch.io games](https://feed.phenx.de/lootscraper_itch_game.xml)
- Steam ([games](https://feed.phenx.de/lootscraper_steam_game.xml) and [ingame loot](https://feed.phenx.de/lootscraper_steam_loot.xml))
- [Ubisoft games](https://feed.phenx.de/lootscraper_ubisoft_game.xml)
- [Apple iPhone games](https://feed.phenx.de/lootscraper_apple_game.xml)
- [Google Android games](https://feed.phenx.de/lootscraper_google_game.xml)

You can also have *all sources* in [one feed](https://feed.phenx.de/lootscraper.xml).

This is how it looks in Feedly:

![image](https://user-images.githubusercontent.com/1475672/161056100-2fcf005f-19a9-4279-a2d3-5a90855426ff.png)

### E-Mail

If you want to get the offers by email, you can use free services like [Blogtrottr](https://blogtrottr.com/) or [Feedsub](https://feedsub.com/) to convert from RSS to email.

### Discord

If you want to get the offers in a Discord channel, you can use the free [MonitoRSS](https://monitorss.xyz/) bot to post them there for you. I suggest the following settings:

- **Feed URL**: Use the RSS feed links above
- **Content**:

    ```md
    **{{title}}**

    {{description}}
    ```

- **Button**: Label: `Claim`, URL: `{{link}}`
- **Embed**: Just select `Image URL` with the `{{extracted::atom:content__#::image1}}` variable

### HTML pages

Want to check a website for new deals once in a while, but not be bothered by push notifications? Here are the latest offers in a nice and clean HTML page:

- Amazon Prime ([games](https://feed.phenx.de/lootscraper_amazon_game.html) and [ingame loot](https://feed.phenx.de/lootscraper_amazon_loot.html))
- [Epic Games](https://feed.phenx.de/lootscraper_epic_game.html)
- [Gog games](https://feed.phenx.de/lootscraper_gog_game.html)
- [Humble games](https://feed.phenx.de/lootscraper_humble_game.html)
- [itch.io games](https://feed.phenx.de/lootscraper_itch_game.html)
- Steam ([games](https://feed.phenx.de/lootscraper_steam_game.html) and [ingame loot](https://feed.phenx.de/lootscraper_steam_loot.html))
- [Ubisoft games](https://feed.phenx.de/lootscraper_ubisoft_game.html)
- [Apple iPhone games](https://feed.phenx.de/lootscraper_apple_game.html)
- [Google Android games](https://feed.phenx.de/lootscraper_google_game.html)

You can also have *all sources* on [one page](https://feed.phenx.de/lootscraper.html).

This is how it looks like:

![image](https://github.com/eikowagenknecht/lootscraper/assets/1475672/845042a8-372d-4f4e-9d01-d9fdfec77038)

### HTML archive

There is also an archive version of the HTML pages. These contain all offers that have been discovered so far, including expired ones.

- Amazon Prime ([games](https://feed.phenx.de/lootscraper_amazon_game_all.html) and [ingame loot](https://feed.phenx.de/lootscraper_amazon_loot_all.html))
- [Epic Games](https://feed.phenx.de/lootscraper_epic_game_all.html)
- [Gog games](https://feed.phenx.de/lootscraper_gog_game_all.html)
- [Humble games](https://feed.phenx.de/lootscraper_humble_game_all.html)
- [itch.io games](https://feed.phenx.de/lootscraper_itch_game_all.html)
- Steam ([games](https://feed.phenx.de/lootscraper_steam_game_all.html) and [ingame loot](https://feed.phenx.de/lootscraper_steam_loot_all.html))
- [Ubisoft games](https://feed.phenx.de/lootscraper_ubisoft_game_all.html)
- [Apple iPhone games](https://feed.phenx.de/lootscraper_apple_game_all.html)
- [Google Android games](https://feed.phenx.de/lootscraper_google_game_all.html)

You can also have *all sources* on [one page](https://feed.phenx.de/lootscraper_all.html).

This is how it looks like:

![image](https://github.com/eikowagenknecht/lootscraper/assets/1475672/845042a8-372d-4f4e-9d01-d9fdfec77038)

## How it works

This Python (3.11+) application uses Playwright to automatically visit websites with free game-related offers (see below for the supported sources) and then puts the collected information neatly into RSS feeds and a Telegram bot.

If you encounter any problems feel free to open an issue here and I'll do my best to help. I'd also love to hear your feature requests! This is also tracked in the GitHub issues.

### For power users and developers

You can either run this project locally on your computer or in any environment capable of running a Docker container.

If you want to do this or even contribute, please see the [README for developers](README_DEV.md) file.

## License

[![CC BY-NC-SA 4.0][cc-by-nc-sa-image]][cc-by-nc-sa]

This work is licensed under a
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License][cc-by-nc-sa].

[cc-by-nc-sa]: http://creativecommons.org/licenses/by-nc-sa/4.0/
[cc-by-nc-sa-image]: https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png
[cc-by-nc-sa-shield]: https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg
