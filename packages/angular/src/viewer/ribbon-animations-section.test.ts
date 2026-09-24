import type { PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { canAuthorAnimation, findSelectedAnimation } from './ribbon-animations-section.component';

function animation(elementId: string): PptxElementAnimation {
	return { elementId, entrance: 'fadeIn', durationMs: 500, order: 0 };
}

describe('canAuthorAnimation', () => {
	it('requires both edit permission and a selection', () => {
		expect(canAuthorAnimation(true, true)).toBeTruthy();
		expect(canAuthorAnimation(false, true)).toBeFalsy();
		expect(canAuthorAnimation(true, false)).toBeFalsy();
	});
});

describe('findSelectedAnimation', () => {
	it('finds the entry belonging to the selected element', () => {
		const animations = [animation('a'), animation('b')];
		expect(findSelectedAnimation(animations, 'b')?.elementId).toBe('b');
	});

	it('is undefined when nothing is selected', () => {
		expect(findSelectedAnimation([animation('a')], undefined)).toBeUndefined();
	});

	it('is undefined when the selected element has no animation entry', () => {
		expect(findSelectedAnimation([animation('a')], 'z')).toBeUndefined();
	});

	it('is undefined for a slide with no animations at all', () => {
		expect(findSelectedAnimation(undefined, 'a')).toBeUndefined();
	});
});
