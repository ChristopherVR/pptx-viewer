/**
 * `SmartArt3DRenderer.vue` on `<pptx-three-view>`: the spec comes from the
 * shared `resolveSmartArtThreeViewSpec`, the SVG `SmartArtRenderer` is slotted
 * in as the fallback in the container's own frame, and a diagram with nothing
 * to draw stays on the plain SVG renderer. Mirrors React's
 * `SmartArtElement.three-view.test.tsx`.
 */
import { mount } from '@vue/test-utils';
import type { PptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import type { PptxThreeViewElement } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';
import { computed } from 'vue';
import { createI18n } from 'vue-i18n';

import { DEFAULT_RENDERING_3D_FLAGS, Rendering3DFlagsKey } from '../composables/rendering-3d-flags';
import SmartArt3DRenderer from './SmartArt3DRenderer.vue';

const data = {
	layoutType: 'list',
	nodes: [
		{ id: 'n1', text: 'One' },
		{ id: 'n2', text: 'Two' },
	],
	drawingShapes: [
		{
			id: 'a',
			shapeType: 'roundRect',
			x: 0,
			y: 0,
			width: 400,
			height: 140,
			fillColor: '#4472C4',
			text: 'One',
		},
		{
			id: 'b',
			shapeType: 'roundRect',
			x: 0,
			y: 160,
			width: 400,
			height: 140,
			fillColor: '#ED7D31',
			text: 'Two',
		},
	],
} as unknown as PptxSmartArtData;

function element(smartArtData: PptxSmartArtData = data): PptxElement {
	return {
		id: 'sa-1',
		type: 'smartArt',
		x: 50,
		y: 60,
		width: 400,
		height: 300,
		rotation: 30,
		smartArtData,
	} as unknown as PptxElement;
}

function mountSmartArt(el: PptxElement, smartArt3D: boolean) {
	const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } });
	return mount(SmartArt3DRenderer, {
		props: { element: el, zIndex: 0 },
		global: {
			plugins: [i18n],
			provide: {
				[Rendering3DFlagsKey as symbol]: computed(() => ({
					...DEFAULT_RENDERING_3D_FLAGS,
					smartArt3D,
				})),
			},
		},
	});
}

describe('smartArt3DRenderer - <pptx-three-view>', () => {
	it('mounts the view with a smartart spec and slots the SVG fallback at the origin', () => {
		const wrapper = mountSmartArt(element(), true);
		const view = wrapper.element.querySelector<PptxThreeViewElement>('pptx-three-view');
		expect(view?.spec?.kind).toBe('smartart');
		const fallback = view?.querySelector<HTMLElement>('[data-element-id="sa-1"]');
		expect(fallback).not.toBeNull();
		// The outer container already carries position + rotation.
		expect(fallback?.style.left).toBe('0px');
		expect(fallback?.style.top).toBe('0px');
		expect(fallback?.style.transform ?? '').not.toContain('rotate');
		wrapper.unmount();
	});

	it('renders the plain SVG renderer when the diagram has nothing to draw', () => {
		const empty = { layoutType: 'list', nodes: [] } as unknown as PptxSmartArtData;
		const wrapper = mountSmartArt(element(empty), true);
		expect(wrapper.element.querySelector?.('pptx-three-view') ?? null).toBeNull();
		wrapper.unmount();
	});
});
