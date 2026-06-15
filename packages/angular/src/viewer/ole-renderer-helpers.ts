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
