import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderContentPartElement } from './contentpart';

function makeContext(presenting = false): ElementRenderContext {
	const registry = createElementRendererRegistry();
	const context: ElementRenderContext = {
		document,
		slide: { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map<string, string>(),
		t: createTranslator(),
		smartArt3D: false,
		surfaceChart3D: false,
		barChart3D: false,
		pieChart3D: false,
		presenting,
		registry,
		renderElement: (el, z) => registry.resolve(el.type)(el, z, context),
	};
	return context;
}

function contentPartElement(overrides: Record<string, unknown> = {}): PptxElement {
	return {
		type: 'contentPart',
		id: 'cp-1',
		x: 10,
		y: 20,
		width: 200,
		height: 100,
		...overrides,
	} as PptxElement;
}

describe('renderContentPartElement', () => {
	it('returns null for non-contentPart elements', () => {
		const el = { type: 'text', id: 't1', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(renderContentPartElement(el, 0, makeContext())).toBeNull();
	});

	it('renders ink strokes as SVG paths with per-stroke styling', () => {
		const node = renderContentPartElement(
			contentPartElement({
				inkStrokes: [
					{ path: 'M 0 0 L 10 10', color: '#ff0000', width: 2, opacity: 0.8 },
					{ path: 'M 5 5 L 20 20', color: '#0000ff', width: 1, opacity: 1 },
				],
			}),
			3,
			makeContext(),
		) as HTMLElement;
		expect(node.dataset.elementId).toBe('cp-1');
		expect(node.style.left).toBe('10px');
		expect(node.style.zIndex).toBe('3');
		expect(node.classList.contains('pptxv-placeholder')).toBeFalsy();

		const svg = node.querySelector('svg.pptxv-contentpart-svg');
		expect(svg?.getAttribute('viewBox')).toBe('0 0 200 100');
		expect(svg?.getAttribute('preserveAspectRatio')).toBe('none');

		const paths = node.querySelectorAll('path');
		expect(paths).toHaveLength(2);
		expect(paths[0].getAttribute('d')).toBe('M 0 0 L 10 10');
		expect(paths[0].getAttribute('stroke')).toBe('#ff0000');
		expect(paths[0].getAttribute('stroke-width')).toBe('2');
		expect(paths[0].getAttribute('stroke-opacity')).toBe('0.8');
		expect(paths[0].getAttribute('vector-effect')).toBe('non-scaling-stroke');
		expect(paths[1].getAttribute('stroke')).toBe('#0000ff');
	});

	it('renders pressure-sensitive strokes as variable-radius circles', () => {
		const node = renderContentPartElement(
			contentPartElement({
				inkStrokes: [
					{
						path: 'M 0 0 L 10 0 L 20 0 L 30 0',
						color: '#00ff00',
						width: 4,
						opacity: 0.5,
						pressures: [0.2, 0.9, 0.4, 0.7],
					},
				],
			}),
			0,
			makeContext(),
		) as HTMLElement;

		expect(node.querySelector('path')).toBeNull();
		const group = node.querySelector('g');
		expect(group?.getAttribute('opacity')).toBe('0.5');
		const circles = node.querySelectorAll('circle');
		expect(circles.length).toBeGreaterThan(0);
		expect(circles[0].getAttribute('fill')).toBe('#00ff00');
	});

	it('renders constant-pressure strokes as plain paths', () => {
		const node = renderContentPartElement(
			contentPartElement({
				inkStrokes: [
					{
						path: 'M 0 0 L 10 10',
						color: '#000000',
						width: 2,
						opacity: 1,
						pressures: [0.5, 0.5, 0.5],
					},
				],
			}),
			0,
			makeContext(),
		) as HTMLElement;
		expect(node.querySelector('circle')).toBeNull();
		expect(node.querySelector('path')).toBeTruthy();
	});

	it('renders calligraphic nib ellipses, taking priority over pressure circles', () => {
		const node = renderContentPartElement(
			contentPartElement({
				inkStrokes: [
					{
						path: 'M 0 0 L 10 0 L 20 0',
						color: '#123456',
						width: 3,
						opacity: 1,
						pressures: [0.1, 0.9, 0.3],
						tiltAngles: [0, Math.PI / 4, Math.PI / 2],
						tiltMagnitudes: [0.2, 0.6, 0.9],
					},
				],
			}),
			0,
			makeContext(),
		) as HTMLElement;

		expect(node.querySelector('path')).toBeNull();
		expect(node.querySelector('circle')).toBeNull();
		const ellipses = node.querySelectorAll('ellipse');
		expect(ellipses.length).toBeGreaterThan(0);
		expect(ellipses[0].getAttribute('fill')).toBe('#123456');
	});

	it('renders a labelled fallback box when there are no ink strokes', () => {
		const node = renderContentPartElement(contentPartElement(), 0, makeContext()) as HTMLElement;
		expect(node.querySelector('svg')).toBeNull();
		expect(node.classList.contains('pptxv-placeholder')).toBeTruthy();
		expect(node.textContent).toContain('Content Part');
	});

	it('replays constant-width strokes sequentially while presenting', () => {
		const node = renderContentPartElement(
			contentPartElement({
				inkStrokes: [
					{ path: 'M 0 0 L 10 10', color: '#ff0000', width: 2, opacity: 1 },
					{ path: 'M 10 10 L 20 20', color: '#0000ff', width: 2, opacity: 1 },
				],
			}),
			0,
			makeContext(true),
		) as HTMLElement;
		const paths = node.querySelectorAll<SVGPathElement>('path');

		expect(node.querySelector('style')?.textContent).toContain('@keyframes pptx-ink-replay');
		expect(paths[0].style.animation).toContain('pptx-ink-replay');
		expect(paths[0].getAttribute('stroke-dasharray')).toBeTruthy();
		expect(paths[1].style.animation).toContain('800ms');
	});
});
