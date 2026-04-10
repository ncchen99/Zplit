const TAIPEI_TIMEZONE = "Asia/Taipei";
const TAIPEI_OFFSET_HOURS = 8;

export function getTaipeiDateTimeLocalString(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}`;
}

export function parseTaipeiDateTimeLocalString(value: string): Date {
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) {
    return new Date(value);
  }

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) {
    return new Date(value);
  }

  const utcHour = hour - TAIPEI_OFFSET_HOURS;
  return new Date(Date.UTC(year, month - 1, day, utcHour, minute));
}
