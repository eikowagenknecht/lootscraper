import { getTelegramChatById } from "@/services/database/telegramChatRepository";
import { logger } from "@/utils/logger";
import type { Context } from "grammy";

export function logCall(ctx: Context): void {
  logger.debug(
    `Received command "/${ctx.message?.text ?? "???"}" from ${getCallerName(ctx)}.`,
  );
}

export function getCallerName(ctx: Context): string {
  if (ctx.chat?.title) {
    return ctx.chat.title;
  }
  return ctx.from?.username ?? "unknown user";
}

export async function userCanControlBot(ctx: Context): Promise<boolean> {
  if (!ctx.chat) {
    logger.warning("Cannot control bot: Unknown chat.");
    return false;
  }

  if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
    if (!ctx.from) {
      logger.warning(
        `Cannot control bot: Unknown user in group with id ${ctx.chat.id.toFixed()}`,
      );
      return false;
    }

    const member = await ctx.getChatMember(ctx.from.id);
    return member.status === "creator" || member.status === "administrator";
  }

  if (ctx.chat.type === "channel") {
    // We cannot restrict for channels, so we allow everyone to control the bot
    // Only admins should be able to send commands anyway
    return true;
  }

  // Narrowed down to private chat
  return true;
}

export async function getDbChat(ctx: Context) {
  if (!ctx.chat || ctx.message === undefined) {
    return undefined;
  }

  const threadId =
    "message_thread_id" in ctx.message
      ? ctx.message.message_thread_id
      : undefined;

  return await getTelegramChatById(ctx.chat.id, threadId);
}
