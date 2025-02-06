# TODO

Temporarily, this file will be used to keep track of the tasks that need to be done.
This will be replaced by GitHub issues again once this is migrated into the main repository.

## Important

- Handle shutdown more gracefully, especially with errors

## Optional

- Add admin Telegram commands:
  - /rescrape ||/fix: drop all game info, then rescrape all games (like the "cleanup" command line argument before). Make sure to pause the scraping process while doing this. See tools.py
- Upload RSS feeds and generated HTML pages only if they have changed
  - Use a hash of the content to compare
  - Store the last hash in the database
- Add auto generated semantic release notes back in
- Look through all logs and set the level appropriately

## Performance improvements

- Run xvfb in Docker only if needed (see <https://www.npmjs.com/package/xvfb> for an outdated example) (see main.py)
- Spend less database queries after new games have been scraped

## Stats

- Typescript scrape + parse: 10min
- Python scrape + parse: 22min
