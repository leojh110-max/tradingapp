export function utcDateTimeToMillis(date: string, time: string): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date.trim());
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(time.trim());
  if (!dateMatch || !timeMatch) {
    return null;
  }
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? "0");
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

export function millisToUtcParts(openTime: number): { date: string; time: string } {
  const date = new Date(openTime);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

export function dateRangeError(
  timestamp: number,
  firstOpenTime: number | null,
  lastOpenTime: number | null,
  intervalMs = 0,
): string | null {
  if (firstOpenTime === null || lastOpenTime === null) {
    return "Date is outside the available market data range.";
  }
  const max = lastOpenTime + Math.max(0, intervalMs - 1);
  if (timestamp < firstOpenTime || timestamp > max) {
    return "Date is outside the available market data range.";
  }
  return null;
}

export function formatUtcRange(firstOpenTime: number, lastOpenTime: number): string {
  const first = millisToUtcParts(firstOpenTime);
  const last = millisToUtcParts(lastOpenTime);
  return `${first.date} ${first.time} UTC → ${last.date} ${last.time} UTC`;
}
