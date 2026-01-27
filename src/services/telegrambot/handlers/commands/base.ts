import type { Context } from "grammy";

import { getTelegramChatByChatId } from "@/services/database/telegramChatRepository";
import { logger } from "@/utils/logger";

export function logCall(ctx: Context): void {
  const commandName = ctx.message?.text ? `command "${ctx.message.text}"` : "unknown command";

  logger.verbose(`Received ${commandName} from ${getCallerName(ctx)}.`);
}

export function getCallerName(ctx: Context): string {
  if (ctx.chat?.username) {
    return `@${ctx.chat.username}`;
  }
  if (ctx.chat?.title) {
    return ctx.chat.title;
  }
  return "unknown user";
}

export async function userCanControlBot(ctx: Context): Promise<boolean> {
  if (!ctx.chat) {
    logger.warn("Cannot control bot: Unknown chat.");
    return false;
  }

  if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
    if (!ctx.from) {
      logger.warn(`Cannot control bot: Unknown user in group with id ${ctx.chat.id.toFixed(0)}`);
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
  // Without a chat, we cannot look up the chat in the database
  if (!ctx.chat) {
    return;
  }

  // If the message is a thread, look up the entry for this thread ID
  if (ctx.message !== undefined) {
    const threadId = "message_thread_id" in ctx.message ? ctx.message.message_thread_id : undefined;
    return await getTelegramChatByChatId(ctx.chat.id, threadId);
  }

  // Otherwise, look up the chat by its ID
  return await getTelegramChatByChatId(ctx.chat.id);
}
