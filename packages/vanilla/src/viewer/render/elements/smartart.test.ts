import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderSmartArtElement } from './smartart';

function makeContext(): ElementRenderContext {
	const registry = createElementRendererRegistry();
	const context: ElementRenderContext = {
		document,
		slide: { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map<string, string>(),
		t: createTranslator(),
		registry,
		renderElement: (el, z) => registry.resolve(el.type)(el, z, context),
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

describe('renderSmartArtElement', () => {
	it('returns null for non-smartArt elements', () => {
		const el = { type: 'text', id: 't1', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(renderSmartArtElement(el, 0, makeContext())).toBeNull();
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
		const node = renderSmartArtElement(element, 0, makeContext()) as HTMLElement;
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
});
