/**
 * Embedded-OLE action helpers (Vue-local).
 *
 * Core recovers the embedded payload of an `OlePptxElement` on load
 * (`oleEmbeddedData` data-URL, `oleEmbeddedFileName`, `oleEmbeddedMimeType`,
 * `oleEmbeddedByteSize`). These pure helpers turn those fields into the values
 * the OLE renderer needs for a Download / Open action and a richer info caption:
 * a human-readable byte size and a "can the browser open this inline?" predicate.
 *
 * These are intentionally framework-agnostic and small; they are kept local to
 * the Vue binding to avoid concurrent edits to `pptx-viewer-shared`. The shared
 * extraction sweep can dedupe them later.
 */

/**
 * Format a byte count as a short human-readable string (e.g. `1.5 KB`,
 * `2.3 MB`). Returns `undefined` for missing / non-finite / negative input so
 * callers can omit the size caption entirely.
 */
export function formatBytes(bytes: number | undefined): string | undefined {
	if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
		return undefined;
	}
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1024;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	// One decimal place, dropping a trailing ".0" for whole values.
	const rounded = Math.round(value * 10) / 10;
	const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
	return `${text} ${units[unitIndex]}`;
}

/**
 * Whether a MIME type is one a browser can render directly in a new tab
 * (PDF, any image, plain text / common text-ish formats). Used to decide
 * whether to offer an "Open" action alongside "Download". Unknown / binary
 * (e.g. Office documents) types return `false` - they should be downloaded.
 */
export function isBrowserOpenableMime(mime: string | undefined): boolean {
	if (!mime) {
		return false;
	}
	const normalized = mime.trim().toLowerCase();
	if (normalized === 'application/pdf') {
		return true;
	}
	if (normalized.startsWith('image/')) {
		return true;
	}
	if (normalized.startsWith('text/')) {
		return true;
	}
	// A few common browser-renderable application/* text formats.
	return (
		normalized === 'application/json' ||
		normalized === 'application/xml' ||
		normalized === 'application/xhtml+xml'
	);
}
