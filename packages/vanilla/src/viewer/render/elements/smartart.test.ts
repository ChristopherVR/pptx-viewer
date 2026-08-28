import type { PptxElement } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderSmartArtElement } from './smartart';

// Mock the lazily-imported vanilla Three.js SmartArt scene runtime so the
// optional `three` peer dependency's WebGL renderer never touches happy-dom's
// canvas stub (same pattern as `model3d.test.ts`'s `mountModel3D` mock, but
// for the `pptx-viewer-shared/smartart-3d` subpath the 3D renderer imports).
const { mountSmartArt3D } = vi.hoisted(() => ({ mountSmartArt3D: vi.fn() }));

vi.mock(import('pptx-viewer-shared/smartart-3d'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		mountSmartArt3D: (...args: Parameters<typeof actual.mountSmartArt3D>) =>
			mountSmartArt3D(...args),
	};
});

function makeContext(
	smartArt3D = false,
	overrides: Partial<ElementRenderContext> = {},
): ElementRenderContext {
	const registry = createElementRendererRegistry();
	const context: ElementRenderContext = {
		document,
		slide: { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map<string, string>(),
		t: createTranslator(),
		smartArt3D,
		surfaceChart3D: false,
		barChart3D: false,
		pieChart3D: false,
		presenting: false,
		registry,
		renderElement: (el, z) => registry.resolve(el.type)(el, z, context),
		...overrides,
	};
	return context;
}

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

/** SmartArt element with only the node layout (no pre-computed drawing shapes). */
function nodesOnlyElement(): PptxElement {
	return {
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
}

/**
 * Flush the mount promise chain: the dynamic `import('pptx-viewer-shared/
 * smartart-3d')` resolves asynchronously (real module graph load, even though
 * `mountSmartArt3D` itself is mocked), so a couple of microtask-only
 * `Promise.resolve()` turns is not always enough; fall back to a macrotask
 * tick too.
 */
async function flushMount(): Promise<void> {
	for (let i = 0; i < 20; i += 1) {
		await new Promise((resolve) => {
			setTimeout(resolve, 5);
		});
	}
}

describe('renderSmartArtElement', () => {
	it('returns null for non-smartArt elements', () => {
		const el = { type: 'text', id: 't1', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(renderSmartArtElement(el, 0, makeContext())).toBeNull();
	});

	it('labels individual drawing nodes for assistive technology', () => {
		const rendered = renderSmartArtElement(drawingShapesElement(), 0, makeContext()) as HTMLElement;
		const node = rendered.querySelector('.pptxv-smartart-svg g');
		expect(node?.getAttribute('aria-label')).toBe('Node 1 of 1: Alpha');
		expect(node?.querySelector('title')?.textContent).toBe('Node 1 of 1: Alpha');
	});

	it('renders pre-computed drawing shapes as SVG rect/ellipse with labels', () => {
		const node = renderSmartArtElement(drawingShapesElement(), 3, makeContext()) as HTMLElement;
		expect(node.dataset.elementId).toBe('sa-1');
		expect(node.style.left).toBe('10px');
		expect(node.style.zIndex).toBe('3');

		const svg = node.querySelector('svg.pptxv-smartart-svg');
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
		const node = renderSmartArtElement(drawingShapesElement(), 0, makeContext()) as HTMLElement;
		const chrome = node.querySelector('.pptxv-smartart-chrome');
		expect(chrome?.getAttribute('role')).toBe('img');
		expect(chrome?.getAttribute('aria-label')).toBeTruthy();
	});

	it('applies chrome background and outline', () => {
		const element = drawingShapesElement();
		if (element.type === 'smartArt' && element.smartArtData) {
			element.smartArtData.chrome = { backgroundColor: '#eeeeee', outlineColor: '#333333' };
		}
		const node = renderSmartArtElement(element, 0, makeContext()) as HTMLElement;
		const chrome = node.querySelector<HTMLElement>('.pptxv-smartart-chrome');
		expect(chrome?.style.backgroundColor).toBeTruthy();
		expect(chrome?.style.border).toContain('1px');
	});

	it('falls back to the shared layout engine when no drawing shapes exist', () => {
		const node = renderSmartArtElement(nodesOnlyElement(), 0, makeContext()) as HTMLElement;
		const svg = node.querySelector('svg.pptxv-smartart-svg');
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
		const node = renderSmartArtElement(element, 0, makeContext()) as HTMLElement;
		const placeholder = node.querySelector('.pptxv-smartart-placeholder');
		expect(placeholder?.textContent).toBe('SmartArt');
	});

	it('edits node text inline and exposes palette fill controls', () => {
		const onSmartArtNodeTextChange = vi.fn();
		const onSmartArtNodeFillChange = vi.fn();
		const element = drawingShapesElement();
		const node = renderSmartArtElement(
			element,
			0,
			makeContext(false, { onSmartArtNodeTextChange, onSmartArtNodeFillChange }),
		) as HTMLElement;
		document.body.appendChild(node);
		const group = node.querySelector<SVGGElement>('[data-smartart-node-id="n1"]')!;

		group.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
		const swatch = node.querySelector<HTMLButtonElement>('.pptxv-smartart-node-swatches button');
		expect(swatch).toBeTruthy();
		swatch?.click();
		expect(onSmartArtNodeFillChange).toHaveBeenCalledWith(element, 'n1', expect.any(String));

		group.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		const editor = node.querySelector<HTMLTextAreaElement>('.pptxv-smartart-node-editor')!;
		expect(editor.value).toBe('Alpha');
		editor.value = 'Changed';
		editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(onSmartArtNodeTextChange).toHaveBeenCalledWith(element, 'n1', 'Changed');
		expect(node.querySelector('.pptxv-smartart-node-editor')).toBeNull();
		node.remove();
	});
});

describe('renderSmartArtElement (opt-in 3D)', () => {
	beforeEach(() => {
		mountSmartArt3D.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders the SVG synchronously and does not touch the 3D mount when the flag is off', async () => {
		const node = renderSmartArtElement(nodesOnlyElement(), 0, makeContext(false)) as HTMLElement;
		await flushMount();
		expect(node.querySelector('svg.pptxv-smartart-svg')).toBeTruthy();
		expect(node.querySelector('canvas')).toBeNull();
		expect(mountSmartArt3D).not.toHaveBeenCalled();
	});

	it('paints the SVG immediately, then upgrades to a mounted canvas once the scene loads', async () => {
		const node = renderSmartArtElement(nodesOnlyElement(), 2, makeContext(true)) as HTMLElement;
		expect(node.dataset.elementId).toBe('sa-2');
		expect(node.style.zIndex).toBe('2');
		// Synchronous return still paints the SVG fallback (matches Vue's
		// useFallback=true initial render before the async mount resolves).
		expect(node.querySelector('svg.pptxv-smartart-svg')).toBeTruthy();

		await flushMount();

		expect(mountSmartArt3D).toHaveBeenCalledExactlyOnceWith(
			expect.anything(),
			expect.objectContaining({ meshes: expect.any(Array) }),
			400,
			240,
			{},
		);
		const canvas = node.querySelector('canvas.pptxv-smartart-3d-canvas');
		expect(canvas).toBeTruthy();
		expect(node.querySelector('svg.pptxv-smartart-svg')).toBeNull();
		// Node reference stays the same across the upgrade (in-place swap).
		expect(node.dataset.elementId).toBe('sa-2');
	});

	it('renders a labelled placeholder without attempting a 3D mount when there is no SmartArt data', async () => {
		const element: PptxElement = {
			type: 'smartArt',
			id: 'sa-3',
			x: 0,
			y: 0,
			width: 100,
			height: 100,
		};
		const node = renderSmartArtElement(element, 0, makeContext(true)) as HTMLElement;
		await flushMount();
		expect(node.querySelector('.pptxv-smartart-placeholder')?.textContent).toBe('SmartArt');
		expect(mountSmartArt3D).not.toHaveBeenCalled();
	});

	it('reverts to the SVG fallback when the scene fails to mount', async () => {
		mountSmartArt3D.mockImplementation(() => {
			throw new Error('webgl unavailable');
		});
		const node = renderSmartArtElement(nodesOnlyElement(), 0, makeContext(true)) as HTMLElement;
		await flushMount();
		expect(node.querySelector('canvas.pptxv-smartart-3d-canvas')).toBeNull();
		expect(node.querySelector('svg.pptxv-smartart-svg')).toBeTruthy();
	});

	it('disposes the mounted scene when a later render removes its wrapper', async () => {
		const dispose = vi.fn();
		mountSmartArt3D.mockReturnValue({
			resize: vi.fn(),
			setInteractive: vi.fn(),
			dispose,
		});
		const node = renderSmartArtElement(nodesOnlyElement(), 0, makeContext(true)) as HTMLElement;
		document.body.appendChild(node);
		await flushMount();

		node.remove();
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 0);
		});

		expect(dispose).toHaveBeenCalledOnce();
	});
});

