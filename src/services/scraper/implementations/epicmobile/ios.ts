import { OfferPlatform } from "@/types";
import { EpicMobileSraper } from "./base";

export class EpicMobileIosSraper extends EpicMobileSraper {
  getScraperName(): string {
    return "EpicMobileIos";
  }

  override getPlatform(): OfferPlatform {
    return OfferPlatform.IOS;
  }
}
