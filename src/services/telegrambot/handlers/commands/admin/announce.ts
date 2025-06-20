import type { CommandContext } from "grammy";
import { DateTime } from "luxon";
import { config } from "@/services/config";
import { createAnnouncement } from "@/services/database/announcementRepository";
import type { BotContext } from "@/services/telegrambot/types/middleware";
import { bold, escapeText } from "@/services/telegrambot/utils/markdown";
import { logCall } from "..";

export async function handleAnnounceCommand(
  ctx: CommandContext<BotContext>,
): Promise<void> {
  logCall(ctx);

  if (!ctx.from || ctx.from.id !== config.get().telegram.botOwnerUserId) {
    await ctx.reply("You are not an admin, so you can't use this command.");
    return;
  }

  if (!ctx.message?.text) {
    await ctx.reply("Invalid command: No message text provided.");
    return;
  }

  const text = ctx.message.text.replace("/announce ", "").trim();
  const parts = text.split("||");

  if (parts.length !== 2) {
    await ctx.reply(
      "Invalid announcement command. Format needs to be /announce <header> || <text>",
    );
    return;
  }

  const [header, content] = parts.map((p) => p.trim());
  const formattedText = `${bold(header)}\n\n${escapeText(content)}`;

  await createAnnouncement({
    channel: "TELEGRAM",
    date: DateTime.now().toISO(),
    text_markdown: formattedText,
  });

  await ctx.reply(
    "Announcement added successfully. Sending it with the next batch processing run.",
  );
}
