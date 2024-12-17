import type { Offer } from "@/types/database";
import type { InlineKeyboardButton, InlineKeyboardMarkup } from "grammy/types";
import { BUTTON_TEXT } from "../types/constants";

export interface CreateOfferKeyboardOptions {
  detailsShowButton?: boolean;
  detailsHideButton?: boolean;
  dismissButton?: boolean;
}

export function createOfferKeyboard(
  offer: Offer,
  options: CreateOfferKeyboardOptions = {},
): InlineKeyboardMarkup {
  const {
    detailsShowButton = false,
    detailsHideButton = false,
    dismissButton = false,
  } = options;
  const buttons: InlineKeyboardButton[] = [];

  if (offer.url) {
    buttons.push({
      text: BUTTON_TEXT.CLAIM,
      url: offer.url,
    });
  }

  if (detailsShowButton) {
    buttons.push({
      text: BUTTON_TEXT.SHOW_DETAILS,
      callback_data: JSON.stringify({
        action: "details",
        command: "show",
        offerId: offer.id,
      }),
    });
  }

  if (detailsHideButton) {
    buttons.push({
      text: BUTTON_TEXT.HIDE_DETAILS,
      callback_data: JSON.stringify({
        action: "details",
        command: "hide",
        offerId: offer.id,
      }),
    });
  }

  if (dismissButton) {
    buttons.push({
      text: BUTTON_TEXT.DISMISS,
      callback_data: JSON.stringify({
        action: "dismiss",
        offerId: offer.id,
      }),
    });
  }

  return { inline_keyboard: buttons.length > 0 ? [buttons] : [] };
}
