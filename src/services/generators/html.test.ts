import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import { DateTime } from "luxon";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { config } from "@/services/config";
import { databaseService } from "@/services/database";
import { createOffer } from "@/services/database/offerRepository";
import { translationService } from "@/services/translation";
import { OfferDuration, OfferPlatform, OfferSource, OfferType } from "@/types/basic";
import type { NewOffer, Offer } from "@/types/database";
import { getDataPath } from "@/utils/path";
import { generateFilename } from "@/utils/stringTools";

import { HtmlGenerator } from "./html";

beforeAll(async () => {
  await translationService.initialize();
});

let writtenFiles: string[] = [];

beforeEach(async () => {
  config.loadConfig();
  await databaseService.initialize(config.get(), true);
  writtenFiles = [];
});

afterEach(async () => {
  await databaseService.destroy();
  for (const filePath of writtenFiles) {
    rmSync(filePath, { force: true });
  }
});

async function insertOffer(overrides: Partial<Omit<Offer, "id">> = {}): Promise<Offer> {
  const now = DateTime.now().toISO();
  const offerFields: Omit<Offer, "id"> = {
    source: OfferSource.ITCH,
    type: OfferType.GAME,
    duration: OfferDuration.CLAIMABLE,
    platform: OfferPlatform.PC,
    title: "Test Game",
    probable_game_name: "Test Game",
    seen_first: now,
    seen_last: now,
    valid_from: now,
    valid_to: null,
    rawtext: { title: "Test Game" },
    url: "https://example.com/game",
    img_url: null,
    game_id: null,
    category: "VALID",
    ...overrides,
  };

  const newOffer: NewOffer = { ...offerFields, rawtext: JSON.stringify(offerFields.rawtext) };
  const id = await createOffer(newOffer);
  return { ...offerFields, id };
}

async function generateAndRead(offers: Offer[]): Promise<string> {
  const testConfig = config.get();
  await new HtmlGenerator(testConfig).generateHtml(offers);

  const filePath = resolve(
    getDataPath(),
    generateFilename({ prefix: testConfig.common.feedFilePrefix, extension: "html" }),
  );
  writtenFiles.push(filePath);
  return readFileSync(filePath, "utf8");
}

describe("HtmlGenerator", () => {
  test("escapes markup in scraped titles", async () => {
    const offer = await insertOffer({ title: '<img src=x onerror="alert(1)">' });

    const html = await generateAndRead([offer]);

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src&#x3D;x onerror&#x3D;&quot;alert(1)&quot;&gt;");
  });

  test("escapes attribute breakouts in URLs", async () => {
    const offer = await insertOffer({
      url: 'https://example.com/"><script>alert(1)</script>',
      img_url: 'https://example.com/a.png" onerror="alert(1)',
    });

    const html = await generateAndRead([offer]);

    expect(html).not.toContain("<script>");
    expect(html).not.toContain('" onerror="');
  });

  test("drops non-http(s) URLs", async () => {
    const offer = await insertOffer({
      // oxlint-disable-next-line no-script-url
      url: "javascript:alert(1)",
      img_url: "data:text/html,<script>alert(1)</script>",
    });

    const html = await generateAndRead([offer]);

    // oxlint-disable-next-line no-script-url
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text/html");
  });

  test("keeps normal https URLs", async () => {
    const offer = await insertOffer({
      url: "https://itch.io/game?a=1&b=2",
      img_url: "https://img.itch.zone/cover.png",
    });

    const html = await generateAndRead([offer]);

    expect(html).toContain('href="https://itch.io/game?a&#x3D;1&amp;b&#x3D;2"');
    expect(html).toContain('src="https://img.itch.zone/cover.png"');
  });
});
