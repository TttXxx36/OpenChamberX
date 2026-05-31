export const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

export const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 4,
  minimumFractionDigits: 2,
});

/**
 * Format a number using COMPACT_NUMBER_FORMATTER (e.g. "1.5K", "2.3M").
 * Strips trailing ".0" for cleaner display.
 * Returns the fallback string (default "—") for null/NaN values.
 */
export function formatTokens(
  value?: number | null,
  fallback?: string,
): string {
  const fb = fallback ?? '—';
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fb;
  }
  if (value === 0) {
    return '0';
  }
  const formatted = COMPACT_NUMBER_FORMATTER.format(value);
  return formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
}

/**
 * Format a cost value as USD currency.
 * Returns the fallback string (default "—") for null/NaN/Infinity values.
 */
export function formatCost(
  value?: number | null,
  fallback: string = '—',
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return CURRENCY_FORMATTER.format(value);
}

/**
 * Format a timestamp as a localized time string (e.g. "10:30 AM").
 * Returns '-' for null/falsy timestamps or on parse failure.
 */
export function formatTime(timestamp: number | null): string {
  if (!timestamp) return '-';
  try {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}
