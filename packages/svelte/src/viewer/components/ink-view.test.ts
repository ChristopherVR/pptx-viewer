import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * InkView tests: per-stroke SVG paths (colour / width / opacity from the
 * parallel arrays), defaults, and the pressure-circle path (per-point stylus
 * pressures + the legacy oversized inkWidths fallback), mirroring the vanilla
 * ink renderer tests.
 */

let cleanup: (() => void) | undefined;

function mountEl(element: PptxElement, presenting = false): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 7, presenting },
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

describe('inkView', () => {
	it('emits the replay keyframes as real CSS while presenting', () => {
		// A literal `<style>{expr}</style>` in a Svelte template does not interpolate,
		// so the keyframes must go through `<svelte:element this={'style'}>`.
		const target = mountEl(
			inkElement({ inkPaths: ['M 0 0 L 50 50'], inkColors: ['#ff0000'], inkWidths: [2] }),
			true,
		);
		expect(target.querySelector('style')?.textContent).toContain('@keyframes pptx-ink-replay');
	});

	it('renders strokes as SVG paths with per-stroke colour, width, and opacity', () => {
		const target = mountEl(
			inkElement({
				inkPaths: ['M 0 0 L 50 50', 'M 10 10 L 20 20'],
				inkColors: ['#ff0000', '#00ff00'],
				inkWidths: [4, 2],
				inkOpacities: [0.5, 1],
			}),
		);
		const container = target.querySelector<HTMLElement>('[data-element-id="ink-1"]');
		const style = container?.getAttribute('style') ?? '';
		expect(style).toContain('left: 5px');
		expect(style).toContain('z-index: 7');

		const svg = container?.querySelector('svg.pptx-svelte-ink-svg');
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
		const target = mountEl(inkElement({ inkPaths: ['M 0 0 L 10 10'] }));
		const path = target.querySelector('svg path');
		expect(path?.getAttribute('stroke')).toBeTruthy();
		expect(path?.getAttribute('stroke-width')).toBe('1');
		expect(path?.getAttribute('stroke-opacity')).toBe('1');
	});

	it('renders pressure-sensitive strokes as per-point circles', () => {
		const target = mountEl(
			inkElement({
				inkPaths: ['M 0 0 L 10 10 L 20 20'],
				inkColors: ['#123456'],
				inkWidths: [3],
				inkOpacities: [0.8],
				inkPointPressures: [[0.1, 0.9, 0.4]],
			}),
		);
		const svg = target.querySelector('svg');
		expect(svg?.querySelector('path')).toBeNull();
		const group = svg?.querySelector('g');
		expect(group?.getAttribute('opacity')).toBe('0.8');
		const circles = group?.querySelectorAll('circle');
		// One circle per extracted path point: (0,0), (10,10), (20,20).
		expect(circles?.length).toBe(3);
		expect(circles?.[0].getAttribute('fill')).toBe('#123456');
	});

	it('treats a varying oversized inkWidths array as legacy per-point pressure data', () => {
		const target = mountEl(
			inkElement({ inkPaths: ['M 0 0 L 10 10 L 20 20'], inkWidths: [1, 2, 3] }),
		);
		expect(target.querySelector('svg path')).toBeNull();
		expect(target.querySelectorAll('svg circle')).toHaveLength(3);
	});

	it('renders no SVG for an element without strokes', () => {
		const target = mountEl(inkElement({}));
		expect(target.querySelector('[data-element-id="ink-1"]')).not.toBeNull();
		expect(target.querySelector('svg')).toBeNull();
	});
});
