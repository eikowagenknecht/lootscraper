export function escapeMarkdown(text: string): string {
  // Characters that need escaping in Telegram's MarkdownV2:
  // '_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

export function bold(text: string): string {
  return `*${escapeMarkdown(text)}*`;
}

export function url(url: string, text: string): string {
  return `[${escapeMarkdown(text)}](${escapeMarkdown(url)})`;
}

export function formatJsonForMarkdown(json: unknown): string {
  return `\`\`\`json\n${escapeMarkdown(JSON.stringify(json, null, 2))}\n\`\`\``;
}
