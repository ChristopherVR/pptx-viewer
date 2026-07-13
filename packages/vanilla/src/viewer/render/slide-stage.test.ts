import type { PptxSlide } from 'pptx-viewer-core';
import { keyToLabel } from 'pptx-viewer-shared/i18n';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../i18n';
import { createDefaultRegistry } from './elements';
import { renderSlideStage } from './slide-stage';

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function buildSlide(): PptxSlide {
	return {
		id: 'slide-1',
		rId: 'rId1',
		slideNumber: 1,
		backgroundColor: '#123456',
		elements: [
			{
				type: 'text',
				id: 'el-text',
				x: 10,
				y: 20,
				width: 300,
				height: 60,
				text: 'Hello world',
				textStyle: { fontSize: 24, bold: true, color: '#ff0000' },
			},
			{
				type: 'shape',
				id: 'el-shape',
				x: 50,
				y: 100,
				width: 200,
				height: 120,
				shapeType: 'roundRect',
				shapeStyle: { fillColor: '#00aa55', strokeColor: '#111111', strokeWidth: 2 },
			},
			{
				type: 'image',
				id: 'el-image',
				x: 400,
				y: 40,
				width: 160,
				height: 90,
				imageData: PNG_DATA_URL,
			},
			{
				type: 'group',
				id: 'el-group',
				x: 100,
				y: 300,
				width: 400,
				height: 200,
				children: [
					{
						type: 'text',
						id: 'el-group-child',
						x: 5,
						y: 5,
						width: 100,
						height: 30,
						text: 'inside group',
					},
				],
			},
			{
				type: 'connector',
				id: 'el-connector',
				x: 600,
				y: 200,
				width: 150,
				height: 80,
				shapeType: 'straightConnector1',
				shapeStyle: { strokeColor: '#333333', strokeWidth: 2, connectorEndArrow: 'triangle' },
			},
			{ type: 'table', id: 'el-table', x: 20, y: 500, width: 300, height: 150 },
			{ type: 'model3d', id: 'el-model3d', x: 340, y: 500, width: 200, height: 150 },
		],
	};
}

function renderStage(slide: PptxSlide = buildSlide(), scale = 1): HTMLElement {
	return renderSlideStage({
		document,
		slide,
		canvasSize: { width: 1280, height: 720 },
		mediaDataUrls: new Map<string, string>(),
		registry: createDefaultRegistry(),
		t: createTranslator(),
		scale,
	});
}

describe('renderSlideStage', () => {
	it('renders a scaled stage with the slide background', () => {
		const stage = renderStage(buildSlide(), 0.5);
		expect(stage.className).toBe('pptxv-stage');
		expect(stage.style.width).toBe('1280px');
		expect(stage.style.height).toBe('720px');
		expect(stage.style.transform).toBe('scale(0.5)');
		expect(stage.style.backgroundColor).toBeTruthy();
	});

	it('renders text elements with positioned runs', () => {
		const stage = renderStage();
		const text = stage.querySelector<HTMLElement>('[data-element-id="el-text"]');
		expect(text).toBeTruthy();
		expect(text?.style.left).toBe('10px');
		expect(text?.style.top).toBe('20px');
		expect(text?.textContent).toContain('Hello world');
		// The element-level textStyle (bold/size/colour) lands on the text block.
		const block = text?.querySelector<HTMLElement>('.pptxv-text');
		expect(block?.style.fontWeight).toBe('bold');
		expect(block?.style.fontSize).toBe('24px');
	});

	it('renders shape fill and stroke', () => {
		const stage = renderStage();
		const shape = stage.querySelector<HTMLElement>('[data-element-id="el-shape"]');
		expect(shape).toBeTruthy();
		expect(shape?.style.backgroundColor).toBeTruthy();
		expect(shape?.style.border).toContain('2px');
	});

	it('renders images as <img> with the resolved source', () => {
		const stage = renderStage();
		const img = stage.querySelector<HTMLImageElement>('[data-element-id="el-image"] img');
		expect(img).toBeTruthy();
		expect(img?.getAttribute('src')).toBe(PNG_DATA_URL);
	});

	it('recurses into groups through the registry', () => {
		const stage = renderStage();
		const child = stage.querySelector<HTMLElement>(
			'[data-element-id="el-group"] [data-element-id="el-group-child"]',
		);
		expect(child).toBeTruthy();
		expect(child?.textContent).toContain('inside group');
	});

	it('renders connectors as SVG lines with arrow markers', () => {
		const stage = renderStage();
		const connector = stage.querySelector<HTMLElement>('[data-element-id="el-connector"]');
		expect(connector).toBeTruthy();
		const line = connector?.querySelector('svg line');
		expect(line).toBeTruthy();
		expect(line?.getAttribute('marker-end')).toContain('url(#');
		expect(connector?.querySelector('svg marker')).toBeTruthy();
	});

	it('renders a typed placeholder for element types without a renderer', () => {
		const stage = renderStage();
		const placeholder = stage.querySelector<HTMLElement>('[data-element-id="el-model3d"]');
		expect(placeholder).toBeTruthy();
		expect(placeholder?.dataset.elementType).toBe('model3d');
		expect(placeholder?.classList.contains('pptxv-placeholder')).toBeTruthy();
		expect(placeholder?.textContent).toBe(keyToLabel('model3d'));
	});

	it('dispatches to a custom renderer registered by the host', () => {
		const registry = createDefaultRegistry();
		registry.register('table', (element, zIndex, context) => {
			const el = context.document.createElement('div');
			el.dataset.elementId = element.id;
			el.dataset.custom = 'yes';
			el.style.zIndex = String(zIndex);
			return el;
		});
		const stage = renderSlideStage({
			document,
			slide: buildSlide(),
			canvasSize: { width: 1280, height: 720 },
			mediaDataUrls: new Map<string, string>(),
			registry,
			t: createTranslator(),
		});
		const custom = stage.querySelector<HTMLElement>('[data-element-id="el-table"]');
		expect(custom?.dataset.custom).toBe('yes');
	});

	it('adds shared ARIA metadata to the interactive stage only', () => {
		const interactive = renderSlideStage({
			document,
			slide: buildSlide(),
			canvasSize: { width: 1280, height: 720 },
			mediaDataUrls: new Map<string, string>(),
			registry: createDefaultRegistry(),
			t: createTranslator(),
			interactive: true,
		});
		const image = interactive.querySelector<HTMLElement>('[data-element-id="el-image"]');
		const text = interactive.querySelector<HTMLElement>('[data-element-id="el-text"]');
		expect(image?.getAttribute('role')).toBe('img');
		expect(image?.getAttribute('aria-label')).toBe('Image');
		expect(text?.getAttribute('aria-label')).toBe('Hello world');

		const thumbnail = renderStage();
		expect(
			thumbnail.querySelector('[data-element-id="el-image"]')?.getAttribute('role'),
		).toBeNull();
	});
});
