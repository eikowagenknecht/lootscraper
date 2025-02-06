import { getDb } from "@/services/database";
import type {
  NewScrapingRun,
  ScrapingRun,
  ScrapingRunUpdate,
} from "@/types/database";
import type { UpdateResult } from "kysely";
import { DateTime } from "luxon";
import { handleError, handleInsertResult, handleUpdateResult } from "./common";

export async function getScheduledRuns(
  scraper: string,
): Promise<ScrapingRun[]> {
  try {
    let query = getDb()
      .selectFrom("scraping_runs")
      .where("started_date", "is", null);

    if (scraper) {
      query = query.where("scraper", "=", scraper);
    }

    return await query.selectAll().orderBy("id", "asc").execute();
  } catch (error) {
    handleError("get scheduled scraping runs", error);
  }
}

export async function getNextDueRun(): Promise<ScrapingRun | null> {
  try {
    const nextRun = await getDb()
      .selectFrom("scraping_runs")
      .where("started_date", "is", null)
      .where("scheduled_date", "<=", new Date().toISOString())
      .selectAll()
      .orderBy("id", "asc")
      .limit(1)
      .executeTakeFirst();

    if (!nextRun) {
      return null;
    }

    return nextRun;
  } catch (error) {
    handleError("get next scheduled scraping run", error);
  }
}

export async function updateScrapingRun(
  id: number,
  scrapingRunUpdate: ScrapingRunUpdate,
): Promise<UpdateResult> {
  try {
    const result = await getDb()
      .updateTable("scraping_runs")
      .set(scrapingRunUpdate)
      .where("id", "=", id)
      .executeTakeFirst();
    handleUpdateResult(result);
    return result;
  } catch (error) {
    handleError("update scraping run", error);
  }
}

export async function scheduleRun(run: NewScrapingRun): Promise<number> {
  // Check first if a run is already scheduled for the same scraper.
  // If so, return the ID of the existing run.

  const existingRuns = await getScheduledRuns(run.scraper);

  if (existingRuns.length > 0) {
    const existingRun = existingRuns[0];

    if (existingRun.scheduled_date >= run.scheduled_date) {
      await updateScrapingRun(existingRun.id, {
        scheduled_date: run.scheduled_date,
      });
    }

    // Update the existing run to the new time.
    return existingRun.id;
  }

  // Otherwise, create a new run.
  try {
    const result = await getDb()
      .insertInto("scraping_runs")
      .values(run)
      .executeTakeFirstOrThrow();
    return handleInsertResult(result);
  } catch (error) {
    handleError("create scheduled run", error);
  }
}

export async function removeScheduledRun(id: number): Promise<void> {
  try {
    await getDb().deleteFrom("scraping_runs").where("id", "=", id).execute();
  } catch (error) {
    handleError("remove scheduled run", error);
  }
}

export async function cleanQueue(): Promise<void> {
  try {
    await getDb()
      .deleteFrom("scraping_runs")
      .where("started_date", "is not", null)
      .where("finished_date", "is", null)
      .execute();

    // Also delete all runs that have been finished more than 30 days ago to keep the table size
    await getDb()
      .deleteFrom("scraping_runs")
      .where("finished_date", "<", DateTime.now().minus({ days: 30 }).toISO())
      .execute();
  } catch (error) {
    handleError("clear scraping queue", error);
  }
}
