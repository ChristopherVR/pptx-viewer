import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { renderReflectionOverlay } from './shape-filter-defs';

function shape(shapeStyle: Record<string, unknown>): PptxElement {
	return {
		type: 'shape',
		id: 'sp1',
		x: 0,
		y: 0,
		width: 100,
		height: 80,
		shapeStyle,
	} as unknown as PptxElement;
}

describe('renderReflectionOverlay', () => {
	it('returns null without a reflection', () => {
		expect(
			renderReflectionOverlay(document, shape({ fillColor: '#ffffff' }), new Map()),
		).toBeNull();
	});

	it('renders a mirrored sibling with no -webkit-box-reflect', () => {
		const layer = renderReflectionOverlay(
			document,
			shape({ fillColor: '#ff0000', reflectionStartOpacity: 0.5, reflectionDistance: 4 }),
			new Map(),
		);
		expect(layer).not.toBeNull();
		expect(layer?.className).toBe('pptxv-reflection');
		expect(layer?.style.position).toBe('absolute');
		expect(layer?.style.transform).toBe('scaleY(-1)');
		expect(layer?.getAttribute('aria-hidden')).toBe('true');
		expect(layer?.outerHTML).not.toContain('box-reflect');
	});

	it('paints the reflected fill from the resolved solid colour for a shape', () => {
		const layer = renderReflectionOverlay(
			document,
			shape({ fillColor: '#ff0000', reflectionStartOpacity: 0.5, reflectionDistance: 4 }),
			new Map(),
		);
		const fill = layer?.querySelector('div') as HTMLElement | null;
		expect(fill?.style.backgroundColor).toBe('#ff0000');
	});

	it('honours @sx/@sy/@kx/@ky/@rot/@algn in the composed transform + origin', () => {
		const layer = renderReflectionOverlay(
			document,
			shape({
				reflectionStartOpacity: 0.5,
				reflectionScaleX: 80000,
				reflectionScaleY: 80000,
				reflectionSkewX: 300000,
				reflectionRotation: 1800000,
				reflectionAlignment: 'tl',
			}),
			new Map(),
		);
		expect(layer?.style.transform).toBe(
			'scaleY(-1) scale(0.8, 0.8) skew(5deg, 0deg) rotate(30deg)',
		);
		expect(layer?.style.transformOrigin).toBe('left top');
	});
});