// Regression: `colorsDef @meth="span"` ("Colorful Range" quick styles) was
// parsed into `colorTransform.fillInterpolation` but never reached the layout
// engine, so a 2-colour range alternated instead of gradienting. `smartart.ts`
// now goes through the shared `computeSmartArtElementLayout`, which derives
// the interpolation from `smartArtData.colorTransform` itself.
describe('renderSmartArtElement colour interpolation (colorsDef @meth="span")', () => {
	it('gradients a 2-colour "Colorful Range" scheme across all nodes', () => {
		const element: PptxElement = {
			type: 'smartArt',
			id: 'sa-span',
			x: 0,
			y: 0,
			width: 400,
			height: 300,
			smartArtData: {
				nodes: [
					{ id: 'n1', text: 'A' },
					{ id: 'n2', text: 'B' },
					{ id: 'n3', text: 'C' },
					{ id: 'n4', text: 'D' },
					{ id: 'n5', text: 'E' },
				],
				colorTransform: {
					fillColors: ['#000000', '#ffffff'],
					lineColors: [],
					fillInterpolation: { method: 'span' },
				},
			},
		};
		const node = renderSmartArtElement(element, 0, makeContext()) as HTMLElement;
		const svg = node.querySelector('svg.pptxv-smartart-svg');
		const fills = [...(svg?.querySelectorAll('rect') ?? [])].map((r) => r.getAttribute('fill'));
		expect(fills).toHaveLength(5);
		expect(fills[0]).toBe('#000000');
		expect(fills[4]).toBe('#ffffff');
		expect(new Set(fills).size).toBe(5);
	});
});

