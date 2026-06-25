/**
 * format-helpers.ts: framework-agnostic date / timestamp display formatters
 * shared by the React, Vue, and Angular bindings.
 *
 * - `formatIsoDate`: a (possibly absent / invalid) ISO string for the document
 *   properties dialogs. Returns the no-value marker for missing values and
 *   echoes the raw string for unparseable ones.
 * - `formatVersionTimestamp`: an epoch-ms timestamp as a short "Jun 25, 02:14"
 *   style label for the version-history panels.
 * - `formatRelativeTime`: an epoch-ms timestamp as a coarse "5m ago" relative
 *   label.
 *
 * `toLocaleString` is locale-aware (passes `undefined` locale so the host
 * default is used). `Date.now()` is read inside `formatRelativeTime` at call
 * time, never at module eval.
 */

/**
 * No-value marker reused by the properties dialogs. This is the one allowed
 * em-dash: it is functional UI copy that renders for an empty field.
 */
const NO_VALUE = '—';

/**
 * Format a (possibly absent or invalid) ISO timestamp for display. Returns the
 * no-value marker for missing values and echoes the raw string when it cannot
 * be parsed into a date.
 */
export function formatIsoDate(value: string | undefined): string {
	if (!value) {
		return NO_VALUE;
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/**
 * Format an epoch-ms timestamp as a short month / day / time label, e.g.
 * "Jun 25, 02:14", for the version-history panels.
 */
export function formatVersionTimestamp(ts: number): string {
	return new Date(ts).toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

/**
 * Format an epoch-ms timestamp as a coarse relative label ("Just now", "5m
 * ago", "3h ago", "2d ago").
 */
export function formatRelativeTime(ts: number): string {
	const diff = Date.now() - ts;
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) {
		return 'Just now';
	}
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${hours}h ago`;
	}
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
