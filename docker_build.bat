docker build . -t eikowagenknecht/lootscraper:latest
docker push eikowagenknecht/lootscraper:latest
rem docker image save -o ./data/lootscraper.tar eikowagenknecht/lootscraper:latest
docker image save -o \\nas\configs\lootscraper\lootscraper.tar eikowagenknecht/lootscraper:latest