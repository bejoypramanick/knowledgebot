import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

export interface TimestampFormatOptions {
  format: 'relative' | 'absolute';
  timezone?: string;
}

/**
 * Get user's timezone
 */
export const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

/**
 * Format timestamp based on time elapsed
 */
export const formatTimestamp = (
  timestamp: string | Date,
  options: TimestampFormatOptions = { format: 'relative' }
): string => {
  const date = typeof timestamp === 'string' ? parseISO(timestamp) : timestamp;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (options.format === 'absolute') {
    if (isToday(date)) {
      return format(date, "Today at h:mm a");
    } else if (isYesterday(date)) {
      return format(date, "Yesterday at h:mm a");
    } else {
      return format(date, "MMM d, yyyy 'at' h:mm a");
    }
  }

  // Relative format
  if (diffInSeconds < 60) {
    return 'Just now';
  }

  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }

  if (isToday(date)) {
    return format(date, "Today at h:mm a");
  }

  if (isYesterday(date)) {
    return format(date, "Yesterday at h:mm a");
  }

  // For older messages, show date and time
  return format(date, "MMM d, yyyy 'at' h:mm a");
};

/**
 * Get full timestamp for tooltip
 */
export const getFullTimestamp = (timestamp: string | Date): string => {
  const date = typeof timestamp === 'string' ? parseISO(timestamp) : timestamp;
  return format(date, "EEEE, MMMM d, yyyy 'at' h:mm:ss a");
};

/**
 * Format timestamp as dd/mm/yyyy hh:mm:ss
 */
export const formatTimestampDDMMYYYY = (timestamp: string | Date): string => {
  const date = typeof timestamp === 'string' ? parseISO(timestamp) : timestamp;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

