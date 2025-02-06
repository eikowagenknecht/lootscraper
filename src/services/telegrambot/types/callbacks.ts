import { OfferDuration, OfferSource, OfferType } from "@/types/basic";
import { z } from "zod";

export const toggleSubscriptionSchema = z.object({
  action: z.literal("toggle"),
  source: z.nativeEnum(OfferSource),
  type: z.nativeEnum(OfferType),
  duration: z.nativeEnum(OfferDuration),
});

export const timezoneSchema = z.object({
  action: z.literal("settimezone"),
  offset: z.number(),
});

export const offerSchema = z.object({
  action: z.literal("details"),
  command: z.enum(["show", "hide"]),
  offerId: z.number(),
});

export const dismissSchema = z.object({
  action: z.literal("dismiss"),
  offerId: z.number(),
});

export const closeSchema = z.object({
  action: z.literal("close"),
  menu: z.enum(["manage", "timezone"]),
});
