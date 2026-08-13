import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import type { ComponentProps } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * SmartArtView tests: the pre-computed drawing-shapes path, the shared
 * layout-engine fallback, chrome + a11y labelling, and the empty placeholder,
 * mirroring the vanilla SmartArt renderer tests.
 */

let cleanup: (() => void) | undefined;

function mountEl(
	element: PptxElement,
	zIndex = 3,
	extra: Partial<ComponentProps<typeof ElementRenderer>> = {},
): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex, ...extra },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function drawingShapesElement(): PptxElement {
	return {
		type: 'smartArt',
		id: 'sa-1',
		x: 10,
		y: 20,
		width: 500,
		height: 300,
		smartArtData: {
			nodes: [{ id: 'n1', text: 'Alpha' }],
			colorScheme: 'colorful1',
			style: 'moderate',
			drawingShapes: [
				{
					id: 'shp1',
					shapeType: 'roundRect',
					x: 100,
					y: 50,
					width: 200,
					height: 100,
					fillColor: '#112233',
					text: 'Alpha',
				},
				{ id: 'shp2', shapeType: 'ellipse', x: 350, y: 50, width: 100, height: 100 },
			],
		},
	};
}

describe('smartArtView', () => {
	it('renders pre-computed drawing shapes as SVG rect/ellipse with labels', () => {
		const target = mountEl(drawingShapesElement());
		const node = target.querySelector<HTMLElement>('[data-element-id="sa-1"]');
		const style = node?.getAttribute('style') ?? '';
		expect(style).toContain('left: 10px');
		expect(style).toContain('z-index: 3');

		const svg = node?.querySelector('svg.pptx-svelte-smartart-svg');
		expect(svg).toBeTruthy();
		// viewBox is rebased to the shapes' bounding box (100..450 x 50..150).
		expect(svg?.getAttribute('viewBox')).toBe('0 0 350 100');

		const rect = svg?.querySelector('rect');
		expect(rect?.getAttribute('x')).toBe('0');
		expect(rect?.getAttribute('rx')).toBe('10');
		expect(rect?.getAttribute('fill')).toBe('#112233');

		const ellipse = svg?.querySelector('ellipse');
		expect(ellipse).toBeTruthy();
		// No explicit fill: the second shape takes the second palette colour.
		expect(ellipse?.getAttribute('fill')).toBe('#22c55e');

		expect(svg?.textContent).toContain('Alpha');
		// 'moderate' style applies a drop-shadow filter per shape group.
		const group = svg?.querySelector('g');
		expect(group?.getAttribute('style')).toContain('drop-shadow');
	});

	it('describes the diagram to assistive tech via role img + aria-label', () => {
		const target = mountEl(drawingShapesElement());
		const chrome = target.querySelector('.pptx-svelte-smartart-chrome');
		expect(chrome?.getAttribute('role')).toBe('img');
		expect(chrome?.getAttribute('aria-label')).toBeTruthy();
		const node = target.querySelector('svg g[role="img"]');
		expect(node?.getAttribute('aria-label')).toBe('Node 1 of 1: Alpha');
		expect(node?.querySelector('title')?.textContent).toBe('Node 1 of 1: Alpha');
	});

	it('applies chrome background and outline', () => {
		const element = drawingShapesElement();
		if (element.type === 'smartArt' && element.smartArtData) {
			element.smartArtData.chrome = { backgroundColor: '#eeeeee', outlineColor: '#333333' };
		}
		const target = mountEl(element);
		const chrome = target.querySelector<HTMLElement>('.pptx-svelte-smartart-chrome');
		expect(chrome?.style.backgroundColor).toBeTruthy();
		expect(chrome?.style.border).toContain('1px');
	});

	it('falls back to the shared layout engine when no drawing shapes exist', () => {
		const element: PptxElement = {
			type: 'smartArt',
			id: 'sa-2',
			x: 0,
			y: 0,
			width: 400,
			height: 240,
			smartArtData: {
				nodes: [
					{ id: 'n1', text: 'One' },
					{ id: 'n2', text: 'Two' },
					{ id: 'n3', text: 'Three' },
				],
			},
		};
		const svg = mountEl(element).querySelector('svg.pptx-svelte-smartart-svg');
		expect(svg).toBeTruthy();
		expect(svg?.getAttribute('data-layout-family')).toBeTruthy();
		// One geometry primitive per node, each with its label.
		const shapes = svg?.querySelectorAll('rect, circle, polygon');
		expect(shapes?.length).toBe(3);
		expect(svg?.textContent).toContain('One');
		expect(svg?.textContent).toContain('Three');
	});

	it('renders a labelled placeholder when there is no SmartArt data', () => {
		const element: PptxElement = {
			type: 'smartArt',
			id: 'sa-3',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		};
		const placeholder = mountEl(element).querySelector('.pptx-svelte-smartart-placeholder');
		expect(placeholder?.textContent).toBe('SmartArt');
	});

	it('edits node text inline and exposes palette fill controls', () => {
		const onsmartartnodecommit = vi.fn();
		const onsmartartnodefill = vi.fn();
		const target = mountEl(drawingShapesElement(), 3, {
			interactive: true,
			onsmartartnodecommit,
			onsmartartnodefill,
		});
		const group = target.querySelector<SVGGElement>('[data-smartart-node-id="n1"]')!;

		group.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
		flushSync();
		const swatch = target.querySelector<HTMLButtonElement>('.pptx-svelte-smartart-swatches button');
		expect(swatch).toBeTruthy();
		swatch?.click();
		expect(onsmartartnodefill).toHaveBeenCalledWith('sa-1', 'n1', expect.any(String));

		group.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		flushSync();
		const editor = target.querySelector<HTMLTextAreaElement>('.pptx-svelte-smartart-editor')!;
		expect(editor.value).toBe('Alpha');
		editor.value = 'Changed';
		editor.dispatchEvent(new Event('input', { bubbles: true }));
		editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		flushSync();
		expect(onsmartartnodecommit).toHaveBeenCalledWith('sa-1', 'n1', 'Changed');
	});
});

