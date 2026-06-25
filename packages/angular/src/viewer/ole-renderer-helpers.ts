/**
 * Pure, framework-agnostic helpers for OLE renderer.
 *
 * Ported from:
 *   - packages/react/src/viewer/components/elements/InkGroupRenderers.tsx
 *     (resolveOleType, getOleTypeColor, getOleTypeLabel, getOleAriaLabel)
 *   - packages/vue/src/viewer/components/OleRenderer.vue
 *     (placeholder style, badge label, display name)
 *
 * All functions are pure (no Angular dependencies) so they can be unit-tested
 * with plain vitest without TestBed or the Angular compiler.
 */
import type { OlePptxElement } from 'pptx-viewer-core';

import type { StyleMap } from './element-style';

// ==========================================================================
// Resolved OLE application type
// ==========================================================================

/**
 * Resolved OLE application type, narrowed from the raw `OleObjectType` union.
 *
 * `package` and `unknown` from the core type both collapse to `'unknown'` here
 * so that every branch is guaranteed to have a colour and label.
 */
export type ResolvedOleType = 'excel' | 'word' | 'pdf' | 'visio' | 'mathtype' | 'unknown';

// ==========================================================================
// Type resolution
// ==========================================================================

/**
 * Resolve the OLE application type from `oleObjectType`, falling back to a
 * case-insensitive substring match on `oleProgId`.
 *
 * Mirrors `resolveOleType` in InkGroupRenderers.tsx and the Vue `oleType`
 * computed property.
 */
export function resolveOleType(el: OlePptxElement): ResolvedOleType {
	const type = el.oleObjectType;
	if (type && type !== 'package' && type !== 'unknown') {
		// All non-fallback discriminants map directly.
		return type as ResolvedOleType;
	}
	const progId = el.oleProgId?.toLowerCase() ?? '';
	if (progId.includes('excel')) {
		return 'excel';
	}
	if (progId.includes('word')) {
		return 'word';
	}
	if (progId.includes('acroexch') || progId.includes('acrobat') || progId.includes('pdf')) {
		return 'pdf';
	}
	if (progId.includes('visio')) {
		return 'visio';
	}
	if (progId.includes('equation') || progId.includes('mathtype')) {
		return 'mathtype';
	}
	return 'unknown';
}

// ==========================================================================
// Type → colour / label
// ==========================================================================

/** Brand colour per OLE application type, mirroring the React and Vue ports. */
const TYPE_COLORS: Record<ResolvedOleType, string> = {
	excel: '#217346',
	word: '#2B579A',
	pdf: '#D4272E',
	visio: '#3955A3',
	mathtype: '#7B2D8E',
	unknown: '#666666',
};

/** Human-readable label per OLE application type. */
const TYPE_LABELS: Record<ResolvedOleType, string> = {
	excel: 'Excel Spreadsheet',
	word: 'Word Document',
	pdf: 'PDF Document',
	visio: 'Visio Diagram',
	mathtype: 'Math Equation',
	unknown: 'Embedded Object',
};

/** Return the brand hex colour for a resolved OLE type. */
export function getOleTypeColor(type: ResolvedOleType): string {
	return TYPE_COLORS[type];
}

/** Return the human-readable label for a resolved OLE type. */
export function getOleTypeLabel(type: ResolvedOleType): string {
	return TYPE_LABELS[type];
}

// ==========================================================================
// Aria label
// ==========================================================================

/**
 * Build the accessible label for an OLE element.
 *
 * - If `fileName` is present: `"<TypeLabel>: <fileName>"` (e.g. `"Excel Spreadsheet: budget.xlsx"`)
 * - Otherwise: just the type label (e.g. `"Embedded Object"`)
 */
export function getOleAriaLabel(el: OlePptxElement): string {
	const oleType = resolveOleType(el);
	const typeLabel = getOleTypeLabel(oleType);
	return el.fileName ? `${typeLabel}: ${el.fileName}` : typeLabel;
}

// ==========================================================================
// Badge label
// ==========================================================================

/**
 * Short uppercase badge text shown over the preview image.
 *
 * Returns `'OLE'` for the unknown type, otherwise the type in upper-case
 * (e.g. `'EXCEL'`, `'PDF'`).
 */
export function getOleBadgeLabel(type: ResolvedOleType): string {
	return type === 'unknown' ? 'OLE' : type.toUpperCase();
}

// ==========================================================================
// Display name (file name or type label fallback)
// ==========================================================================

/**
 * The primary display name shown in the placeholder.
 *
 * Prefers `el.fileName`; falls back to the resolved type label.
 */
export function getOleDisplayName(el: OlePptxElement): string {
	const typeLabel = getOleTypeLabel(resolveOleType(el));
	return el.fileName ?? typeLabel;
}

// ==========================================================================
// Placeholder style
// ==========================================================================

/**
 * Compute the border + background style for the type-specific placeholder box.
 *
 * Uses the brand colour at 20% opacity for the border and 5% for the fill,
 * matching the Vue port's `${color}33` / `${color}0d` hex-alpha trick.
 */
export function getPlaceholderStyle(type: ResolvedOleType): StyleMap {
	const color = getOleTypeColor(type);
	return {
		border: `2px solid ${color}33`,
		'border-radius': '6px',
		'background-color': `${color}0d`,
	};
}

