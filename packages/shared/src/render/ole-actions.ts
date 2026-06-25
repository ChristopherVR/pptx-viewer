/**
 * ole-actions.ts - framework-agnostic helpers for the OLE download/open UI.
 *
 * Shared by the binding OLE renderers to format the recovered embedded payload
 * size and decide whether its MIME type can be opened directly in a browser tab
 * (vs download-only). Pure functions, no framework or DOM dependencies.
 *
 * @module shared/render/ole-actions
 */

const BYTE_UNITS = ['bytes', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Human-readable binary file size (1024-based), e.g. `1 byte`, `0 bytes`,
 * `12 MB`. Returns `undefined` for missing, negative, or non-finite input so
 * callers can simply omit the size when it is unknown.
 */
export function formatBytes(bytes?: number): string | undefined {
	if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
		return undefined;
	}
	if (bytes === 1) {
		return '1 byte';
	}
	if (bytes < 1024) {
		return `${bytes} bytes`;
	}
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
		value /= 1024;
		unit++;
	}
	// One decimal place, trimming a trailing `.0`.
	const rounded = Math.round(value * 10) / 10;
	const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
	return `${text} ${BYTE_UNITS[unit]}`;
}

/**
 * Whether a payload of the given MIME type can be opened directly in a browser
 * tab (PDF, images, plain text, JSON, XML, XHTML). Everything else is
 * download-only. Matching is case-insensitive and ignores any trailing
 * `; charset=...` (or other `;`-delimited) parameter.
 */
export function isBrowserOpenableMime(mime?: string): boolean {
	if (!mime) {
		return false;
	}
	const value = mime.split(';', 1)[0]?.trim().toLowerCase() ?? '';
	if (value.length === 0) {
		return false;
	}
	if (value.startsWith('image/') || value.startsWith('text/')) {
		return true;
	}
	return (
		value === 'application/pdf' ||
		value === 'application/json' ||
		value === 'application/xml' ||
		value === 'application/xhtml+xml'
	);
}
