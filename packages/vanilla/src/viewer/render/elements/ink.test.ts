import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderInkElement } from './ink';

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
		presenting,
		registry,
		renderElement: (el, z) => registry.resolve(el.type)(el, z, context),
	};
	return context;
}

function inkElement(overrides: Record<string, unknown>): PptxElement {
	return {
		type: 'ink',
		id: 'ink-1',
		x: 5,
		y: 15,
		width: 100,
		height: 80,
		inkPaths: [],
		...overrides,
	} as PptxElement;
}

describe('renderInkElement', () => {
	it('returns null for non-ink elements', () => {
		const el = { type: 'text', id: 't1', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(renderInkElement(el, 0, makeContext())).toBeNull();
	});

	it('renders strokes as SVG paths with per-stroke colour, width, and opacity', () => {
		const node = renderInkElement(
			inkElement({
				inkPaths: ['M 0 0 L 50 50', 'M 10 10 L 20 20'],
				inkColors: ['#ff0000', '#00ff00'],
				inkWidths: [4, 2],
				inkOpacities: [0.5, 1],
			}),
			7,
			makeContext(),
		) as HTMLElement;
		expect(node.dataset.elementId).toBe('ink-1');
		expect(node.style.left).toBe('5px');
		expect(node.style.zIndex).toBe('7');

		const svg = node.querySelector('svg.pptxv-ink-svg');
		expect(svg?.getAttribute('viewBox')).toBe('0 0 100 80');

		const paths = svg?.querySelectorAll('path');
		expect(paths?.length).toBe(2);
		expect(paths?.[0].getAttribute('d')).toBe('M 0 0 L 50 50');
		expect(paths?.[0].getAttribute('stroke')).toBe('#ff0000');
		expect(paths?.[0].getAttribute('stroke-width')).toBe('4');
		expect(paths?.[0].getAttribute('stroke-opacity')).toBe('0.5');
		expect(paths?.[0].getAttribute('stroke-linecap')).toBe('round');
		expect(paths?.[1].getAttribute('stroke')).toBe('#00ff00');
	});

	it('defaults colour, width, and opacity when the parallel arrays are missing', () => {
		const node = renderInkElement(
			inkElement({ inkPaths: ['M 0 0 L 10 10'] }),
			0,
			makeContext(),
		) as HTMLElement;
		const path = node.querySelector('svg path');
		expect(path?.getAttribute('stroke')).toBeTruthy();
		expect(path?.getAttribute('stroke-width')).toBe('1');
		expect(path?.getAttribute('stroke-opacity')).toBe('1');
	});

	it('renders pressure-sensitive strokes as per-point circles', () => {
		const node = renderInkElement(
			inkElement({
				inkPaths: ['M 0 0 L 10 10 L 20 20'],
				inkColors: ['#123456'],
				inkWidths: [3],
				inkOpacities: [0.8],
				inkPointPressures: [[0.1, 0.9, 0.4]],
			}),
			0,
			makeContext(),
		) as HTMLElement;
		const svg = node.querySelector('svg');
		expect(svg?.querySelector('path')).toBeNull();
		const group = svg?.querySelector('g');
		expect(group?.getAttribute('opacity')).toBe('0.8');
		const circles = group?.querySelectorAll('circle');
		// One circle per extracted path point: (0,0), (10,10), (20,20).
		expect(circles?.length).toBe(3);
		expect(circles?.[0].getAttribute('fill')).toBe('#123456');
	});

	it('replays constant-width strokes sequentially while presenting', () => {
		const node = renderInkElement(
			inkElement({ inkPaths: ['M 0 0 L 30 40', 'M 5 5 L 15 5'] }),
			0,
			makeContext(true),
		) as HTMLElement;
		const svg = node.querySelector('svg');
		expect(svg?.querySelector('style')?.textContent).toContain('@keyframes pptx-ink-replay');
		const paths = node.querySelectorAll<SVGPathElement>('path');
		expect(paths).toHaveLength(2);
		expect(paths[0].getAttribute('stroke-dasharray')).toBe('50');
		expect(paths[0].getAttribute('stroke-dashoffset')).toBe('50');
		expect(paths[0].style.animation).toContain('0ms forwards');
		expect(paths[1].style.animation).toContain('800ms forwards');
		expect(paths[0].style.getPropertyValue('--ink-path-length')).toBe('50');
	});

	it('does not replay strokes outside presentation mode', () => {
		const node = renderInkElement(
			inkElement({ inkPaths: ['M 0 0 L 30 40'] }),
			0,
			makeContext(),
		) as HTMLElement;
		expect(node.querySelector('style')).toBeNull();
		expect(node.querySelector('path')?.getAttribute('stroke-dasharray')).toBeNull();
	});

	it('uses multiply blending for highlighter ink', () => {
		const node = renderInkElement(
			inkElement({ inkPaths: ['M 0 0 L 10 10'], inkTool: 'highlighter' }),
			0,
			makeContext(),
		) as HTMLElement;
		expect((node.querySelector('svg') as SVGSVGElement).style.mixBlendMode).toBe('multiply');
	});

	it('keeps pressure-circle strokes static during presentation replay', () => {
		const node = renderInkElement(
			inkElement({
				inkPaths: ['M 0 0 L 10 10 L 20 20'],
				inkWidths: [3],
				inkPointPressures: [[0.1, 0.9, 0.4]],
			}),
			0,
			makeContext(true),
		) as HTMLElement;
		expect(node.querySelectorAll('circle')).toHaveLength(3);
		expect(node.querySelector('path')).toBeNull();
	});

	it('treats a varying oversized inkWidths array as legacy per-point pressure data', () => {
		const node = renderInkElement(
			inkElement({ inkPaths: ['M 0 0 L 10 10 L 20 20'], inkWidths: [1, 2, 3] }),
			0,
			makeContext(),
		) as HTMLElement;
		expect(node.querySelector('svg path')).toBeNull();
		expect(node.querySelectorAll('svg circle')).toHaveLength(3);
	});

	it('renders no SVG for an element without strokes', () => {
		const node = renderInkElement(inkElement({}), 0, makeContext()) as HTMLElement;
		expect(node).toBeTruthy();
		expect(node.querySelector('svg')).toBeNull();
	});
});
