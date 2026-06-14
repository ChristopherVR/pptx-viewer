import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getContainerStyle } from './element-style';

/**
 * Minimal element factory. `getContainerStyle` only reads `PptxElementBase`
 * fields, so a controlled assertion to `PptxElement` is sufficient here.
 */
function baseElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		name: '',
		x: 10,
		y: 20,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

describe('getContainerStyle', () => {
	it('positions and sizes the element absolutely', () => {
		const style = getContainerStyle(baseElement(), 3);
		expect(style['position']).toBe('absolute');
		expect(style['left']).toBe('10px');
		expect(style['top']).toBe('20px');
		expect(style['width']).toBe('100px');
		expect(style['height']).toBe('50px');
		expect(style['z-index']).toBe(3);
	});

	it('emits a transform for rotation and flips', () => {
		const style = getContainerStyle(
			baseElement({ rotation: 45, flipHorizontal: true, flipVertical: true }),
			0,
		);
		expect(style['transform']).toBe('rotate(45deg) scaleX(-1) scaleY(-1)');
	});

	it('omits transform when there is no rotation or flip', () => {
		const style = getContainerStyle(baseElement(), 0);
		expect(style['transform']).toBeUndefined();
	});

	it('applies opacity and hidden display', () => {
		const style = getContainerStyle(baseElement({ opacity: 0.5, hidden: true }), 0);
		expect(style['opacity']).toBe(0.5);
		expect(style['display']).toBe('none');
	});
});
