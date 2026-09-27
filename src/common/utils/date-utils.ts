export function normalizeDate(date: any): Date | null {
  if (!date) return null;
  const d = new Date(date);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export function toStartOfDay(dateStr: string): Date {
  const date = new Date(dateStr);
  return new Date(date.setHours(0, 0, 0, 0));
}

export function toEndOfDay(dateStr: string): Date {
  const date = new Date(dateStr);
  return new Date(date.setHours(23, 59, 59, 999));
}

export function toUTCMidnight(dateStr: string): Date {
  if (dateStr.includes('T')) {
    return new Date(dateStr.split('T')[0] + 'T00:00:00Z');
  }
  return new Date(dateStr + 'T00:00:00Z');
}
