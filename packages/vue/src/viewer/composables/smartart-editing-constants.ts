import type { SmartArtColorScheme, SmartArtLayoutType, SmartArtStyle } from 'pptx-viewer-core';

/**
 * Static option lists and layout-label helper for the SmartArt inspector.
 *
 * Extracted from `useSmartArtEditing` so that composable stays within the
 * per-file line budget. Re-exported from the composable barrel for callers that
 * import them from there.
 *
 * @module smartart-editing-constants
 */

export const SMARTART_COLOR_SCHEMES: readonly SmartArtColorScheme[] = [
	'colorful1',
	'colorful2',
	'colorful3',
	'monochromatic1',
	'monochromatic2',
];

export const SMARTART_STYLE_OPTIONS: readonly SmartArtStyle[] = ['flat', 'moderate', 'intense'];

/** Human labels for switchable layout categories. Falls back to the raw key. */
const SMARTART_LAYOUT_LABEL_MAP: Partial<Record<SmartArtLayoutType, string>> = {
	list: 'List',
	process: 'Process',
	cycle: 'Cycle',
	hierarchy: 'Hierarchy',
	matrix: 'Matrix',
	pyramid: 'Pyramid',
	relationship: 'Relationship',
	venn: 'Venn',
	funnel: 'Funnel',
	target: 'Target',
	gear: 'Gear',
	timeline: 'Timeline',
	chevron: 'Chevron',
	bending: 'Bending',
};

/** Title-case fallback for any layout type without an explicit label. */
export function smartArtLayoutLabel(layout: SmartArtLayoutType): string {
	return SMARTART_LAYOUT_LABEL_MAP[layout] ?? layout.charAt(0).toUpperCase() + layout.slice(1);
}
