import type { CommandContext } from "grammy";
import { config } from "@/services/config";
import { scraperService } from "@/services/scraper";
import { getEnabledScraperNames } from "@/services/scraper/utils";
import type { BotContext } from "@/services/telegrambot/types/middleware";
import { logCall } from "..";

export async function handleScrapeNowCommand(
  ctx: CommandContext<BotContext>,
): Promise<void> {
  logCall(ctx);

  if (!ctx.from || ctx.from.id !== config.get().telegram.botOwnerUserId) {
    await ctx.reply("You are not an admin, so you can't use this command.");
    return;
  }

  const cfg = config.get();
  if (!cfg.actions.scrapeOffers) {
    await ctx.reply("Scraping offers is not enabled.");
    return;
  }

  // Check if a specific scraper was requested
  const args = ctx.message?.text.split(" ").slice(1).join(" ").trim();

  if (args) {
    const queuedName = await scraperService.queueScraperByName(args, true);
    if (queuedName) {
      await scraperService.processQueue();
      await ctx.reply(
        `Scraper "${queuedName}" has been queued for immediate scraping.`,
      );
    } else {
      const enabledNames = getEnabledScraperNames().join(", ");
      await ctx.reply(
        `Unknown scraper "${args}".\n\nAvailable scrapers: ${enabledNames}`,
      );
    }
    return;
  }

  await scraperService.queueEnabledScrapers(true);
  await scraperService.processQueue();

  await ctx.reply(
    "All enabled scrapers have been queued for immediate scraping.",
  );
}
