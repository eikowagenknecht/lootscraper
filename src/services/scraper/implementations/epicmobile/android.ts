import { OfferPlatform } from "@/types";
import { EpicMobileSraper } from "./base";

export class EpicMobileAndroidSraper extends EpicMobileSraper {
  getScraperName(): string {
    return "EpicMobileAndroid";
  }

  override getPlatform(): OfferPlatform {
    return OfferPlatform.ANDROID;
  }
}
