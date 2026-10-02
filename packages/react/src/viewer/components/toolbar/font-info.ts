import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import { resolveDefaultFontFamily, textFontSizePxToPt } from 'pptx-viewer-shared';

/**
 * What the font name / size boxes should display for the current selection.
 *
 * With nothing overriding it on the element, the box shows the family the deck
 * would actually render: the theme's major font inside a title placeholder and
 * its minor font elsewhere. It used to show a hardcoded "Segoe UI", which
 * misreported every themed deck.
 */
export function extractFontInfo(
	element: PptxElement | null | undefined,
	themeFonts: { heading?: string; body?: string } | undefined,
): { fontFamily: string; fontSize: string } {
	const placeholderType = (element as { placeholderType?: string } | null | undefined)
		?.placeholderType;
	const defaults = {
		fontFamily: resolveDefaultFontFamily(placeholderType, themeFonts),
		fontSize: '24',
	};
	if (!element || !hasTextProperties(element)) {
		return defaults;
	}

	const segStyle = element.textSegments?.[0]?.style;
	const textStyle = element.textStyle;

	const fontFamily = segStyle?.fontFamily ?? textStyle?.fontFamily ?? defaults.fontFamily;
	const fontSize = segStyle?.fontSize ?? textStyle?.fontSize;

	return {
		fontFamily,
		fontSize:
			fontSize !== undefined && fontSize !== null
				? String(textFontSizePxToPt(fontSize))
				: defaults.fontSize,
	};
}
