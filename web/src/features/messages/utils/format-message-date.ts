/**
 * Formats date for display using date-fns
 */
import { format, isToday, isYesterday } from 'date-fns';
import { vi } from 'date-fns/locale';

export function formatMessageDate(timestamp: string): string {
  const date = new Date(timestamp);

  if (isToday(date)) {
    return "Hôm nay";
  }

  if (isYesterday(date)) {
    return "Hôm qua";
  }

  // Within last 7 days - show day name
  const daysDiff = Math.floor(
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysDiff < 7) {
    return format(date, "EEEE", { locale: vi });
  }

  // Older - show date
  return format(date, "d MMMM yyyy", { locale: vi });
}
