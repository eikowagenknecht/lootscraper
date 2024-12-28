import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { DateTime } from "luxon";

interface CombinerOptions {
  inputFiles: string[];
  outputPath: string;
  projectRoot?: string;
}

interface FileContent {
  path: string;
  content: string;
}

/**
 * Combines multiple source files into a single file with headers
 */
class SourceCombiner {
  private readonly options: Required<CombinerOptions>;

  constructor(options: CombinerOptions) {
    this.options = {
      projectRoot: process.cwd(),
      ...options,
    };
  }

  /**
   * Reads a single file and returns its content with a header
   */
  private async readFileWithHeader(filePath: string): Promise<FileContent> {
    const absolutePath = resolve(this.options.projectRoot, filePath);
    const relativePath = relative(this.options.projectRoot, absolutePath);

    try {
      const content = await readFile(absolutePath, "utf-8");
      return {
        path: relativePath,
        content,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to read file ${relativePath}: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Combines all input files into a single string with headers
   */
  private formatCombinedContent(files: FileContent[]): string {
    const timestamp = DateTime.now().toISO();
    const header = `// Combined source files - Generated at ${timestamp}\n\n`;

    const combinedContent = files
      .map(({ path, content }) => `// File: ${path}\n${content}\n`)
      .join("\n");

    return `${header}${combinedContent}`;
  }

  /**
   * Main method to combine files and write the output
   */
  public async combine(): Promise<void> {
    try {
      const fileContents = await Promise.all(
        this.options.inputFiles.map((file) => this.readFileWithHeader(file)),
      );

      const combinedContent = this.formatCombinedContent(fileContents);

      await writeFile(
        resolve(this.options.projectRoot, this.options.outputPath),
        combinedContent,
        "utf-8",
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to combine files: ${error.message}`);
      }
      throw error;
    }
  }
}

const combiners = [
  new SourceCombiner({
    outputPath: "out/src_all.txt",
    inputFiles: [
      "commitlint.config.ts",
      "src/bot/handlers/callbacks/close.ts",
      "src/bot/handlers/callbacks/offer.ts",
      "src/bot/handlers/callbacks/router.ts",
      "src/bot/handlers/callbacks/timezone.ts",
      "src/bot/handlers/callbacks/toggle.ts",
      "src/bot/handlers/commands/admin/announce.ts",
      "src/bot/handlers/commands/admin/debug.ts",
      "src/bot/handlers/commands/admin/error.ts",
      "src/bot/handlers/commands/admin/index.ts",
      "src/bot/handlers/commands/base.ts",
      "src/bot/handlers/commands/help.ts",
      "src/bot/handlers/commands/index.ts",
      "src/bot/handlers/commands/leave.ts",
      "src/bot/handlers/commands/manage.ts",
      "src/bot/handlers/commands/refresh.ts",
      "src/bot/handlers/commands/start.ts",
      "src/bot/handlers/commands/status.ts",
      "src/bot/handlers/commands/timezone.ts",
      "src/bot/index.ts",
      "src/bot/service.ts",
      "src/bot/types/callbacks.ts",
      "src/bot/types/config.ts",
      "src/bot/types/formatters.ts",
      "src/bot/types/keyboards.ts",
      "src/bot/types/middleware.ts",
      "src/bot/utils/callbackPack.ts",
      "src/bot/utils/formatters.ts",
      "src/bot/utils/keyboards.ts",
      "src/bot/utils/markdown.ts",
      "src/database/migrations.ts",
      "src/database/migrations/001-initial.ts",
      "src/database/migrations/002-alembic.ts",
      "src/database/migrations/003-indices.ts",
      "src/database/migrations/004-nullability.ts",
      "src/database/migrations/005-strict.ts",
      "src/database/migrations/006-dateformat.ts",
      "src/main.ts",
      "src/scrapers/base/scraper.ts",
      "src/scrapers/implementations/amazon/base.ts",
      "src/scrapers/implementations/amazon/games.ts",
      "src/scrapers/implementations/amazon/loot.ts",
      "src/scrapers/implementations/apple.ts",
      "src/scrapers/implementations/epic.ts",
      "src/scrapers/implementations/gog/alwaysfree.ts",
      "src/scrapers/implementations/gog/base.ts",
      "src/scrapers/implementations/gog/games.ts",
      "src/scrapers/implementations/google.ts",
      "src/scrapers/implementations/humble.ts",
      "src/scrapers/implementations/index.ts",
      "src/scrapers/implementations/itch.ts",
      "src/scrapers/implementations/steam/base.ts",
      "src/scrapers/implementations/steam/games.ts",
      "src/scrapers/implementations/steam/loot.ts",
      "src/scrapers/implementations/ubisoft.ts",
      "src/scrapers/index.ts",
      "src/scrapers/utils.ts",
      "src/services/announcement.ts",
      "src/services/browser.ts",
      "src/services/config.ts",
      "src/services/database.ts",
      "src/services/database/announcementRepository.ts",
      "src/services/database/common.ts",
      "src/services/database/gameRepository.ts",
      "src/services/database/igdbInfoRepository.ts",
      "src/services/database/offerRepository.ts",
      "src/services/database/steamInfoRepository.ts",
      "src/services/database/telegramChatRepository.ts",
      "src/services/database/telegramSubscriptionRepository.ts",
      "src/services/feed.ts",
      "src/services/ftp.ts",
      "src/services/gameinfo.ts",
      "src/services/gameinfo/igdb/igdb.ts",
      "src/services/gameinfo/steam/steam.ts",
      "src/services/generators/html.ts",
      "src/services/generators/rss.ts",
      "src/services/orchestrator.ts",
      "src/types/basic.ts",
      "src/types/config.ts",
      "src/types/database.ts",
      "src/types/errors.ts",
      "src/types/index.ts",
      "src/utils/atom.ts",
      "src/utils/dateCalculator.ts",
      "src/utils/errorHandler.ts",
      "src/utils/index.ts",
      "src/utils/logger.ts",
      "src/utils/names.ts",
      "src/utils/path.ts",
      "src/utils/stringTools.ts",
      "src/utils/titleCleaner.ts",
      "src/utils/translations.ts",
      "tools/codeDump.ts",
      "tools/codeList.ts",
      "vite.config.ts",
      "vitest-setup.ts",
    ],
    projectRoot: process.cwd(),
  }),
  new SourceCombiner({
    outputPath: "out/src_main.txt",
    inputFiles: [
      "src/main.ts",
      "src/types/basic.ts",
      "src/types/config.ts",
      "src/types/database.ts",
      "src/types/errors.ts",
      "src/types/index.ts",
      "src/utils/atom.ts",
      "src/utils/dateCalculator.ts",
      "src/utils/errorHandler.ts",
      "src/utils/index.ts",
      "src/utils/logger.ts",
      "src/utils/names.ts",
      "src/utils/path.ts",
      "src/utils/stringTools.ts",
      "src/utils/titleCleaner.ts",
      "src/utils/translations.ts",
      "package.json",
      "tsconfig.json",
      "vite.config.ts",
      "vitest-setup.ts",
      "eslint.config.js",
    ],
    projectRoot: process.cwd(),
  }),
  new SourceCombiner({
    outputPath: "out/src_database.txt",
    inputFiles: [
      "src/database/migrations.ts",
      "src/database/migrations/001-initial.ts",
      "src/database/migrations/002-alembic.ts",
      "src/database/migrations/003-indices.ts",
      "src/database/migrations/004-nullability.ts",
      "src/database/migrations/005-strict.ts",
      "src/services/database.ts",
      "src/services/database/announcementRepository.test.ts",
      "src/services/database/announcementRepository.ts",
      "src/services/database/common.ts",
      "src/services/database/gameRepository.test.ts",
      "src/services/database/gameRepository.ts",
      "src/services/database/igdbInfoRepository.test.ts",
      "src/services/database/igdbInfoRepository.ts",
      "src/services/database/offerRepository.test.ts",
      "src/services/database/offerRepository.ts",
      "src/services/database/steamInfoRepository.test.ts",
      "src/services/database/steamInfoRepository.ts",
      "src/services/database/telegramChatRepository.ts",
      "src/services/database/telegramSubscriptionRepository.ts",
    ],
    projectRoot: process.cwd(),
  }),
  new SourceCombiner({
    outputPath: "out/src_scrapers.txt",
    inputFiles: [
      "src/scrapers/base/scraper.ts",
      "src/scrapers/implementations/amazon/base.ts",
      "src/scrapers/implementations/amazon/games.ts",
      "src/scrapers/implementations/amazon/loot.ts",
      "src/scrapers/implementations/apple.ts",
      "src/scrapers/implementations/epic.ts",
      "src/scrapers/implementations/gog/alwaysfree.ts",
      "src/scrapers/implementations/gog/base.ts",
      "src/scrapers/implementations/gog/games.ts",
      "src/scrapers/implementations/google.ts",
      "src/scrapers/implementations/humble.ts",
      "src/scrapers/implementations/index.ts",
      "src/scrapers/implementations/itch.ts",
      "src/scrapers/implementations/steam/base.ts",
      "src/scrapers/implementations/steam/games.ts",
      "src/scrapers/implementations/steam/loot.ts",
      "src/scrapers/implementations/ubisoft.ts",
      "src/scrapers/index.ts",
      "src/scrapers/utils.ts",
    ],
    projectRoot: process.cwd(),
  }),
  new SourceCombiner({
    outputPath: "out/src_bot.txt",
    inputFiles: [
      "src/bot/handlers/callbacks/close.ts",
      "src/bot/handlers/callbacks/offer.ts",
      "src/bot/handlers/callbacks/router.ts",
      "src/bot/handlers/callbacks/timezone.ts",
      "src/bot/handlers/callbacks/toggle.ts",
      "src/bot/handlers/commands/admin/announce.ts",
      "src/bot/handlers/commands/admin/debug.ts",
      "src/bot/handlers/commands/admin/error.ts",
      "src/bot/handlers/commands/admin/index.ts",
      "src/bot/handlers/commands/base.ts",
      "src/bot/handlers/commands/help.ts",
      "src/bot/handlers/commands/index.ts",
      "src/bot/handlers/commands/leave.ts",
      "src/bot/handlers/commands/manage.ts",
      "src/bot/handlers/commands/refresh.ts",
      "src/bot/handlers/commands/start.ts",
      "src/bot/handlers/commands/status.ts",
      "src/bot/handlers/commands/timezone.ts",
      "src/bot/index.ts",
      "src/bot/service.ts",
      "src/bot/types/callbacks.ts",
      "src/bot/types/config.ts",
      "src/bot/types/formatters.ts",
      "src/bot/types/keyboards.ts",
      "src/bot/types/middleware.ts",
      "src/bot/utils/callbackPack.ts",
      "src/bot/utils/formatters.ts",
      "src/bot/utils/keyboards.ts",
      "src/bot/utils/markdown.ts",
    ],
    projectRoot: process.cwd(),
  }),
  new SourceCombiner({
    outputPath: "out/src_services.txt",
    inputFiles: [
      "src/services/announcement.ts",
      "src/services/browser.ts",
      "src/services/config.ts",
      "src/services/feed.ts",
      "src/services/ftp.ts",
      "src/services/gameinfo.ts",
      "src/services/gameinfo/igdb/igdb.ts",
      "src/services/gameinfo/steam/steam.ts",
      "src/services/generators/html.ts",
      "src/services/generators/rss.ts",
      "src/services/orchestrator.ts",
    ],
    projectRoot: process.cwd(),
  }),
];

for (const combiner of combiners) await combiner.combine();