/**
 * The shared layout descriptor's OPTIONAL paint / placement fields. This
 * renderer used to call `appendCenteredSvgText` with a literal `'white'` fill
 * and the node's own centre, and stroke every connector `#94a3b8` at 1.5/0.5,
 * so a target caption sat on the bullseye and a timeline caption on its dot.
 */
describe('renderSmartArtElement fallback label + connector paint', () => {
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

	function render(type: 'target' | 'timeline' | 'gear'): HTMLElement {
		return renderSmartArtElement(fallbackElement(type), 0, makeContext()) as HTMLElement;
	}

	it('parks a target leader caption beside the ring in the node colour', () => {
		const label = render('target').querySelector('svg text')!;
		// Not the circle centre (cx = 160): the descriptor's textX / textAnchor.
		expect(label.getAttribute('x')).toBe('310');
		expect(label.getAttribute('text-anchor')).toBe('start');
		expect(label.getAttribute('fill')).toBe('#3b82f6');
		expect(label.querySelector('tspan')?.getAttribute('y')).toBe('13');
	});

	it('stacks timeline captions above and below the axis', () => {
		const labels = [...render('timeline').querySelectorAll('svg text')];
		expect(labels[0]!.getAttribute('dominant-baseline')).toBe('auto');
		expect(labels[0]!.querySelector('tspan')?.getAttribute('y')).toBe('110');
		expect(labels[1]!.getAttribute('dominant-baseline')).toBe('hanging');
		expect(labels[1]!.querySelector('tspan')?.getAttribute('y')).toBe('190');
	});

	it('applies the node text style (gear hubs are bold)', () => {
		expect(render('gear').querySelector('svg text')?.getAttribute('font-weight')).toBe('700');
	});

	it('paints timeline stems in their own node colour, not the default grey', () => {
		const paths = [...render('timeline').querySelectorAll('svg path')];
		expect(paths[0]!.getAttribute('stroke-width')).toBe('2');
		expect(paths[0]!.getAttribute('opacity')).toBe('1');
		expect(paths[1]!.getAttribute('stroke')).toBe('#3b82f6');
	});
});