/**
 * The shared layout descriptor's OPTIONAL paint / placement fields. This SFC
 * used to render every fallback label through a `centeredText` snippet fixed at
 * `fill="white"`, `text-anchor="middle"` and the node centre, so a target
 * caption sat on the bullseye and a timeline caption on its dot; connectors
 * were likewise pinned to the grey default.
 */
describe('smartArtView fallback label + connector paint', () => {
	function fallbackElement(resolvedLayoutType: 'target' | 'timeline' | 'gear'): PptxElement {
		return {
			type: 'smartArt',
			id: 'sa-fb',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			smartArtData: {
				nodes: [
					{ id: 'n1', text: 'One' },
					{ id: 'n2', text: 'Two' },
					{ id: 'n3', text: 'Three' },
				],
				resolvedLayoutType,
			},
		} as PptxElement;
	}

	function labels(type: 'target' | 'timeline' | 'gear'): SVGTextElement[] {
		return [...mountEl(fallbackElement(type)).querySelectorAll('svg text')];
	}

	it('parks a target leader caption beside the ring in the node colour', () => {
		const label = labels('target')[0]!;
		// Not the circle centre (cx = 160): the descriptor's textX / textAnchor.
		expect(label.getAttribute('x')).toBe('310');
		expect(label.getAttribute('text-anchor')).toBe('start');
		expect(label.getAttribute('fill')).toBe('#3b82f6');
		expect(label.querySelector('tspan')?.getAttribute('y')).toBe('13');
	});

	it('stacks timeline captions above and below the axis', () => {
		const found = labels('timeline');
		expect(found[0]!.getAttribute('dominant-baseline')).toBe('auto');
		expect(found[0]!.querySelector('tspan')?.getAttribute('y')).toBe('110');
		expect(found[1]!.getAttribute('dominant-baseline')).toBe('hanging');
		expect(found[1]!.querySelector('tspan')?.getAttribute('y')).toBe('190');
	});

	it('applies the node text style (gear hubs are bold)', () => {
		expect(labels('gear')[0]!.getAttribute('font-weight')).toBe('700');
	});

	it('paints timeline stems in their own node colour, not the default grey', () => {
		const paths = [...mountEl(fallbackElement('timeline')).querySelectorAll('svg path')];
		expect(paths[0]!.getAttribute('stroke-width')).toBe('2');
		expect(paths[0]!.getAttribute('opacity')).toBe('1');
		expect(paths[1]!.getAttribute('stroke')).toBe('#3b82f6');
	});
});
