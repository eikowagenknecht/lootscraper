import type { CommandContext } from "grammy";

import type { BotContext } from "@/services/telegrambot/types/middleware";

import { config } from "@/services/config";
import { clearGames, getOffersWithMissingGameInfo } from "@/services/database/offerRepository";
import { gameInfoService } from "@/services/gameinfo";
import { scraperService } from "@/services/scraper";
import { logger } from "@/utils/logger";

import { logCall } from "..";

export async function handleRefreshInfoCommand(ctx: CommandContext<BotContext>): Promise<void> {
  logCall(ctx);

  if (!ctx.from || ctx.from.id !== config.get().telegram.botOwnerUserId) {
    await ctx.reply("You are not an admin, so you can't use this command.");
    return;
  }

  const cfg = config.get();
  if (!cfg.actions.scrapeInfo) {
    await ctx.reply("Scraping info is not enabled.");
    return;
  }

  if (gameInfoService.isRunning()) {
    await ctx.reply("Game info service is busy.");
    return;
  }

  const force = ctx.message?.text.includes("force") ?? false;

  await ctx.reply("Refreshing game info. This may take a while. I will notify you when I'm done.");

  await scraperService.stop();

  if (force) {
    logger.info("Clearing all game info.");
    await clearGames();
  }

  const offers = await getOffersWithMissingGameInfo();

  for (const [index, offer] of offers.entries()) {
    logger.verbose(
      `Enriching offer ${offer.id.toFixed(0)} (${(index + 1).toFixed(0)} of ${offers.length.toFixed(0)})`,
    );

    if ((index + 1) % 100 === 0) {
      await ctx.reply(`Enriching offer ${(index + 1).toFixed(0)} of ${offers.length.toFixed(0)}.`);
    }

    await gameInfoService.enrichOffer(offer.id);
  }

  await scraperService.start();

  await ctx.reply("Game info refreshed.");
}
