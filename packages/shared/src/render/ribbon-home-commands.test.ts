import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	RIBBON_SHAPE_SWATCHES,
	resetSlideLayoutPath,
	shapeFillChange,
	shapeOutlineChange,
} from './ribbon-home-commands';

describe('resetSlideLayoutPath', () => {
	it('returns the layout Reset re-applies', () => {
		expect(
			resetSlideLayoutPath({ layoutPath: 'ppt/slideLayouts/slideLayout2.xml' } as PptxSlide),
		).toBe('ppt/slideLayouts/slideLayout2.xml');
	});

	it('returns undefined when there is nothing to reset to', () => {
		expect(resetSlideLayoutPath(undefined)).toBeUndefined();
		expect(resetSlideLayoutPath({} as PptxSlide)).toBeUndefined();
		expect(resetSlideLayoutPath({ layoutPath: '' } as PptxSlide)).toBeUndefined();
	});
});

describe('shape fill / outline changes', () => {
	it('writes the ShapeStyle fields the model actually has', () => {
		// React's ribbon wrote `fill` / `outlineColor`, which ShapeStyle does not
		// declare, so the swatches could never have worked.
		expect(shapeFillChange('#ff0000')).toStrictEqual({ fillColor: '#ff0000', fillMode: 'solid' });
		expect(shapeOutlineChange('#0070c0')).toStrictEqual({ strokeColor: '#0070c0' });
	});
});

describe('ribbonShapeSwatches', () => {
	it('is a 12-entry grid of hex colours', () => {
		expect(RIBBON_SHAPE_SWATCHES).toHaveLength(12);
		for (const swatch of RIBBON_SHAPE_SWATCHES) {
			expect(swatch).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});
