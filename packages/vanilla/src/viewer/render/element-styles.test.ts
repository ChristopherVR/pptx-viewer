import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getTextBlockStyle } from './element-styles';

/** A text element carrying the given text style. */
function textElement(textStyle: Record<string, unknown>): PptxElement {
	return {
		id: 't1',
		type: 'text',
		x: 0,
		y: 0,
		width: 400,
		height: 100,
		text: 'hi',
		textStyle,
	} as unknown as PptxElement;
}

describe('getTextBlockStyle', () => {
	it('emits px lengths, since these maps are written straight onto element.style', () => {
		const style = getTextBlockStyle(textElement({ fontSize: 18, vAlign: 'bottom' }));
		expect(style['fontSize']).toBe('18px');
		expect(style['justifyContent']).toBe('flex-end');
		expect(style['lineHeight']).toBe(1.2);
	});

	// This binding's own copy of the text-block builder never read either
	// property, so a shrink-to-fit title painted 43% too large and a
	// `wrap="none"` line wrapped to three. Both now come from the shared builder.
	it('applies the normAutofit font scale and never wraps a wrap="none" body', () => {
		const autofit = getTextBlockStyle(
			textElement({ fontSize: 40, autoFit: true, autoFitMode: 'normal', autoFitFontScale: 0.7 }),
		);
		expect(autofit['fontSize']).toBe('28px');
		expect(getTextBlockStyle(textElement({ textWrap: 'none' }))['whiteSpace']).toBe('nowrap');
		expect(getTextBlockStyle(textElement({}))['whiteSpace']).toBe('pre-wrap');
	});
});
