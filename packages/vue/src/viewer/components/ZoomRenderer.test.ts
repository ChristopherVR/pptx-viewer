import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { ZoomNavigationKey } from '../composables/zoom-navigation';
import type { ZoomTargetInfo, ZoomTargetLookup } from '../composables/zoom-target';
import { ZoomTargetKey } from '../composables/zoom-target';
import ZoomRenderer from './ZoomRenderer.vue';

function targetLookup(byIndex: Record<number, ZoomTargetInfo>): ZoomTargetLookup {
	return (index) => byIndex[index];
}

function zoom(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'zoom',
		id: 'zm 1',
		x: 10,
		y: 20,
		width: 200,
		height: 120,
		zoomType: 'slide',
		targetSlideIndex: 4,
		...overrides,
	} as PptxElement;
}

describe('zoomRenderer', () => {
	it('renders a slide-number fallback tile and a Slide Zoom badge', () => {
		const wrapper = mount(ZoomRenderer, { props: { element: zoom(), zIndex: 1 } });
		// targetSlideIndex 4 → "Slide 5"
		expect(wrapper.text()).toContain('Slide 5');
		expect(wrapper.text()).toContain('Slide Zoom');
		expect(wrapper.attributes('data-zoom-target')).toBe('4');
		expect(wrapper.find('img').exists()).toBeFalsy();
	});

	it('renders the preview image when imageData is present', () => {
		const src = 'data:image/png;base64,ZTHUMB';
		const wrapper = mount(ZoomRenderer, {
			props: { element: zoom({ imageData: src }), zIndex: 0 },
		});
		expect(wrapper.get('img').attributes('src')).toBe(src);
	});

	it('renders a Section Zoom badge and section label for section zooms', () => {
		const wrapper = mount(ZoomRenderer, {
			props: {
				element: zoom({ zoomType: 'section', targetSectionId: 'Intro' }),
				zIndex: 0,
			},
		});
		expect(wrapper.text()).toContain('Section Zoom');
		expect(wrapper.text()).toContain('Intro');
		expect(wrapper.attributes('data-zoom-type')).toBe('section');
	});

	it('stays a static tile (not focusable / no role) outside presentation mode', () => {
		const wrapper = mount(ZoomRenderer, { props: { element: zoom(), zIndex: 1 } });
		expect(wrapper.attributes('role')).toBeUndefined();
		expect(wrapper.attributes('tabindex')).toBeUndefined();
		expect(wrapper.classes()).not.toContain('pptx-vue-zoom-interactive');
	});

	it('navigates to the target slide on click when presentation provides a context', async () => {
		const navigateToZoomTarget = vi.fn();
		const wrapper = mount(ZoomRenderer, {
			props: { element: zoom({ targetSlideIndex: 5 }), zIndex: 1 },
			global: { provide: { [ZoomNavigationKey as symbol]: { navigateToZoomTarget } } },
		});
		expect(wrapper.attributes('role')).toBe('button');
		expect(wrapper.attributes('tabindex')).toBe('0');
		await wrapper.trigger('click');
		expect(navigateToZoomTarget).toHaveBeenCalledWith(5);
	});

	it('uses the target slide background, number and section name when a lookup is provided', () => {
		const lookup = targetLookup({
			4: { backgroundColor: '#123456', slideNumber: 9, sectionName: 'Chapter One' },
		});
		const wrapper = mount(ZoomRenderer, {
			props: { element: zoom(), zIndex: 1 },
			global: { provide: { [ZoomTargetKey as symbol]: lookup } },
		});
		const thumbnail = wrapper.get('.pptx-vue-zoom-thumbnail');
		expect(thumbnail.attributes('style')).toContain('background-color: #123456');
		// Uses the slide's own number (9), not targetSlideIndex + 1 (5).
		expect(wrapper.text()).toContain('Slide 9');
		expect(wrapper.text()).not.toContain('Slide 5');
		expect(wrapper.text()).toContain('Chapter One');
	});

	it('prefers the friendly section name over the section GUID for section zooms', () => {
		const lookup = targetLookup({ 4: { slideNumber: 3, sectionName: 'Intro Section' } });
		const wrapper = mount(ZoomRenderer, {
			props: { element: zoom({ zoomType: 'section', targetSectionId: 'GUID-123' }), zIndex: 0 },
			global: { provide: { [ZoomTargetKey as symbol]: lookup } },
		});
		expect(wrapper.text()).toContain('Intro Section');
		expect(wrapper.text()).not.toContain('GUID-123');
	});

	it('falls back to the target index and section GUID when the lookup misses the slide', () => {
		const lookup = targetLookup({ 99: { slideNumber: 1 } });
		const wrapper = mount(ZoomRenderer, {
			props: { element: zoom({ zoomType: 'section', targetSectionId: 'GUID-xyz' }), zIndex: 0 },
			global: { provide: { [ZoomTargetKey as symbol]: lookup } },
		});
		const thumbnail = wrapper.get('.pptx-vue-zoom-thumbnail');
		expect(thumbnail.attributes('style')).toContain('background-color: #f0f0f0');
		expect(wrapper.text()).toContain('Slide 5');
		expect(wrapper.text()).toContain('GUID-xyz');
	});

	it('navigates on Enter and Space but ignores other keys', async () => {
		const navigateToZoomTarget = vi.fn();
		const wrapper = mount(ZoomRenderer, {
			props: { element: zoom({ targetSlideIndex: 2 }), zIndex: 1 },
			global: { provide: { [ZoomNavigationKey as symbol]: { navigateToZoomTarget } } },
		});
		await wrapper.trigger('keydown', { key: 'Enter' });
		await wrapper.trigger('keydown', { key: ' ' });
		await wrapper.trigger('keydown', { key: 'a' });
		expect(navigateToZoomTarget).toHaveBeenCalledTimes(2);
		expect(navigateToZoomTarget).toHaveBeenNthCalledWith(1, 2);
	});

	it('renders and navigates distinct Summary Zoom section tiles', async () => {
		const navigateToZoomTarget = vi.fn();
		const wrapper = mount(ZoomRenderer, {
			props: {
				element: zoom({
					zoomType: 'summary',
					summaryLayout: 'grid',
					summaryTargets: [
						{
							sectionId: 'intro',
							targetSlideIndex: 1,
							x: 10,
							y: 20,
							width: 90,
							height: 120,
							title: 'Intro',
						},
						{
							sectionId: 'details',
							targetSlideIndex: 5,
							x: 120,
							y: 20,
							width: 90,
							height: 120,
							title: 'Details',
						},
					],
				}),
				zIndex: 1,
			},
			global: { provide: { [ZoomNavigationKey as symbol]: { navigateToZoomTarget } } },
		});
		const tiles = wrapper.findAll('.pptx-vue-summary-zoom-tile');
		expect(wrapper.attributes('data-zoom-type')).toBe('summary');
		expect(wrapper.text()).toContain('Summary Zoom');
		expect(tiles.map((tile) => tile.attributes('data-section-id'))).toStrictEqual([
			'intro',
			'details',
		]);
		await tiles[1].trigger('click');
		expect(navigateToZoomTarget).toHaveBeenCalledWith(5);
	});
});
