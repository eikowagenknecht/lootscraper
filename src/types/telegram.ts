/**
 * Enum representing different types of chats in Telegram.
 * @enum {string}
 * @readonly
 * @description Contains different types of chats in Telegram
 * @property {string} PRIVATE - Represents a private chat between two users
 * @property {string} GROUP - Represents a group chat
 * @property {string} SUPERGROUP - Represents a supergroup chat
 * @property {string} CHANNEL - Represents a channel chat
 */
export enum ChatType {
  PRIVATE = "PRIVATE",
  GROUP = "GROUP",
  SUPERGROUP = "SUPERGROUP",
  CHANNEL = "CHANNEL",
}
