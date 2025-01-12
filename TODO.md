# TODO

Temporarily, this file will be used to keep track of the tasks that need to be done.
This will be replaced by GitHub issues again once this is migrated into the main repository.

## Important

- Handle shutdown more gracefully, especially with errors

## Optional

- Add admin Telegram commands:
  - /rescrape ||/fix: drop all game info, then rescrape all games (like the "cleanup" command line argument before). Make sure to pause the scraping process while doing this. See tools.py
- Upload only if the file has changed
- Add auto generated semantic release notes back in
- Look through all logs and sets the level appropriately

## Performance improvements

- Run xvfb in Docker only if needed (see <https://www.npmjs.com/package/xvfb> for an outdated example) (see main.py)
- Manage browser instances
  - Use max 1 browser instance
  - If a scraper is done running, close the browser. Unless another one is scheduled to run in the next minute.
  - maybe browser.borrowContext() which creates the beowser and browser.returnContext() which closes it?
- Spend less database queries after new games have been scraped

## Stats

- Typescript scrape + parse: 10min
- Python scrape + parse: 22min
