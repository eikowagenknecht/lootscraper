export interface OfferMessageOptions {
  tzOffset?: number | null;
  includeDetails?: boolean;
}

export const DATE_FORMATS = {
  READABLE_WITH_HOUR: "MMMM d, yyyy HH:mm",
  SHORT: "MMMM d, yyyy",
} as const;
