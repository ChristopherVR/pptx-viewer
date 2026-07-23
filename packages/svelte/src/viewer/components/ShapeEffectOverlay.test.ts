import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ShapeEffectOverlay from './ShapeEffectOverlay.svelte';

/**
 * ShapeEffectOverlay tests: assert it paints the DAG fill-overlay tint layer
 * (blended, absolutely positioned) and injects the soft-edge `<filter>` markup
 * so the shape's `filter: url(#soft-edge-<id>)` reference resolves.
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

function shape(id: string, shapeStyle: Record<string, unknown>): PptxElement {
	return {
		type: 'shape',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 80,
		shapeStyle,
	} as unknown as PptxElement;
}

describe('shapeEffectOverlay', () => {
	it('paints a blended fill-overlay tint layer', () => {
		const target = render(
			shape('el-overlay', {
				dagFillOverlayColor: '#ff0000',
				dagFillOverlayBlend: 'mult',
			}),
		);
		const layer = target.querySelector<HTMLElement>('.pptx-svelte-fill-overlay');
		expect(layer).not.toBeNull();
		expect(layer?.style.position).toBe('absolute');
		expect(layer?.style.mixBlendMode).toBe('multiply');
		expect(layer?.style.background).toBeTruthy();
		expect(layer?.style.pointerEvents).toBe('none');
	});

	it('injects the soft-edge filter markup with the element-scoped id', () => {
		const target = render(shape('el-soft', { softEdgeRadius: 6 }));
		const filter = target.querySelector('svg defs filter');
		expect(filter?.getAttribute('id')).toBe('soft-edge-el-soft');
		expect(target.querySelector('feGaussianBlur')).not.toBeNull();
	});

	it('renders nothing when the shape has no overlay or soft edge', () => {
		const target = render(shape('el-plain', { fillColor: '#00ff00' }));
		expect(target.querySelector('.pptx-svelte-fill-overlay')).toBeNull();
		expect(target.querySelector('svg')).toBeNull();
	});
});