// ==========================================================================
// Embedded-payload size + MIME helpers
// ==========================================================================

/**
 * Format a byte count as a short human-readable string (e.g. `"1.5 KB"`,
 * `"2.3 MB"`) using binary (1024) units. Returns `undefined` for missing,
 * non-finite, or negative input so callers can omit the size row entirely.
 *
 * Kept local to the Angular binding for now: the equivalent shared helper is
 * being churned by a parallel session, so this avoids a flaky cross-package
 * dependency. Extract to `pptx-viewer-shared` once that settles.
 */
export function formatBytes(bytes: number | undefined): string | undefined {
	if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
		return undefined;
	}
	if (bytes < 1024) {
		return bytes === 1 ? '1 byte' : `${Math.round(bytes)} bytes`;
	}
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1024;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	const rounded = Math.round(value * 10) / 10;
	const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
	return `${text} ${units[unitIndex]}`;
}

/**
 * Whether a payload of the given MIME type can be opened (previewed) inline in
 * a new browser tab rather than only downloaded. PDFs, plain text / HTML / CSV /
 * JSON, and any `image/*` or `text/*` type qualify; binary office formats do
 * not. Matching is case-insensitive and ignores any `; charset=...` parameter.
 */
export function isBrowserOpenableMime(mimeType: string | undefined): boolean {
	if (!mimeType) {
		return false;
	}
	const normalized = mimeType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
	if (normalized.length === 0) {
		return false;
	}
	if (normalized.startsWith('image/') || normalized.startsWith('text/')) {
		return true;
	}
	return (
		normalized === 'application/pdf' ||
		normalized === 'application/json' ||
		normalized === 'application/xml' ||
		normalized === 'application/xhtml+xml'
	);
}

// ==========================================================================
// Embedded-payload actions (Download / Open) + richer info
// ==========================================================================

/**
 * Resolve the file name to use for the download anchor's `download` attribute:
 * the recovered embedded name, then the authored file name, then a generic
 * fallback so the saved file is never nameless.
 */
export function getOleDownloadFileName(el: OlePptxElement): string {
	return el.oleEmbeddedFileName ?? el.fileName ?? 'embedded-object';
}

/** A single descriptive info row for the OLE caption / overlay. */
export interface OleInfoRow {
	/** Stable key for `@for` tracking (e.g. `'type'`, `'file'`). */
	key: string;
	/** Display label (e.g. `'Application'`). */
	label: string;
	/** Display value (e.g. `'Excel.Sheet.12'`). */
	value: string;
}

/**
 * Build the descriptive info rows shown in the OLE caption.
 *
 * Rows: object type label, original file name (`oleEmbeddedFileName ?? fileName`),
 * human-readable size (`oleEmbeddedByteSize`), and application (`oleProgId`).
 * A row is omitted when its value is unknown, so the result may contain only
 * the always-present type row.
 */
export function buildOleInfoRows(el: OlePptxElement): OleInfoRow[] {
	const rows: OleInfoRow[] = [
		{ key: 'type', label: 'Type', value: getOleTypeLabel(resolveOleType(el)) },
	];
	const fileName = el.oleEmbeddedFileName ?? el.fileName;
	if (fileName) {
		rows.push({ key: 'file', label: 'File', value: fileName });
	}
	const sizeLabel = formatBytes(el.oleEmbeddedByteSize);
	if (sizeLabel) {
		rows.push({ key: 'size', label: 'Size', value: sizeLabel });
	}
	if (el.oleProgId) {
		rows.push({ key: 'application', label: 'Application', value: el.oleProgId });
	}
	return rows;
}

/**
 * Presentational action model for an OLE element's embedded payload, derived
 * purely from the core-recovered fields. The binding wires the actual
 * `<a download>` / new-tab open; this only decides what is offered and with
 * what attributes.
 */
export interface OleActionModel {
	/** True when an embedded payload data-URL is available to download. */
	canDownload: boolean;
	/** True when the payload can additionally be opened in a browser tab. */
	canOpen: boolean;
	/** Data-URL for the download anchor `href`, when available. */
	downloadHref: string | undefined;
	/** Suggested file name for the download anchor `download` attribute. */
	downloadFileName: string;
	/** Human-readable size, when known (e.g. `"2.3 MB"`). */
	sizeLabel: string | undefined;
	/** Descriptive info rows (type / file / size / application). */
	info: OleInfoRow[];
}

/**
 * Build the full action model for an OLE element. Download is offered whenever a
 * non-empty embedded data-URL exists; Open is additionally offered when the
 * payload's MIME type is one a browser can render inline (PDF / image / text).
 */
export function buildOleActionModel(el: OlePptxElement): OleActionModel {
	const downloadHref = el.oleEmbeddedData;
	const canDownload = typeof downloadHref === 'string' && downloadHref.length > 0;
	const canOpen = canDownload && isBrowserOpenableMime(el.oleEmbeddedMimeType);
	return {
		canDownload,
		canOpen,
		downloadHref,
		downloadFileName: getOleDownloadFileName(el),
		sizeLabel: formatBytes(el.oleEmbeddedByteSize),
		info: buildOleInfoRows(el),
	};
}
