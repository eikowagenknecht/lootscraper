# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Install dependencies:**
```bash
pnpm install
playwright install firefox  # Required for browser automation
```

**Development:**
```bash
pnpm run dev          # Run in development mode with debug logging
pnpm run build        # Build for production  
pnpm run start        # Run production build
```

**Testing:**
```bash
pnpm test             # Run unit tests
pnpm test:watch       # Run tests in watch mode
pnpm test:contract    # Run contract tests (integration tests with external APIs)
pnpm test:coverage    # Run tests with coverage report
pnpm test:all         # Run both unit and contract tests
```

**Linting and Type Checking:**
```bash
pnpm run lint         # Full lint (TypeScript check + oxlint + oxfmt)
pnpm run type-check   # TypeScript type checking only
pnpm run check        # Combined lint + type-check
pnpm run format       # Format code with oxfmt
```

**Docker:**
```bash
docker build . -t eikowagenknecht/lootscraper:develop
docker run --volume "${PWD}/data:/data" --name lootscraper eikowagenknecht/lootscraper:develop
```

## Architecture Overview

LootScraper is a TypeScript application that scrapes free game offers from multiple platforms (Steam, Epic Games, GOG, etc.) and provides notifications via Telegram bot, Discord bot, and RSS feeds.

### Core Architecture

**Service-Oriented Design:** The application follows a service-oriented architecture with distinct services initialized through `src/services/orchestrator.ts`:
- `database` - SQLite database with Kysely ORM
- `scraperService` - Orchestrates all platform scrapers
- `telegramBotService` - Handles Telegram bot interactions
- `discordBotService` - Handles Discord bot interactions
- `feedService` - Generates RSS/HTML feeds
- `ftpService` - Uploads feeds to FTP server
- `browserService` - Manages Playwright browser instances
- `gameInfoService` - Enriches game data via IGDB/Steam APIs

**Configuration System:** YAML-based configuration loaded via `src/services/config.ts` with Zod schema validation. Creates default config from `templates/config.default.yaml` on first run.

**Database:** SQLite with migrations in `src/services/database/migrations/`. Repositories handle data access for games, offers, announcements, etc.

### Scraper System

**Base Architecture:** All scrapers extend `src/services/scraper/base/scraper.ts` and implement platform-specific logic.

**Scraper Implementations:** Located in `src/services/scraper/implementations/`:
- Amazon (games + loot)
- Epic Games (web API + mobile stores)  
- Steam (games + loot)
- GOG, Humble Bundle, itch.io
- Apple App Store, Google Play

**Browser Automation:** Uses Playwright for web scraping with configurable browser settings and error handling.

### Telegram Bot

**Framework:** Built with Grammy framework (`grammy` package)
**Structure:** Commands in `src/services/telegrambot/handlers/commands/`, callbacks in `handlers/callbacks/`
**Features:** User subscriptions, platform filtering, admin commands, timezone support

### Discord Bot

**Framework:** Built with discord.js
**Structure:** Commands in `src/services/discordbot/handlers/commands/`, utilities in `utils/`
**Features:** Auto-channel creation per feed combination, rich embeds with game info, slash commands, admin commands

### Data Flow

1. **Scraping:** Scrapers fetch offers → Store in database → Update feeds
2. **Notifications:** New offers trigger Telegram/Discord notifications to subscribers
3. **Feeds:** Generated RSS/HTML feeds uploaded to FTP server
4. **Game Info:** IGDB/Steam APIs enrich game metadata asynchronously

### Key Technologies

- **Runtime:** Node.js 22+ with ESM modules
- **Database:** SQLite with Kysely ORM
- **Web Scraping:** Playwright browser automation
- **Bot Frameworks:** Grammy for Telegram, discord.js for Discord
- **Validation:** Zod schemas throughout
- **Build:** Vite for building and testing
- **Logging:** Winston with file rotation and Telegram transport

### Testing Strategy

- **Unit Tests:** Standard `.test.ts` files  
- **Contract Tests:** `.contract.test.ts` files test external API integrations
- **Test Data:** Centralized in `tests/testData.ts`
- **Setup:** Global test setup in `vitest-setup.ts`

### Important Patterns

**Error Handling:** Custom error types in `src/types/errors.ts` with centralized error handling
**Logging:** Structured logging with different transports (console, file, Telegram)
**Type Safety:** Strict TypeScript configuration with comprehensive Zod schemas
**Path Handling:** Centralized path utilities in `src/utils/path.ts` for data/templates directories