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

	it("mirrors the shape's own text body, not just its resolved fill", () => {
		const layer = renderReflectionOverlay(
			document,
			{
				type: 'shape',
				id: 'sp-text',
				x: 0,
				y: 0,
				width: 200,
				height: 80,
				shapeStyle: { fillColor: '#ff0000', reflectionStartOpacity: 0.5, reflectionDistance: 4 },
				text: 'Hello reflected world',
				textSegments: [{ text: 'Hello reflected world' }],
			} as unknown as PptxElement,
			new Map(),
		);
		expect(layer?.textContent).toContain('Hello reflected world');
	});

	it('mirrors a reflected group by recursing into its children', () => {
		const layer = renderReflectionOverlay(
			document,
			{
				type: 'group',
				id: 'grp1',
				x: 0,
				y: 0,
				width: 200,
				height: 100,
				groupEffectStyle: { reflectionStartOpacity: 0.5, reflectionDistance: 4 },
				children: [
					{
						type: 'shape',
						id: 'child1',
						x: 10,
						y: 10,
						width: 80,
						height: 40,
						shapeStyle: { fillColor: '#00ff00' },
						text: 'Child text',
						textSegments: [{ text: 'Child text' }],
					},
				],
			} as unknown as PptxElement,
			new Map(),
		);
		expect(layer?.textContent).toContain('Child text');
		expect(layer?.innerHTML).toContain('#00ff00');
	});

	it('returns null for a group with no groupFill reflection', () => {
		expect(
			renderReflectionOverlay(
				document,
				{
					type: 'group',
					id: 'grp-none',
					x: 0,
					y: 0,
					width: 200,
					height: 100,
					children: [],
				} as unknown as PptxElement,
				new Map(),
			),
		).toBeNull();
	});

	it('double-mirrors a child that carries its own reflection inside a reflected group', () => {
		const layer = renderReflectionOverlay(
			document,
			{
				type: 'group',
				id: 'grp-nested',
				x: 0,
				y: 0,
				width: 200,
				height: 100,
				groupEffectStyle: { reflectionStartOpacity: 0.5, reflectionDistance: 4 },
				children: [
					{
						type: 'shape',
						id: 'child-own-reflection',
						x: 10,
						y: 10,
						width: 80,
						height: 40,
						shapeStyle: {
							fillColor: '#00ff00',
							reflectionStartOpacity: 0.5,
							reflectionDistance: 2,
						},
					},
				],
			} as unknown as PptxElement,
			new Map(),
		);
		// One wrapper for the group's own mirror (`layer` itself), one nested
		// inside it for the child's own reflection: the child is not the element
		// being mirrored, so `suppressOwnReflection` must not apply to it.
		expect(layer?.querySelectorAll('.pptxv-reflection')).toHaveLength(1);
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
