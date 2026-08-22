import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ShapeEffectOverlay from './ShapeEffectOverlay.svelte';

/**
 * ShapeEffectOverlay tests: assert it paints the DAG fill-overlay tint layer
 * (blended, absolutely positioned) and injects the soft-edge `<filter>` markup
 * so the shape's `filter: url(#soft-edge-<id>)` reference resolves.
 */

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
});

function render(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted = mount(ShapeEffectOverlay, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1 },
	});
	flushSync();
	return target;
}

function shape(id: string, shapeStyle: Record<string, unknown>): PptxElement {
	return {
		type: 'shape',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 80,
		shapeStyle,
	} as unknown as PptxElement;
}

describe('shapeEffectOverlay', () => {
	it('paints a blended fill-overlay tint layer', () => {
		const target = render(
			shape('el-overlay', {
				dagFillOverlayColor: '#ff0000',
				dagFillOverlayBlend: 'mult',
			}),
		);
		const layer = target.querySelector<HTMLElement>('.pptx-svelte-fill-overlay');
		expect(layer).not.toBeNull();
		expect(layer?.style.position).toBe('absolute');
		expect(layer?.style.mixBlendMode).toBe('multiply');
		expect(layer?.style.background).toBeTruthy();
		expect(layer?.style.pointerEvents).toBe('none');
	});

	it('injects the soft-edge filter markup with the element-scoped id', () => {
		const target = render(shape('el-soft', { softEdgeRadius: 6 }));
		const filter = target.querySelector('svg defs filter');
		expect(filter?.getAttribute('id')).toBe('soft-edge-el-soft');
		expect(target.querySelector('feGaussianBlur')).not.toBeNull();
	});

	it('renders nothing when the shape has no overlay or soft edge', () => {
		const target = render(shape('el-plain', { fillColor: '#00ff00' }));
		expect(target.querySelector('.pptx-svelte-fill-overlay')).toBeNull();
		expect(target.querySelector('svg')).toBeNull();
	});

	it('strokes a stroke-only ("open") preset instead of boxing it in a border', () => {
		// `<a:prstGeom prst="line"/>` has no region to fill and no box to outline;
		// a CSS border drew a rectangle edge where PowerPoint draws the line.
		const target = render({
			type: 'shape',
			id: 'rule-1',
			x: 0,
			y: 0,
			width: 400,
			height: 0,
			shapeType: 'line',
			shapeStyle: { strokeColor: '#000000', strokeWidth: 2 },
		} as unknown as PptxElement);
		const path = target.querySelector('svg path');
		expect(path?.getAttribute('d')).toBe('M 0 0 L 400 1');
		expect(path?.getAttribute('stroke')).toBe('#000000');
		// The viewBox is the PAINTED box (padded to MIN_ELEMENT_SIZE), so the rule
		// is not stretched into a diagonal.
		expect(target.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 400 12');
		expect(target.querySelector('svg defs')).toBeNull();
	});

	it('leaves an explicitly INSET closed preset to its CSS border', () => {
		// `algn="in"` is the one alignment a CSS border already paints correctly,
		// so a closed preset must not ALSO get a painted SVG stroke outline. It
		// does still get the transparent pointer-events:stroke hit band, because
		// this fixture is unfilled and textless: a hollow frame, whose interior
		// must let clicks through to whatever it is drawn over.
		const target = render({
			type: 'shape',
			id: 'box-1',
			x: 0,
			y: 0,
			width: 100,
			height: 80,
			shapeType: 'rect',
			shapeStyle: { strokeColor: '#000000', strokeWidth: 2, lineAlignment: 'in' },
		} as unknown as PptxElement);
		const html = target.innerHTML;
		expect(html).not.toContain('#000000');
		expect(html).toContain('transparent');
	});

	it('centres a closed preset at the default (omitted) alignment instead', () => {
		const target = render({
			type: 'shape',
			id: 'box-1',
			x: 0,
			y: 0,
			width: 100,
			height: 80,
			shapeType: 'rect',
			shapeStyle: { strokeColor: '#000000', strokeWidth: 2 },
		} as unknown as PptxElement);
		expect(target.innerHTML).toContain('#000000');
	});

	describe('reflection', () => {
		it('renders a mirrored sibling with no -webkit-box-reflect', () => {
			const target = render(
				shape('el-reflect', {
					fillColor: '#ff0000',
					reflectionStartOpacity: 0.5,
					reflectionDistance: 4,
				}),
			);
			const layer = target.querySelector<HTMLElement>('.pptx-svelte-reflection');
			expect(layer).not.toBeNull();
			expect(layer?.style.position).toBe('absolute');
			expect(layer?.style.transform).toBe('scaleY(-1)');
			expect(target.innerHTML).not.toContain('box-reflect');
		});

		it('paints the reflected fill from the resolved solid colour for a shape', () => {
			const target = render(
				shape('el-reflect-2', {
					fillColor: '#ff0000',
					reflectionStartOpacity: 0.5,
					reflectionDistance: 4,
				}),
			);
			const fill = target.querySelector<HTMLElement>('.pptx-svelte-reflection div');
			expect(fill?.style.backgroundColor).toBe('#ff0000');
		});

		it('paints a reflected <img> for a picture element', () => {
			const target = render({
				type: 'picture',
				id: 'pic1',
				x: 0,
				y: 0,
				width: 100,
				height: 80,
				imageData: 'data:image/png;base64,AAAA',
				shapeStyle: { reflectionStartOpacity: 0.5, reflectionDistance: 4 },
			} as unknown as PptxElement);
			const img = target.querySelector<HTMLImageElement>('.pptx-svelte-reflection img');
			expect(img?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
		});

		it('renders nothing extra when there is no reflection', () => {
			const target = render(shape('el-plain-2', { fillColor: '#00ff00' }));
			expect(target.querySelector('.pptx-svelte-reflection')).toBeNull();
		});
	});
});
