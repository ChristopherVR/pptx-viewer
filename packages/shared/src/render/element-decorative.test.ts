import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { isElementMarkedDecorative } from './element-decorative';

const base = { id: '1', x: 0, y: 0, width: 10, height: 10 };

describe('isElementMarkedDecorative (issue G16)', () => {
	it('returns true only when isDecorative is exactly true', () => {
		expect(
			isElementMarkedDecorative({ ...base, type: 'image', isDecorative: true } as PptxElement),
		).toBeTruthy();
	});

	it('returns false when isDecorative is false', () => {
		expect(
			isElementMarkedDecorative({ ...base, type: 'image', isDecorative: false } as PptxElement),
		).toBeFalsy();
	});

	it('returns false when isDecorative is absent', () => {
		expect(isElementMarkedDecorative({ ...base, type: 'image' } as PptxElement)).toBeFalsy();
	});
});
