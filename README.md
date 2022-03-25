# LootScraper

[![Publish to Docker Hub](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish_docker_hub.yml/badge.svg)](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish_docker_hub.yml)
[![Publish to Github Packages](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish_github_packages.yml/badge.svg)](https://github.com/eikowagenknecht/lootscraper/actions/workflows/publish_github_packages.yml)
[![CC BY-NC-SA 4.0][cc-by-nc-sa-shield]][cc-by-nc-sa]

You enjoy getting games for free but you *don’t* enjoy having to keep track of the various sources (Amazon Prime, Epic Games, Steam, ...) for free offers? Also your F5 key starts to look a bit worn out? Then this is for you!

This Python (3.10+) application uses Selenium to automatically visit sites with free gaming related offers (currently Amazon Prime, Epic Games and Steam are supported, more will follow) and then neatly puts the gathered information into RSS feeds. So now you can track the offers using your favorite news reader like Feedly instead of manually visiting the sites.

## Usage

You can either run this script locally on your computer or in any environment capable of running a Docker container.

Just want the feeds? Sure. You can use the links below. They are updated every 20 minutes and contain offers for Amazon Prime (games and ingame loot), Epic Games (games only) and Steam (games only). Currently the following feeds are available:

- <https://feed.phenx.de/lootscraper.xml>: Everything
- <https://feed.phenx.de/lootscraper_epic_game.xml>: Epic games only
- <https://feed.phenx.de/lootscraper_amazon_game.xml>: Amazon Prime games only
- <https://feed.phenx.de/lootscraper_amazon_loot.xml>: Amazon Prime ingame loot only
- <https://feed.phenx.de/lootscraper_steam_game.xml>: Steam games only

This is what it currently looks like in Feedly:

![image](https://phenx.de/wp-content/uploads/2022/02/image.png)

If you want to get the offers by email instead, you can use free services like <https://blogtrottr.com/> or <https://feedsub.com/>.

## State

This project is still in ongoing development, so expect a few rough edges if you try to run it yourself. If you encounter any problems feel free to open an issue here and I'll try to help.

I have quite a few features on my mind that I'd like to implement. I also plan to extend this to more sources for free offers. All of this is tracked in the Github issues.

### Settings

On the first startup, a default configuration file will be created in `./data/config.ini`. You can edit this file to change the settings (e.g. the sites to visit and the actions to perform).

## Howto

### Run locally

Needs an installed Python 3.10+ environment.

- Download repository
- Create virtual environment (`python -m venv .venv`)
- Activate virtual environment (`./.venv/Scripts/Activate`)
- Install the required packages (`pip install -r requirements.txt`)
- Run (`python ./lootscraper.py`)

### Build and run Docker container

Docker needs to be installed first of course. If you want to skip the build step, you can use <https://hub.docker.com/r/eikowagenknecht/lootscraper> as the image. Use the "main" tag to get the latest build from this repository.

- Download repository
- In terminal go to directory
- First run:
  - Build: `docker build . -t eikowagenknecht/lootscraper:main`
  - Start: `docker run --detach --volume /your/local/path:/data --name lootscraper eikowagenknecht/lootscraper:main`
- Update:
  - Stop: `docker stop lootscraper`
  - Remove: `docker container rm lootscraper`
  - Build without cache: `docker build . --no-cache -t eikowagenknecht/lootscraper:main`
  - Start: `docker run --detach --volume /your/local/path:/data --name lootscraper eikowagenknecht/lootscraper:main`
- Debug: `docker run -it --entrypoint /bin/bash --volume /your/local/path:/data --name lootscraper_debug eikowagenknecht/lootscraper:main`
- To stop, run `docker stop lootscraper`

## License

[![CC BY-NC-SA 4.0][cc-by-nc-sa-image]][cc-by-nc-sa]

This work is licensed under a
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License][cc-by-nc-sa].

[cc-by-nc-sa]: http://creativecommons.org/licenses/by-nc-sa/4.0/
[cc-by-nc-sa-image]: https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png
[cc-by-nc-sa-shield]: https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg
