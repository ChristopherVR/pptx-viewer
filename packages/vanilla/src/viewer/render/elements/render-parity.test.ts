import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderConnectorElement } from './connector';
import { renderTextShapeElement } from './text-shape';

function makeContext(): ElementRenderContext {
	const registry = createElementRendererRegistry();
	const context: ElementRenderContext = {
		document,
		slide: { id: 's1', rId: 'r1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map(),
		t: createTranslator(),
		smartArt3D: false,
		presenting: false,
		registry,
		renderElement: (element, zIndex) => registry.resolve(element.type)(element, zIndex, context),
	};
	return context;
}

function shape(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'shape-1',
		x: 10,
		y: 20,
		width: 300,
		height: 120,
		shapeType: 'rect',
		text: 'Hello',
		textSegments: [{ text: 'Hello', style: {} }],
		shapeStyle: { fillColor: '#4472C4' },
		...overrides,
	} as PptxElement;
}

describe('vanilla rendering parity', () => {
	it('renders path-warp WordArt through SVG textPath', () => {
		const element = shape({ textStyle: { textWarpPreset: 'textArchUp', color: '#123456' } });
		const result = renderTextShapeElement(element, 0, makeContext()) as HTMLElement;
		expect(result.querySelector('.pptxv-wordart textPath')?.textContent).toBe('Hello');
		expect(result.querySelector('.pptxv-text')).toBeNull();
	});

	it('renders OMML equation segments as sanitized MathML', () => {
		const element = shape({
			textSegments: [
				{
					text: '',
					style: {},
					equationXml: { 'm:oMath': { 'm:r': { 'm:t': 'x' } } },
					equationNumber: '1',
				},
			],
		});
		const result = renderTextShapeElement(element, 0, makeContext()) as HTMLElement;
		expect(result.querySelector('.pptxv-equation-math')?.innerHTML).toContain('<mi>x</mi>');
		expect(result.querySelector('.pptxv-equation-number')?.textContent).toBe('(1)');
	});

	it('adds extrusion side panels for shape 3D depth', () => {
		const element = shape({
			shapeStyle: {
				fillColor: '#4472C4',
				shape3d: { extrusionHeight: 95250, extrusionColor: '#4472C4' },
			},
		});
		const result = renderTextShapeElement(element, 0, makeContext()) as HTMLElement;
		expect(result.querySelectorAll('.pptxv-extrusion-3d-panel').length).toBeGreaterThan(0);
	});

	it('injects shape duotone SVG filter definitions', () => {
		const element = shape({
			shapeStyle: {
				fillColor: '#4472C4',
				dagDuotone: { color1: '#000000', color2: '#ffffff' },
			},
		});
		const result = renderTextShapeElement(element, 0, makeContext()) as HTMLElement;
		expect(result.querySelector('filter#dag-duotone-shape-1')).not.toBeNull();
		expect(result.style.filter).toContain('url(#dag-duotone-shape-1)');
	});

	it('renders connector text plus SVG line shadow and glow', () => {
		const element: PptxElement = {
			type: 'connector',
			id: 'connector-1',
			x: 0,
			y: 0,
			width: 200,
			height: 80,
			text: 'Flow label',
			textSegments: [{ text: 'Flow label', style: {} }],
			shapeStyle: {
				strokeColor: '#112233',
				strokeWidth: 2,
				lineShadowColor: '#000000',
				lineGlowColor: '#ff0000',
				lineGlowRadius: 4,
			},
		};
		const result = renderConnectorElement(element, 0, makeContext()) as HTMLElement;
		expect(result.querySelector('.pptxv-connector-label')?.textContent).toContain('Flow label');
		expect(result.querySelector('feDropShadow')).not.toBeNull();
		expect(result.style.filter).toContain('drop-shadow');
	});
});
