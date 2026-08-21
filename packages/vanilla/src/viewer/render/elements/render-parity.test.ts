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
		surfaceChart3D: false,
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

	it('injects the soft-edge feather filter and references it', () => {
		const element = shape({
			shapeStyle: { fillColor: '#4472C4', softEdgeRadius: 8 },
		});
		const result = renderTextShapeElement(element, 0, makeContext()) as HTMLElement;
		expect(result.querySelector('filter#soft-edge-shape-1')).not.toBeNull();
		expect(result.style.filter).toContain('url(#soft-edge-shape-1)');
	});

	it('paints a blended DAG fill-overlay tint layer', () => {
		const element = shape({
			shapeStyle: {
				fillColor: '#4472C4',
				dagFillOverlayColor: '#ff0000',
				dagFillOverlayBlend: 'mult',
			},
		});
		const result = renderTextShapeElement(element, 0, makeContext()) as HTMLElement;
		const overlay = result.querySelector<HTMLElement>('.pptxv-fill-overlay');
		expect(overlay).not.toBeNull();
		expect(overlay?.style.background).toBeTruthy();
		expect(overlay?.style.mixBlendMode).toBe('multiply');
	});

	it('sets overflow:visible when a blur grow halo applies', () => {
		const element = shape({
			shapeStyle: { fillColor: '#4472C4', blurRadius: 10, blurGrow: true },
		});
		const result = renderTextShapeElement(element, 0, makeContext()) as HTMLElement;
		expect(result.style.overflow).toBe('visible');
	});

	it('resolves preset dashes and a wrapper-inherited stroke on connectors', () => {
		const element: PptxElement = {
			type: 'connector',
			id: 'connector-dash',
			x: 0,
			y: 0,
			width: 200,
			height: 0,
			shapeStyle: { strokeColor: '#112233', strokeWidth: 3, strokeDash: 'dash' },
		} as PptxElement;
		const result = renderConnectorElement(element, 0, makeContext()) as HTMLElement;
		expect(result.style.stroke).toBe('#112233');
		const line = result.querySelector('svg line');
		expect(line?.getAttribute('stroke')).toBe('inherit');
		expect(line?.getAttribute('stroke-dasharray')).toBeTruthy();
	});

	it('sizes an lg arrowhead marker from the shared marker geometry', () => {
		const element: PptxElement = {
			type: 'connector',
			id: 'connector-arrow',
			x: 0,
			y: 0,
			width: 200,
			height: 0,
			shapeStyle: {
				strokeColor: '#112233',
				strokeWidth: 2,
				connectorEndArrow: 'triangle',
				connectorEndArrowLength: 'lg',
				connectorEndArrowWidth: 'lg',
			},
		} as PptxElement;
		const result = renderConnectorElement(element, 0, makeContext()) as HTMLElement;
		const marker = result.querySelector('marker');
		// Base marker size 4 scaled by the `lg` factor 1.5 = 6.
		expect(marker?.getAttribute('markerWidth')).toBe('6');
		expect(marker?.getAttribute('markerHeight')).toBe('6');
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
