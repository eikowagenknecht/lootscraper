export interface ToggleSubscriptionCallbackData {
  action: "toggle";
  source: string;
  type: string;
  duration: string;
}

export interface TimezoneCallbackData {
  action: "settimezone";
  offset: number;
}

export interface OfferCallbackData {
  action: "details";
  command: "show" | "hide";
  offerId: number;
}

export interface DismissCallbackData {
  action: "dismiss";
  offerId: number;
}

export interface CloseCallbackData {
  action: "close";
  menu: "manage" | "timezone";
}

export type CallbackData =
  | ToggleSubscriptionCallbackData
  | TimezoneCallbackData
  | OfferCallbackData
  | DismissCallbackData
  | CloseCallbackData;
