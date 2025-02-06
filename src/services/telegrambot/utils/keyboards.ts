import {
  dismissSchema,
  offerSchema,
} from "@/services/telegrambot/types/callbacks";
import type { Offer } from "@/types/database";
import type { InlineKeyboardButton, InlineKeyboardMarkup } from "grammy/types";
import { packData } from "./callbackPack";

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
      text: "Claim",
      url: offer.url,
    });
  }

  if (detailsShowButton) {
    buttons.push({
      text: "Details",
      callback_data: packData(
        {
          action: "details",
          command: "show",
          offerId: offer.id,
        },
        offerSchema,
      ),
    });
  }

  if (detailsHideButton) {
    buttons.push({
      text: "Summary",
      callback_data: packData(
        {
          action: "details",
          command: "hide",
          offerId: offer.id,
        },
        offerSchema,
      ),
    });
  }

  if (dismissButton) {
    buttons.push({
      text: "Dismiss",
      callback_data: packData(
        {
          action: "dismiss",
          offerId: offer.id,
        },
        dismissSchema,
      ),
    });
  }

  return { inline_keyboard: buttons.length > 0 ? [buttons] : [] };
}
