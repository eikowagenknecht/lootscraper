import { OfferDuration, OfferSource, OfferType } from "@/types/basic";
import { z } from "zod";

export const toggleSubscriptionSchema = z.object({
  action: z.literal("toggle"),
  source: z.nativeEnum(OfferSource),
  type: z.nativeEnum(OfferType),
  duration: z.nativeEnum(OfferDuration),
});

type ToggleSubscriptionCallbackData = z.infer<typeof toggleSubscriptionSchema>;

export const timezoneSchema = z.object({
  action: z.literal("settimezone"),
  offset: z.number(),
});

type TimezoneCallbackData = z.infer<typeof timezoneSchema>;

export const offerSchema = z.object({
  action: z.literal("details"),
  command: z.enum(["show", "hide"]),
  offerId: z.number(),
});

type OfferCallbackData = z.infer<typeof offerSchema>;

export const dismissSchema = z.object({
  action: z.literal("dismiss"),
  offerId: z.number(),
});

type DismissCallbackData = z.infer<typeof dismissSchema>;

export const closeSchema = z.object({
  action: z.literal("close"),
  menu: z.enum(["manage", "timezone"]),
});

type CloseCallbackData = z.infer<typeof closeSchema>;

export type CallbackData =
  | ToggleSubscriptionCallbackData
  | TimezoneCallbackData
  | OfferCallbackData
  | DismissCallbackData
  | CloseCallbackData;
