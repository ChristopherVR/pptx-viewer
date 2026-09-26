/**
 * The presentation style label a laid-out SmartArt shape element was built
 * from, carried from the layout bridge (`smartart-interpreter-drawing-bridge`)
 * to the drawing-shape conversion (`smartArtElementsToDrawingShapes`) without
 * widening the public `PptxElement` type. Keyed weakly by the element object,
 * so it lives exactly as long as the transient decompose output does.
 *
 * @module smartart-element-style-label
 */

import type { PptxElement } from '../types';

const styleLabels = new WeakMap<PptxElement, string>();

/** Record `label` as the style label `element` was laid out with. */
export function tagSmartArtElementStyleLabel(
	element: PptxElement,
	label: string | undefined,
): PptxElement {
	if (label) {
		styleLabels.set(element, label);
	}
	return element;
}

/** The style label recorded for `element`, if any. */
export function smartArtElementStyleLabel(element: PptxElement): string | undefined {
	return styleLabels.get(element);
}
