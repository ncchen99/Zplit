import type { ExpenseRepeatType } from "@/store/groupStore";

function normalizeDate(value: Date): Date {
  return new Date(value.getTime());
}

export function getIntervalDays(type: ExpenseRepeatType): number | null {
  switch (type) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "monthly":
      return null;
    case "custom":
      return null;
    default:
      return null;
  }
}

export function getNextRecurringDate(
  baseDate: Date,
  type: ExpenseRepeatType,
): Date {
  const next = normalizeDate(baseDate);
  if (type === "daily") {
    next.setDate(next.getDate() + 1);
    return next;
  }

  if (type === "weekly") {
    next.setDate(next.getDate() + 7);
    return next;
  }

  // Monthly keeps day-of-month behavior from JS Date.
  next.setMonth(next.getMonth() + 1);
  return next;
}

export function isValidRecurringEndDate(
  startDate: Date,
  endDate: Date,
): boolean {
  return endDate.getTime() >= startDate.getTime();
}
