import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * ContentPartView tests: per-stroke SVG paths (colour / width / opacity),
 * the pressure-circle path, and the labelled fallback box when there are no
 * ink strokes, mirroring the vanilla contentPart renderer tests.
 */

let cleanup: (() => void) | undefined;

function mountEl(element: PptxElement, presenting = false): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 3, presenting },
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

function contentPartElement(overrides: Record<string, unknown>): PptxElement {
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

describe('contentPartView', () => {
	it('renders ink strokes as SVG paths with per-stroke colour, width, and opacity', () => {
		const target = mountEl(
			contentPartElement({
				inkStrokes: [
					{ path: 'M 0 0 L 10 10', color: '#ff0000', width: 2, opacity: 0.8 },
					{ path: 'M 5 5 L 20 20', color: '#0000ff', width: 1, opacity: 1 },
				],
			}),
		);
		const container = target.querySelector<HTMLElement>('[data-element-id="cp-1"]');
		expect(container?.getAttribute('style')).toContain('left: 10px');
		expect(container?.getAttribute('style')).toContain('z-index: 3');

		const svg = container?.querySelector('svg.pptx-svelte-contentpart-svg');
		expect(svg?.getAttribute('viewBox')).toBe('0 0 200 100');

		const paths = svg?.querySelectorAll('path');
		expect(paths?.length).toBe(2);
		expect(paths?.[0].getAttribute('d')).toBe('M 0 0 L 10 10');
		expect(paths?.[0].getAttribute('stroke')).toBe('#ff0000');
		expect(paths?.[0].getAttribute('stroke-width')).toBe('2');
		expect(paths?.[0].getAttribute('stroke-opacity')).toBe('0.8');
		expect(paths?.[1].getAttribute('stroke')).toBe('#0000ff');
	});

	it('renders pressure-sensitive strokes as per-point circles', () => {
		const target = mountEl(
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
		);
		const svg = target.querySelector('svg');
		expect(svg?.querySelector('path')).toBeNull();
		const group = svg?.querySelector('g');
		expect(group?.getAttribute('opacity')).toBe('0.5');
		expect(group?.querySelectorAll('circle').length).toBeGreaterThan(0);
		expect(group?.querySelector('circle')?.getAttribute('fill')).toBe('#00ff00');
	});

	it('renders constant-pressure strokes as plain paths', () => {
		const target = mountEl(
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
		);
		expect(target.querySelector('circle')).toBeNull();
		expect(target.querySelector('path')).toBeTruthy();
	});

	it('renders calligraphic nib ellipses, taking priority over pressure circles', () => {
		const target = mountEl(
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
		);
		const svg = target.querySelector('svg');
		expect(svg?.querySelector('path')).toBeNull();
		expect(svg?.querySelector('circle')).toBeNull();
		const ellipses = svg?.querySelectorAll('ellipse');
		expect(ellipses?.length).toBeGreaterThan(0);
		expect(ellipses?.[0].getAttribute('fill')).toBe('#123456');
	});

	it('renders a labelled fallback box when there are no ink strokes', () => {
		const target = mountEl(contentPartElement({}));
		expect(target.querySelector('svg')).toBeNull();
		expect(target.querySelector('.pptx-svelte-contentpart-fallback')).toBeTruthy();
		expect(target.textContent).toContain('Content Part');
	});

	it('replays constant-width strokes sequentially while presenting', () => {
		const target = mountEl(
			contentPartElement({
				inkStrokes: [
					{ path: 'M 0 0 L 10 10', color: '#ff0000', width: 2, opacity: 1 },
					{ path: 'M 10 10 L 20 20', color: '#0000ff', width: 2, opacity: 1 },
				],
			}),
			true,
		);
		const paths = target.querySelectorAll<SVGPathElement>('path');

		expect(target.querySelector('style')?.textContent).toContain('@keyframes pptx-ink-replay');
		expect(paths[0].style.animation).toContain('pptx-ink-replay');
		expect(paths[0].getAttribute('stroke-dasharray')).toBeTruthy();
		expect(paths[1].style.animation).toContain('800ms');
	});
});
