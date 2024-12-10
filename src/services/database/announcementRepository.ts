import type { Announcement, NewAnnouncement } from "@/types/database";
import { BaseRepository } from "./baseRepository";

export class AnnouncementRepository extends BaseRepository {
  async create(announcement: NewAnnouncement): Promise<number> {
    try {
      const result = await this.db
        .insertInto("announcements")
        .values(announcement)
        .executeTakeFirstOrThrow();
      return this.handleInsertResult(result);
    } catch (error) {
      this.handleError("create announcement", error);
    }
  }

  async getNewAnnouncements(
    lastAnnouncementId: number,
  ): Promise<Announcement[]> {
    try {
      return await this.db
        .selectFrom("announcements")
        .where("id", ">", lastAnnouncementId)
        .selectAll()
        .orderBy("id", "asc")
        .execute();
    } catch (error) {
      this.handleError("get new announcements", error);
    }
  }
}
