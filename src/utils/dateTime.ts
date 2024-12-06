import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

export function toUTCDate(date: Date | string): Date {
  return dayjs.utc(date).toDate();
}
