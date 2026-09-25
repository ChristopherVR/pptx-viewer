import { mount } from '@vue/test-utils';
import type { PptxElement, PptxThemeColorScheme, PptxThemeFontScheme } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { computed, nextTick, shallowRef } from 'vue';

import {
	dispatchRibbonGalleryResult,
	RibbonGalleryHostKey,
} from '../../composables/useRibbonGalleryHost';
import type { RibbonGalleryHost } from '../../composables/useRibbonGalleryHost';
import RibbonGallery from './RibbonGallery.vue';

/**
 * RibbonGallery renders whatever the shared descriptor holds and routes a
 * pick through the host's history-tracked element update. Uses the real
 * Shape Styles gallery over a real shape element, so a descriptor or apply
 * change in shared shows up here.
 */
const COLOR_MAP = { dk1: '#000000', lt1: '#FFFFFF', accent1: '#156082', accent2: '#E97132' };

function shape(): PptxElement {
	return {
		id: 's1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#FF0000', fillMode: 'solid' },
		textSegments: [{ text: 'Hi', style: { color: '#000000' } }],
	} as unknown as PptxElement;
}

function makeHost(initial: PptxElement | null) {
	const element = shallowRef<PptxElement | null>(initial);
	const updateElement = vi.fn((id: string, patch: Partial<PptxElement>) => {
		if (element.value?.id === id) {
			element.value = { ...element.value, ...patch } as PptxElement;
		}
	});
	const applyTheme = vi.fn();
	const host: RibbonGalleryHost = {
		context: computed(() => ({ element: element.value, themeColorMap: COLOR_MAP })),
		dispatch: (result) => dispatchRibbonGalleryResult(result, { updateElement, applyTheme }),
	};
	return { host, element, updateElement, applyTheme };
}

function mountGallery(host: RibbonGalleryHost, mode: 'inline' | 'dropdown' = 'inline') {
	return mount(RibbonGallery, {
		props: { gallery: 'shapeStyles', control: 'shapeFormat.shapeStyles.gallery', mode },
		global: { provide: { [RibbonGalleryHostKey as symbol]: host } },
		attachTo: document.body,
	});
}

describe('ribbonGallery', () => {
	it('renders the inline strip and a tagged "more" trigger from the descriptor', () => {
		const { host } = makeHost(shape());
		const wrapper = mountGallery(host);
		expect(wrapper.attributes('data-ribbon-control')).toBe('shapeFormat.shapeStyles.gallery');
		const tiles = wrapper.findAll('[data-gallery-item]');
		expect(tiles).toHaveLength(6);
		expect(tiles[0].attributes('aria-pressed')).toBe('false');
		expect(tiles[0].attributes('aria-label')).toBe('Colored Outline - Dark 1');
		expect(tiles[0].find('svg').exists()).toBeTruthy();
		const more = wrapper.get('[data-ribbon-gallery="shapeStyles"]');
		expect(more.attributes('aria-label')).toBe('More Shape Styles');
		wrapper.unmount();
	});

	it('opens every section in the popup, applies a pick and marks it applied', async () => {
		const { host, updateElement } = makeHost(shape());
		const wrapper = mountGallery(host);
		await wrapper.get('[data-ribbon-gallery="shapeStyles"]').trigger('click');
		const popup = wrapper.get('[data-ribbon-gallery-popup="shapeStyles"]');
		expect(popup.findAll('[data-gallery-item]')).toHaveLength(77);
		expect(popup.text()).toContain('Presets');

		await popup.get('[data-gallery-item="preset-2-2"]').trigger('click');
		expect(updateElement).toHaveBeenCalledOnce();
		const [id, patch] = updateElement.mock.calls[0];
		expect(id).toBe('s1');
		expect(
			(patch as { shapeStyle: { fillColorRef?: unknown } }).shapeStyle.fillColorRef,
		).toStrictEqual({ scheme: 'accent2', alpha: 0.5 });
		await nextTick();
		expect(wrapper.find('[data-ribbon-gallery-popup]').exists()).toBeFalsy();

		await wrapper.get('[data-ribbon-gallery="shapeStyles"]').trigger('click');
		expect(wrapper.get('[data-gallery-item="preset-2-2"]').attributes('aria-pressed')).toBe('true');
		wrapper.unmount();
	});

	it('disables the trigger when nothing is selected', () => {
		const { host } = makeHost(null);
		const wrapper = mountGallery(host, 'dropdown');
		const trigger = wrapper.get('[data-ribbon-gallery="shapeStyles"]');
		expect(trigger.attributes('disabled')).toBeDefined();
		expect(trigger.text()).toContain('Shape Styles');
		wrapper.unmount();
	});
});

describe('dispatchRibbonGalleryResult', () => {
	it('routes scheme picks to the theme editor, keeping the other scheme', () => {
		const updateElement = vi.fn();
		const applyTheme = vi.fn();
		const colorScheme = { name: 'Blue' } as unknown as PptxThemeColorScheme;
		const fontScheme = { name: 'Arial' } as unknown as PptxThemeFontScheme;
		dispatchRibbonGalleryResult(
			{ kind: 'themeColorScheme', colorScheme, name: 'Blue' },
			{ updateElement, applyTheme },
		);
		dispatchRibbonGalleryResult(
			{ kind: 'themeFontScheme', fontScheme, name: 'Arial' },
			{ updateElement, applyTheme },
		);
		expect(applyTheme.mock.calls).toStrictEqual([[{ colorScheme }], [{ fontScheme }]]);
		expect(updateElement).not.toHaveBeenCalled();
	});
});
