# TODO

Temporarily, this file will be used to keep track of the tasks that need to be done.
This will be replaced by GitHub issues again once this is migrated into the main repository.

## Tasks

- [ ] Run xvfb in Docker only if needed (see <https://www.npmjs.com/package/xvfb> for an outdated example) (see main.py)
- [ ] Add admin Telegram commands:
  - [ ] /rescrape ||/fix: drop all game info, then rescrape all games (like the "cleanup" command line argument before). Make sure to pause the scraping process while doing this. See tools.py
- [ ] Check if the telegram logging sensitivity is working correctly
- [ ] Send new offers to Telegram after they have been scraped (processing.py > send_new_offers_telegram)
- [ ] Try what happens if too many offers are sent to a user in a short time
- [ ] Upload only if the file has changed
- [ ] Add auto generated semantic release notes back in

## Stats

- Typescript scrape + parse: 10min
- Python scrape + parse: 22min
