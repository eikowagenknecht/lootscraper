# LootScraper

![image](https://github.com/user-attachments/assets/e33cb0f0-d64b-4d11-9f86-5d8db22f9f87)

Never miss a free game again!
LootScraper automatically tracks and notifies you about free games from multiple platforms like Amazon Prime, Epic Games (PC and Mobile), Steam, and more.

## 🎮 Quick Start

Choose your preferred way to get notifications:

- [Telegram bot](#telegram-bot) - Customizable notifications for specific platforms
- [RSS feeds](#rss-feeds) - Subscribe using your favorite RSS reader
- [E-Mail Notifications](#e-mail) - Get offers directly in your inbox
- [Discord Integration](#discord) -  Post offers to your Discord server
- [Web Interface](#web-interface) - Browse all current offers on a clean webpage

## 📱 Supported Platforms

- Amazon Prime (Games & In-game Loot)
- Epic Games (PC & Mobile)
- GOG
- Steam (Games & In-game Loot)
- Humble Bundle
- itch.io
- Apple App Store
- Google Play

## 📋 Detailed Instructions

### Telegram bot

The [Telegram LootScraperBot](https://t.me/LootScraperBot) offers:

- All offers in one chat
- Customizable platform subscriptions
- Group and channel support (including threaded groups)
- Instant notifications

![image](https://github.com/user-attachments/assets/d7b0436b-b3b1-4693-aaa3-be9a477d98e3)

### Telegram channels

There are pre-filtered channels for most platforms:

- Amazon Prime ([games](https://t.me/free_amazon_games_ls) and [ingame loot](https://t.me/free_amazon_loot_ls))
- [Epic Games](https://t.me/free_epic_games_ls)
- [Gog games](https://t.me/free_gog_games_ls)
- [Humble games](https://t.me/free_humble_games_ls)
- [itch.io games](https://t.me/free_itch_games_ls)
- Steam ([games](https://t.me/free_steam_games_ls) and [ingame loot](https://t.me/+ENZ8x3Ec1dwxMThi))
- [Apple iPhone games](https://t.me/+SOF7VjGTGPw1OTAy)
- [Google Android games](https://t.me/+Vma9PScf1uY3M2Uy)

If you miss any, please let me know and I'll add them.

### RSS feeds

Subscribe to individual platform feeds or get all offers in [one feed](https://feed.phenx.de/lootscraper.xml):

- Amazon Prime ([games](https://feed.phenx.de/lootscraper_amazon_game.xml) and [ingame loot](https://feed.phenx.de/lootscraper_amazon_loot.xml))
- [Epic Games](https://feed.phenx.de/lootscraper_epic_game.xml)
- [Epic Mobile Games (Android)](https://feed.phenx.de/lootscraper_epic_game_android.xml)
- [Epic Mobile Games (iOS)](https://feed.phenx.de/lootscraper_epic_game_ios.xml)
- [Gog games](https://feed.phenx.de/lootscraper_gog_game.xml)
- [Humble games](https://feed.phenx.de/lootscraper_humble_game.xml)
- [itch.io games](https://feed.phenx.de/lootscraper_itch_game.xml)
- Steam ([games](https://feed.phenx.de/lootscraper_steam_game.xml) and [ingame loot](https://feed.phenx.de/lootscraper_steam_loot.xml))
- [Apple iPhone games](https://feed.phenx.de/lootscraper_apple_game.xml)
- [Google Android games](https://feed.phenx.de/lootscraper_google_game.xml)

### Web Interface

Want to check a website for new deals once in a while, but not be bothered by push notifications?
Here are the latest offers in a nice and clean HTML page:

- Amazon Prime ([games](https://feed.phenx.de/lootscraper_amazon_game.html) and [ingame loot](https://feed.phenx.de/lootscraper_amazon_loot.html))
- [Epic Games](https://feed.phenx.de/lootscraper_epic_game.html)
- [Epic Mobile Games (Android)](https://feed.phenx.de/lootscraper_epic_game_android.html)
- [Epic Mobile Games (iOS)](https://feed.phenx.de/lootscraper_epic_game_ios.html)
- [Gog games](https://feed.phenx.de/lootscraper_gog_game.html)
- [Humble games](https://feed.phenx.de/lootscraper_humble_game.html)
- [itch.io games](https://feed.phenx.de/lootscraper_itch_game.html)
- Steam ([games](https://feed.phenx.de/lootscraper_steam_game.html) and [ingame loot](https://feed.phenx.de/lootscraper_steam_loot.html))
- [Apple iPhone games](https://feed.phenx.de/lootscraper_apple_game.html)
- [Google Android games](https://feed.phenx.de/lootscraper_google_game.html)

You can also have *all sources* on [one page](https://feed.phenx.de/lootscraper.html).

#### Web Archive

There is also an archive version of the HTML pages.
These contain all offers that have been discovered so far, including expired ones.
Warning: These pages are quite large and may take a while to load.

- Amazon Prime ([games](https://feed.phenx.de/lootscraper_amazon_game_all.html) and [ingame loot](https://feed.phenx.de/lootscraper_amazon_loot_all.html))
- [Epic Games](https://feed.phenx.de/lootscraper_epic_game_all.html)
- [Epic Mobile Games (Android)](https://feed.phenx.de/lootscraper_epic_game_android_all.html)
- [Epic Mobile Games (iOS)](https://feed.phenx.de/lootscraper_epic_game_ios_all.html)
- [Gog games](https://feed.phenx.de/lootscraper_gog_game_all.html)
- [Humble games](https://feed.phenx.de/lootscraper_humble_game_all.html)
- [itch.io games](https://feed.phenx.de/lootscraper_itch_game_all.html)
- Steam ([games](https://feed.phenx.de/lootscraper_steam_game_all.html) and [ingame loot](https://feed.phenx.de/lootscraper_steam_loot_all.html))
- [Apple iPhone games](https://feed.phenx.de/lootscraper_apple_game_all.html)
- [Google Android games](https://feed.phenx.de/lootscraper_google_game_all.html)

You can also have *all sources* on [one page](https://feed.phenx.de/lootscraper_all.html).

### E-Mail

If you want to get the offers by email, you can use free services like [Blogtrottr](https://blogtrottr.com/) or [Feedsub](https://feedsub.com/) to convert from RSS to email.

### Discord

If you want to get the offers in a Discord channel, you can use the free [MonitoRSS](https://monitorss.xyz/) bot to post them there for you.
I suggest the following settings:

- **Feed URL**: Use the RSS feed links above
- **Content**:

    ```md
    **{{title}}**

    {{description}}
    ```

- **Button**: Label: `Claim`, URL: `{{link}}`
- **Embed**: Just select `Image URL` with the `{{extracted::atom:content__#::image1}}` variable

## Automatically Claim Free Games

Now that you get notified about all the free games, you might want to make the process of claiming them even easier.
For this, I created some [userscripts](https://eikowagenknecht.de/posts/userscripts-to-claim-free-games/) that can be used with Tampermonkey / Greasemonkey / Violentmonkey.

## 🚀 Power Users and Developers

You can also run this project yourself.
If you want to do this or even contribute, please see the [README for developers](README_DEV.md) file.

## 📊 Project Stats

- 800+ active Telegram bot users
- 200+ GitHub stars
- ~2M monthly RSS feed hits
- Most popular platform: Epic

[![Star History Chart](https://api.star-history.com/svg?repos=eikowagenknecht/lootscraper&type=Date)](https://star-history.com/#eikowagenknecht/lootscraper&Date)

🎉 This must be the hockey stick curve the VCs are always talking about!

## 📝 Feedback

If you encounter any problems feel free to open an issue here and I'll do my best to help.

I'd also love to hear your feature requests! They are tracked as [GitHub discussions](https://github.com/eikowagenknecht/lootscraper/discussions/categories/feature-requests).

## 🔄 Alternative Projects

Looking for different approaches to tracking free games? Check out these other great projects:

- [free-games-claimer](https://github.com/vogler/free-games-claimer) - Automatically claim free games on Epic, Amazon and GOG
- [epicgames-freegames-node](https://github.com/claabs/epicgames-freegames-node) - A Node.js script to claim free games on Epic

## License

![GitHub License](https://img.shields.io/github/license/eikowagenknecht/lootscraper)
