import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { getShapeFillStrokeStyle } from '../style/element-style';
import ShapeEffectOverlay from './ShapeEffectOverlay.svelte';

/**
 * Per-sub-path FILL overlay (bugs: 41 presets lose per-subpath fill modes;
 * custGeom per-subpath fill was React-only).
 *
 * `smileyFace`'s eyes are authored `fill="none"` open strokes; merging every
 * sub-path into one clip-path + flat `background-color` (the pre-fix
 * behaviour) painted them FILLED and distorted instead.
 */

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
});

function render(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted = mount(ShapeEffectOverlay, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1 },
	});
	flushSync();
	return target;
}

function smileyFace(): PptxElement {
	return {
		id: 'smiley-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		shapeType: 'smileyFace',
		shapeStyle: { fillColor: '#FFD400' },
	} as unknown as PptxElement;
}

describe('shapeEffectOverlay per-sub-path fill', () => {
	it('paints smileyFace as layered paths, with the eyes unfilled', () => {
		const target = render(smileyFace());
		expect(target.querySelector('.pptx-svelte-subpath-fill')).not.toBeNull();
		const html = target.innerHTML;
		expect(html).toContain('fill="#FFD400"');
		expect(html).toContain('fill="none"');
	});

	it('drops the container fill so the layered paths are not painted underneath a flat colour', () => {
		const style = getShapeFillStrokeStyle(smileyFace());
		expect(style.backgroundColor).toBe('transparent');
	});

	it('shades the actionButtonBlank inset bevel well instead of painting it flat', () => {
		const element = {
			id: 'btn-1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 120,
			height: 120,
			shapeType: 'actionButtonBlank',
			shapeStyle: { fillColor: '#4472C4' },
		} as unknown as PptxElement;
		const target = render(element);
		const fills = [...target.innerHTML.matchAll(/fill="([^"]+)"/gu)].map((m) => m[1]);
		expect(new Set(fills).size).toBeGreaterThan(1);
	});

	it('renders nothing extra for an ordinary single-fill preset (rect)', () => {
		const element = {
			id: 'rect-1',
			type: 'shape',
			x: 0,
			y: 0,
			width: 100,
			height: 60,
			shapeType: 'rect',
			shapeStyle: { fillColor: '#336699' },
		} as unknown as PptxElement;
		const target = render(element);
		expect(target.querySelector('.pptx-svelte-subpath-fill')).toBeNull();
	});
});
