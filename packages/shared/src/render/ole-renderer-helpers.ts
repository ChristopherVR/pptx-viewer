/**
 * ole-renderer-helpers.ts - framework-agnostic OLE type-resolution helpers.
 *
 * Resolves an embedded `OlePptxElement` to a narrowed application type and
 * derives the per-type brand colour, human-readable label, accessible label,
 * short badge text, display name, and placeholder box style. Shared by every
 * binding's OLE renderer (React/Vue/Angular) so the branding stays identical.
 *
 * Pure: no framework or DOM dependencies. The JSX/template that paints icons and
 * badges stays in each binding; only the type -> colour/label mapping lives here.
 *
 * @module shared/render/ole-renderer-helpers
 */
import type { OlePptxElement } from 'pptx-viewer-core';

/**
 * Resolved OLE application type, narrowed from the raw `OleObjectType` union.
 *
 * `package` and `unknown` from the core type both collapse to `'unknown'` here
 * so that every branch is guaranteed to have a colour and label.
 */
export type ResolvedOleType = 'excel' | 'word' | 'pdf' | 'visio' | 'mathtype' | 'unknown';

/** Brand colour per OLE application type. */
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

/**
 * Resolve the OLE application type from `oleObjectType`, falling back to a
 * case-insensitive substring match on `oleProgId`.
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

/** Return the brand hex colour for a resolved OLE type. */
export function getOleTypeColor(type: ResolvedOleType): string {
	return TYPE_COLORS[type];
}

/** Return the human-readable label for a resolved OLE type. */
export function getOleTypeLabel(type: ResolvedOleType): string {
	return TYPE_LABELS[type];
}

/**
 * Build the accessible label for an OLE element.
 *
 * - With a `fileName`: `"<TypeLabel>: <fileName>"` (e.g. `"Excel Spreadsheet: budget.xlsx"`).
 * - Otherwise: just the type label (e.g. `"Embedded Object"`).
 */
export function getOleAriaLabel(el: OlePptxElement): string {
	const typeLabel = getOleTypeLabel(resolveOleType(el));
	return el.fileName ? `${typeLabel}: ${el.fileName}` : typeLabel;
}

/**
 * Short uppercase badge text shown over the preview image.
 *
 * Returns `'OLE'` for the unknown type, otherwise the type in upper-case
 * (e.g. `'EXCEL'`, `'PDF'`).
 */
export function getOleBadgeLabel(type: ResolvedOleType): string {
	return type === 'unknown' ? 'OLE' : type.toUpperCase();
}

/**
 * The primary display name shown in the placeholder.
 *
 * Prefers `el.fileName`; falls back to the resolved type label.
 */
export function getOleDisplayName(el: OlePptxElement): string {
	return el.fileName ?? getOleTypeLabel(resolveOleType(el));
}

/**
 * Compute the border + background style for the type-specific placeholder box.
 *
 * Uses the brand colour at 20% opacity for the border and 5% for the fill
 * (the `${color}33` / `${color}0d` hex-alpha trick). Returns a neutral CSS
 * property record; each binding casts it to its framework's style type.
 */
export function getPlaceholderStyle(type: ResolvedOleType): Record<string, string | number> {
	const color = getOleTypeColor(type);
	return {
		border: `2px solid ${color}33`,
		'border-radius': '6px',
		'background-color': `${color}0d`,
	};
}
