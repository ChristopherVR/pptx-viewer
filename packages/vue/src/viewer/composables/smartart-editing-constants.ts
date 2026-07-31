import type { SmartArtColorScheme, SmartArtLayoutType, SmartArtStyle } from 'pptx-viewer-core';
import { schemaLabel, SMARTART_LAYOUT_LABEL_KEYS } from 'pptx-viewer-shared';

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

/**
 * Translate a SmartArt layout category for display.
 *
 * WHY the `translate` argument: this used to hold a private English map with a
 * title-case fallback (`layout.charAt(0).toUpperCase() + ...`), so an unmapped
 * type rendered its wire token capitalised and no mapped type could ever be
 * translated. React resolves `pptx.smartart.category.<type>` for the same tiles;
 * routing through the shared `SMARTART_LAYOUT_LABEL_KEYS` catalogue makes the
 * two bindings spell every category identically, in every locale.
 *
 * The layout SET is unchanged: callers still iterate core's
 * `SWITCHABLE_LAYOUT_TYPES`, and an unmapped type still falls back to its raw
 * token rather than being hidden.
 */
export function smartArtLayoutLabel(
	layout: SmartArtLayoutType,
	translate: (key: string) => string,
): string {
	return schemaLabel(SMARTART_LAYOUT_LABEL_KEYS, layout, translate);
}
