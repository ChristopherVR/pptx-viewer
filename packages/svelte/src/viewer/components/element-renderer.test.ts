import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * Element-dispatch tests: mount the renderer with fabricated elements of each
 * discriminant and assert it picks the right branch (real renderer vs typed
 * placeholder).
 */

let cleanup: (() => void) | undefined;

function mountEl(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1 },
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

const base = { id: 'e1', x: 5, y: 6, width: 120, height: 40 };

describe('elementRenderer dispatch', () => {
	it('renders a text element with its content and position', () => {
		const target = mountEl({ ...base, type: 'text', text: 'Hello world' } as PptxElement);
		expect(target.textContent).toContain('Hello world');
		const root = target.querySelector<HTMLElement>('[data-element-id="e1"]');
		expect(root?.className).toContain('pptx-svelte-shape');
		expect(root?.getAttribute('style')).toContain('left: 5px');
		expect(root?.getAttribute('style')).toContain('top: 6px');
	});

	it('renders rich text segments as styled runs', () => {
		const target = mountEl({
			...base,
			type: 'text',
			textSegments: [
				{ text: 'Bold', style: { bold: true } },
				{ text: ' plain', style: {} },
			],
		} as PptxElement);
		const run = Array.from(target.querySelectorAll('span')).find((el) => el.textContent === 'Bold');
		expect(run).toBeDefined();
		expect(run?.getAttribute('style')).toContain('font-weight: bold');
		expect(target.textContent).toContain('plain');
	});

	it('renders a shape with fill and ellipse radius', () => {
		const target = mountEl({
			...base,
			type: 'shape',
			shapeType: 'ellipse',
			shapeStyle: { fillColor: '#336699' },
		} as PptxElement);
		const root = target.querySelector<HTMLElement>('[data-element-id="e1"]');
		const style = root?.getAttribute('style') ?? '';
		expect(style).toContain('background-color: #336699');
		expect(style).toContain('border-radius: 9999px');
	});

	it('renders an image element as an <img> with its source', () => {
		const src = 'data:image/png;base64,QUJD';
		const target = mountEl({ ...base, type: 'image', imageData: src } as PptxElement);
		const img = target.querySelector('img');
		expect(img?.getAttribute('src')).toBe(src);
		expect(target.querySelector('.pptx-svelte-image')).not.toBeNull();
	});

	it('renders a connector as an inline SVG line', () => {
		const target = mountEl({
			...base,
			type: 'connector',
			shapeType: 'straightConnector1',
			shapeStyle: { strokeColor: '#ff0000', strokeWidth: 2 },
		} as PptxElement);
		const line = target.querySelector('.pptx-svelte-connector svg line');
		expect(line).not.toBeNull();
		expect(line?.getAttribute('stroke')).toBe('#ff0000');
	});

	it('recurses into groups', () => {
		const target = mountEl({
			...base,
			type: 'group',
			children: [
				{ id: 'c1', type: 'text', x: 0, y: 0, width: 50, height: 20, text: 'child A' },
				{ id: 'c2', type: 'text', x: 0, y: 20, width: 50, height: 20, text: 'child B' },
			],
		} as unknown as PptxElement);
		expect(target.querySelector('.pptx-svelte-group')).not.toBeNull();
		expect(target.textContent).toContain('child A');
		expect(target.textContent).toContain('child B');
		expect(target.querySelector('[data-element-id="c2"]')).not.toBeNull();
	});

	it.each(['contentPart', 'zoom', 'model3d'] as const)(
		'renders a typed placeholder for %s elements',
		(type) => {
			const target = mountEl({ ...base, type } as PptxElement);
			const placeholder = target.querySelector<HTMLElement>('.pptx-svelte-placeholder');
			expect(placeholder).not.toBeNull();
			expect(placeholder?.dataset.elementType).toBe(type);
			expect(placeholder?.getAttribute('style')).toContain('width: 120px');
		},
	);

	it.each([
		['table', '.pptx-svelte-table'],
		['chart', '.pptx-svelte-chart'],
		['smartArt', '.pptx-svelte-smartart'],
		['media', '.pptx-svelte-media'],
		['ink', '.pptx-svelte-ink'],
		['ole', '.pptx-svelte-ole'],
	] as const)(
		'dispatches %s elements to their real renderer, not the placeholder',
		(type, selector) => {
			const element = {
				...base,
				type,
				// Minimal per-type payloads so each renderer takes its real branch.
				...(type === 'table'
					? { tableData: { columnWidths: [1], rows: [{ cells: [{ text: 'x' }] }] } }
					: {}),
				...(type === 'chart'
					? {
							chartData: {
								chartType: 'bar',
								categories: ['A'],
								series: [{ name: 'S', values: [1] }],
								style: {},
							},
						}
					: {}),
				...(type === 'ink' ? { inkPaths: ['M 0 0 L 5 5'] } : {}),
			} as PptxElement;
			const target = mountEl(element);
			expect(target.querySelector('.pptx-svelte-placeholder')).toBeNull();
			expect(target.querySelector(selector)).not.toBeNull();
		},
	);
});
