/**
 * Prompt text and inherited text defaults for the empty placeholders a layout
 * switch fabricates.
 *
 * `createEmptyPlaceholderElement` builds a bare text element carrying only a
 * `p:ph` binding. Rendered as-is it is invisible: the shared placeholder
 * prompt (`placeholderPromptDescriptor`) draws "Click to add title" only when
 * the element carries `promptText`, and nothing else paints an empty box. A
 * slide that had just been switched to "Title and Content" therefore looked
 * like it had no text areas at all, while a freshly loaded slide on the same
 * layout showed its prompts (the parser resolves them for parsed shapes).
 *
 * This module fills that gap after the slide's relationships point at the new
 * layout, using the same layout-then-master placeholder defaults the parser
 * consults, so the fabricated box matches a parsed one: prompt text, the
 * element's placeholder type, and the level-1 font / size / colour the layout
 * authors for that slot.
 *
 * @module layout-switch-placeholder-prompts
 */

import type { PlaceholderDefaults, PptxElement, PptxElementWithText, TextStyle } from '../../types';
import { hasTextProperties } from '../../types';

/** Runtime hooks the enrichment needs; passed in so this stays a pure module. */
export interface PlaceholderPromptResolver {
	/** Merged layout/master defaults for the element's `p:ph`, if any. */
	resolveDefaults: (element: PptxElement) => PlaceholderDefaults | undefined;
	/** The element's `p:ph/@type` (lower-cased), if it is a placeholder. */
	placeholderType: (element: PptxElement) => string | undefined;
	/** Copy the body-level defaults (insets, anchor, autofit) onto a style. */
	applyBodyDefaults: (textStyle: TextStyle, defaults: PlaceholderDefaults) => void;
	/** Copy the level-1 run defaults (font, size, colour, ...) onto a style. */
	applyLevelDefaults: (
		textStyle: TextStyle,
		levelStyle: NonNullable<PlaceholderDefaults['levelStyles']>[number],
	) => void;
}

/** True for a text element that carries no authored characters. */
export function isEmptyTextElement(element: PptxElement): element is PptxElementWithText {
	if (element.type !== 'text' || !hasTextProperties(element)) {
		return false;
	}
	if (element.text && element.text.trim().length > 0) {
		return false;
	}
	return !element.textSegments?.some((segment) => segment.text.trim().length > 0);
}

/**
 * Give every empty placeholder text element in `elements` the prompt text and
 * inherited text defaults of its layout slot. Elements that already carry a
 * prompt, have content, or are not placeholders are returned untouched; the
 * input array is never mutated.
 */
export function enrichEmptyPlaceholderPrompts(
	elements: readonly PptxElement[],
	resolver: PlaceholderPromptResolver,
): PptxElement[] {
	return elements.map((element) => {
		if (!isEmptyTextElement(element) || element.promptText) {
			return element;
		}
		const defaults = resolver.resolveDefaults(element);
		const placeholderType = resolver.placeholderType(element);
		if (!defaults && placeholderType === undefined) {
			return element;
		}
		const textStyle: TextStyle = { ...(element.textStyle ?? {}) };
		if (defaults) {
			resolver.applyBodyDefaults(textStyle, defaults);
			const firstLevel = defaults.levelStyles?.[0];
			if (firstLevel) {
				resolver.applyLevelDefaults(textStyle, firstLevel);
			}
		}
		const enriched: PptxElement = {
			...element,
			...(defaults?.promptText ? { promptText: defaults.promptText } : {}),
			...(Object.keys(textStyle).length > 0 ? { textStyle } : {}),
		};
		if (placeholderType !== undefined) {
			(enriched as PptxElement & { placeholderType?: string }).placeholderType = placeholderType;
		}
		return enriched;
	});
}
