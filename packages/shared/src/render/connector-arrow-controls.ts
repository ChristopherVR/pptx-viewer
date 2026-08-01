/**
 * connector-arrow-controls.ts: the inspector's connector arrowhead controls,
 * described once for every binding.
 *
 * WHY this exists: a connector's arrowheads live on `a:ln/a:headEnd` and
 * `a:ln/a:tailEnd`, each carrying a `type` plus a `w` (width) and `len`
 * (length) step. That is six editable properties, and every binding that
 * offered them had re-declared the option order, the fallback values and the
 * caption keys in its own private table. React, Angular, Svelte and Vanilla had
 * each written their own, and they had already drifted: two bindings offered
 * only the two `type` pickers, and one listed the six arrowhead tokens in a
 * different order. Vue had no arrowhead control at all, so a Vue user could not
 * change a connector's arrowheads by any route.
 *
 * The descriptors below are therefore the single source of truth for WHICH
 * controls the card shows, in WHICH order, over WHICH tokens. A binding renders
 * them; it does not restate them. Captions reuse the already-translated
 * arrowhead / size vocabulary in `schema-label-keys.ts` rather than inventing a
 * parallel one.
 *
 * @module render/connector-arrow-controls
 */
import type { ConnectorArrowType, ShapeStyle } from 'pptx-viewer-core';

import { ARROW_SIZE_LABEL_KEYS, ARROWHEAD_LABEL_KEYS } from './schema-label-keys';

/**
 * The six arrowhead tokens, in the order PowerPoint's own arrow gallery lists
 * them (and the order React's picker has always used). `arrow` is PowerPoint's
 * "Open Arrow"; the spelling comes from `ARROWHEAD_LABEL_KEYS`, never from the
 * raw token.
 */
export const CONNECTOR_ARROW_VALUES: readonly ConnectorArrowType[] = [
	'none',
	'triangle',
	'stealth',
	'diamond',
	'oval',
	'arrow',
];

/** The `a:headEnd/@w` and `@len` steps, smallest first. */
export const CONNECTOR_ARROW_SIZE_VALUES: readonly ConnectorArrowSize[] = ['sm', 'med', 'lg'];

/** An arrowhead width / length step. */
export type ConnectorArrowSize = 'sm' | 'med' | 'lg';

/** The `ShapeStyle` keys the arrowhead card writes. */
export type ConnectorArrowStyleKey =
	| 'connectorStartArrow'
	| 'connectorEndArrow'
	| 'connectorStartArrowWidth'
	| 'connectorStartArrowLength'
	| 'connectorEndArrowWidth'
	| 'connectorEndArrowLength';

/** One dropdown on the connector card. */
export interface ConnectorArrowControl {
	/** The `ShapeStyle` property this dropdown reads and writes. */
	readonly styleKey: ConnectorArrowStyleKey;
	/** i18n key for the dropdown's visible label, which is its accessible name. */
	readonly labelKey: string;
	/** Offered tokens, in display order. */
	readonly values: readonly string[];
	/** Token to i18n key, for spelling each option. */
	readonly optionLabelKeys: Readonly<Record<string, string>>;
	/**
	 * Shown when the style carries nothing. An absent `a:headEnd` means no
	 * arrowhead, while an absent `@w`/`@len` means PowerPoint's default medium.
	 */
	readonly fallback: string;
}

/**
 * The card's controls, in render order: the two head TYPES first (the property
 * users reach for), then each end's width and length.
 */
export const CONNECTOR_ARROW_CONTROLS: readonly ConnectorArrowControl[] = [
	{
		styleKey: 'connectorStartArrow',
		labelKey: 'pptx.connectorArrows.startArrow',
		values: CONNECTOR_ARROW_VALUES,
		optionLabelKeys: ARROWHEAD_LABEL_KEYS,
		fallback: 'none',
	},
	{
		styleKey: 'connectorEndArrow',
		labelKey: 'pptx.connectorArrows.endArrow',
		values: CONNECTOR_ARROW_VALUES,
		optionLabelKeys: ARROWHEAD_LABEL_KEYS,
		fallback: 'none',
	},
	{
		styleKey: 'connectorStartArrowWidth',
		labelKey: 'pptx.connectorArrows.startWidth',
		values: CONNECTOR_ARROW_SIZE_VALUES,
		optionLabelKeys: ARROW_SIZE_LABEL_KEYS,
		fallback: 'med',
	},
	{
		styleKey: 'connectorStartArrowLength',
		labelKey: 'pptx.connectorArrows.startLength',
		values: CONNECTOR_ARROW_SIZE_VALUES,
		optionLabelKeys: ARROW_SIZE_LABEL_KEYS,
		fallback: 'med',
	},
	{
		styleKey: 'connectorEndArrowWidth',
		labelKey: 'pptx.connectorArrows.endWidth',
		values: CONNECTOR_ARROW_SIZE_VALUES,
		optionLabelKeys: ARROW_SIZE_LABEL_KEYS,
		fallback: 'med',
	},
	{
		styleKey: 'connectorEndArrowLength',
		labelKey: 'pptx.connectorArrows.endLength',
		values: CONNECTOR_ARROW_SIZE_VALUES,
		optionLabelKeys: ARROW_SIZE_LABEL_KEYS,
		fallback: 'med',
	},
];

/** Current token for one control, or its fallback when the style is silent. */
export function connectorArrowValue(
	control: ConnectorArrowControl,
	style: ShapeStyle | undefined,
): string {
	const current = style?.[control.styleKey];
	return typeof current === 'string' && current.length > 0 ? current : control.fallback;
}

/**
 * Build the `ShapeStyle` patch for one dropdown change.
 *
 * WHY a helper: the six keys hold two different value unions, so writing
 * `{ [control.styleKey]: raw }` inline forces every binding to widen the value
 * and cast. Narrowing once here keeps the casts out of the view layer, and
 * makes an unknown token a no-op rather than a corrupt `shapeStyle`.
 */
export function connectorArrowPatch(
	control: ConnectorArrowControl,
	raw: string,
): Partial<ShapeStyle> {
	if (!control.values.includes(raw)) {
		return {};
	}
	if (control.styleKey === 'connectorStartArrow' || control.styleKey === 'connectorEndArrow') {
		return { [control.styleKey]: raw as ConnectorArrowType };
	}
	return { [control.styleKey]: raw as ConnectorArrowSize };
}
