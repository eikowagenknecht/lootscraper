import type { BotContext } from "@/services/telegrambot/types/middleware";
import { sendNewOffersToChat } from "@/services/telegrambot/utils/send";
import type { CommandContext } from "grammy";
import { getDbChat, logCall, userCanControlBot } from ".";

export async function handleRefreshCommand(
  ctx: CommandContext<BotContext>,
): Promise<void> {
  logCall(ctx);

  if (!(await userCanControlBot(ctx))) {
    return;
  }
}

export async function refreshOffersForChat(ctx: BotContext): Promise<void> {
  const dbChat = await getDbChat(ctx);
  if (!dbChat) {
    await ctx.reply(
      "You are not registered. Please register with /start command.",
    );
    return;
  }

  await sendNewOffersToChat(dbChat.id, true);
}
