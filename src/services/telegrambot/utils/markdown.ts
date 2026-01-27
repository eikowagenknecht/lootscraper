/**
 * Escapes characters for Telegram's MarkdownV2.
 *
 * Escaped characters: '_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!', '\'
 *
 * See https://core.telegram.org/bots/api#markdownv2-style
 * @param text The text to escape
 * @returns The escaped text
 */
export function escapeText(text: string): string {
  return text.replaceAll(/[_*[\]()~`>#+-=|{}.!\\]/g, String.raw`\$&`);
}

/**
 * Escape pre and code blocks for Telegram's MarkdownV2.
 *
 * Escaped characters: '`', '\'
 *
 * See https://core.telegram.org/bots/api#markdownv2-style
 * @param text The text to escape
 * @returns The escaped text
 */
export function escapeCode(text: string): string {
  return text.replaceAll(/[`\\]/g, String.raw`\$&`);
}

/**
 * Escape urls for Telegram's MarkdownV2.
 *
 * Escaped characters: ')', '\'
 *
 * See https://core.telegram.org/bots/api#markdownv2-style
 * @param url The url to escape
 * @returns The escaped url
 */
function escapeUrl(url: string): string {
  return url.replaceAll(/[)\\]/g, String.raw`\$&`);
}

export function bold(text: string): string {
  return `*${escapeText(text)}*`;
}

export function italic(text: string): string {
  return `__${escapeText(text)}__`;
}

export function link(url: string, text: string): string {
  return `[${escapeText(text)}](${escapeUrl(url)})`;
}

export function formatJsonForMarkdown(json: unknown): string {
  return `\`\`\`json\n${escapeCode(JSON.stringify(json, null, 2))}\n\`\`\``;
}
