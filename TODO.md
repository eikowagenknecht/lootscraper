# TODO

Temporarily, this file will be used to keep track of the tasks that need to be done.
This will be replaced by GitHub issues again once this is migrated into the main repository.

## Tasks

- [ ] Migrate project into main repository as "ts" branch
- [ ] Run xvfb in Docker only if needed (see <https://www.npmjs.com/package/xvfb>) for an outdated example) (see main.py)
- [ ] Check the rest of the Python files for code that needs to be migrated
- [ ] Simplify the utils/ folder
- [ ] Autogenerate release notes
- [ ] Try to send a Telegram message that is longer than 4096 characters. If it doesn't work, look at Python's chunkstring function.
- [ ] Use luxon DateTime instead of builtin Date objects where possible (e.g. function signatures)
- [ ] Add admin Telegram commands:
  - [ ] /rescrape ||/fix: drop all game info, then rescrape all games (like the "cleanup" command line argument before). Make sure to pause the scraping process while doing this. See tools.py
- [ ] Test what happens with an invalid config file
- [ ] Test if screenshopts folder is created if it doesn't exist
- [ ] Check if the telegram logging sensitivity is working correctly
- [ ] Send new offers to Telegram after they have been scraped (processing.py > send_new_offers_telegram)
- [ ] Try what happens if too many offers are sent to a user in a short time
- [ ] Upload only if the file hast changed
- [ ] Add semantic release notes back in
- [ ] Activate publishing to Docker Hub

## Stats

- Typescript scrape + parse: 10min
- Python scrape + parse: 22min
