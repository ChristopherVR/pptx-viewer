import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	hasTextShadow,
	setColumnCountPatch,
	setTextDirectionPatch,
	toggleTextShadowPatch,
} from './editor-text-body-mutations';

/**
 * Patch builders behind the Home tab's Text Direction, Columns and Text Shadow
 * controls. All three write at the element `textStyle` level and preserve the
 * rest of the style, the convention every other Home-tab mutation follows.
 */

function textEl(textStyle: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'text',
		id: 'text-1',
		x: 0,
		y: 0,
		width: 100,
		height: 20,
		text: 'Hello',
		textStyle,
	} as unknown as PptxElement;
}

/** Read the `textStyle` a patch carries, without the caller-side casts. */
function styleOf(patch: Partial<PptxElement>): Record<string, unknown> {
	return (patch as { textStyle: Record<string, unknown> }).textStyle;
}

describe('setTextDirectionPatch', () => {
	it('sets the direction while keeping the rest of the style', () => {
		const patch = setTextDirectionPatch(textEl({ bold: true }), 'vertical270');
		expect(styleOf(patch)).toMatchObject({ bold: true, textDirection: 'vertical270' });
	});
});

describe('setColumnCountPatch', () => {
	it('sets the body column count', () => {
		expect(styleOf(setColumnCountPatch(textEl(), 3))).toMatchObject({ columnCount: 3 });
	});
});

describe('toggleTextShadowPatch', () => {
	it('applies the default shadow when there is none', () => {
		const style = styleOf(toggleTextShadowPatch(textEl()));
		expect(style).toMatchObject({
			textShadowColor: '#000000',
			textShadowBlur: 2,
			textShadowOffsetX: 1,
			textShadowOffsetY: 1,
			textShadowOpacity: 0.5,
		});
	});

	it('clears every shadow field when turning it off, not just the colour', () => {
		const on = textEl({
			textShadowColor: '#123456',
			textShadowBlur: 9,
			textShadowOffsetX: 4,
			textShadowOffsetY: 4,
			textShadowOpacity: 0.9,
			italic: true,
		});
		const style = styleOf(toggleTextShadowPatch(on));
		expect(style.textShadowColor).toBeUndefined();
		expect(style.textShadowBlur).toBeUndefined();
		expect(style.textShadowOffsetX).toBeUndefined();
		expect(style.textShadowOffsetY).toBeUndefined();
		expect(style.textShadowOpacity).toBeUndefined();
		// Unrelated formatting survives the toggle.
		expect(style.italic).toBeTruthy();
	});
});

describe('hasTextShadow', () => {
	it('reports the toggle state a ribbon button binds to', () => {
		expect(hasTextShadow(undefined)).toBeFalsy();
		expect(hasTextShadow(textEl())).toBeFalsy();
		expect(hasTextShadow(textEl({ textShadowColor: '#000' }))).toBeTruthy();
	});
});
