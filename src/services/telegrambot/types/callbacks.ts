import { z } from "zod";
import {
  OfferDuration,
  OfferPlatform,
  OfferSource,
  OfferType,
} from "@/types/basic";

export const toggleSubscriptionSchema = z.object({
  action: z.literal("toggle"),
  source: z.enum(OfferSource),
  type: z.enum(OfferType),
  duration: z.enum(OfferDuration),
  platform: z.enum(OfferPlatform),
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
