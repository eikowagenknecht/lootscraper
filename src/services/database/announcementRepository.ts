import type { Announcement, NewAnnouncement } from "@/types/database";
import { getDb } from "../database";
import { handleError, handleInsertResult } from "./common";

export async function createAnnouncement(
  announcement: NewAnnouncement,
): Promise<number> {
  try {
    const result = await getDb()
      .insertInto("announcements")
      .values(announcement)
      .executeTakeFirstOrThrow();
    return handleInsertResult(result);
  } catch (error) {
    handleError("create announcement", error);
  }
}

export async function getNewAnnouncements(
  lastAnnouncementId: number,
): Promise<Announcement[]> {
  try {
    return await getDb()
      .selectFrom("announcements")
      .where("id", ">", lastAnnouncementId)
      .selectAll()
      .orderBy("id", "asc")
      .execute();
  } catch (error) {
    handleError("get new announcements", error);
  }
}
