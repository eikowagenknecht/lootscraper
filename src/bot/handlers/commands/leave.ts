import type { BotContext } from "@/bot/types/middleware";
import { deleteTelegramChat } from "@/services/database/telegramChatRepository";
import type { CommandContext } from "grammy";
import { getCallerName, getDbChat, logCall, userCanControlBot } from ".";

export async function handleLeaveCommand(
  ctx: CommandContext<BotContext>,
): Promise<void> {
  logCall(ctx);

  if (!(await userCanControlBot(ctx))) {
    return;
  }

  const dbChat = await getDbChat(ctx);
  if (!dbChat) {
    const message = `Hi ${getCallerName(ctx)}, you are currently not registered. So you can't leave ;-)`;
    await ctx.reply(message);
    return;
  }

  // Delete chat and all related data
  // TODO: Delete related data
  await deleteTelegramChat(dbChat.id);

  const message = `Bye ${getCallerName(ctx)}, I'm sad to see you go. The data stored for this chat has been deleted. If you want to come back at any time, just type /start!`;
  await ctx.reply(message);
}
