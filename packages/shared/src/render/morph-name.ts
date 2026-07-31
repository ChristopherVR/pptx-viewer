/**
 * The `!!` morph-name convention, in its own module.
 *
 * Both `morph-matching` (which pairs shapes by this name) and `morph-flatten`
 * (which decomposes a group that CONTAINS such a shape) need it. Leaving it on
 * `morph-matching` made the two import each other, and a cycle that dev ESM
 * tolerates can leave one side undefined at module-init time once the graph is
 * bundled - which took the morph code, and with it presentation mode, down in
 * every production build.
 *
 * @module render/morph-name
 */

import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

/**
 * Extract the morph-matching name from an element.
 *
 * Priority:
 * 1. Element name property from `cNvPr/@name` starting with "!!"
 * 2. Text content starting with "!!" (explicit morph name convention)
 *
 * PowerPoint matches elements across slides when their Selection Pane name
 * (i.e. `cNvPr/@name`) starts with `!!`. Elements with identical `!!`-prefixed
 * names are paired for morph animation regardless of type or position.
 *
 * @param element - The element to extract a morph name from.
 * @returns The morph name string, or undefined if none found.
 */
export function getElementMorphName(element: PptxElement): string | undefined {
	// Check !! naming convention on element name (cNvPr/@name) - primary source
	if (element.name) {
		const name = element.name.trim();
		if (name.startsWith('!!')) {
			return name;
		}
	}
	// Check !! naming convention in text content - fallback
	if (hasTextProperties(element) && element.text) {
		const text = element.text.trim();
		if (text.startsWith('!!')) {
			return text;
		}
	}
	return undefined;
}
