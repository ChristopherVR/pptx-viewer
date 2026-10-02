/**
 * Home > Slides is the shared `pptx-ui-ribbon-home-slides` strip: the Vue
 * adapter gates it, routes its intents and hangs the native layout menus below
 * the shared triggers.
 */
import { mount } from '@vue/test-utils';
import { registerPptxWebControls } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import SlidesGroup from './SlidesGroup.vue';

registerPptxWebControls();

const LAYOUTS = [
	{ path: 'ppt/slideLayouts/slideLayout1.xml', name: 'Title Slide' },
	{ path: 'ppt/slideLayouts/slideLayout2.xml', name: 'Title and Content' },
];

function mountGroup(overrides: Record<string, unknown> = {}) {
	const handlers = {
		onInsertSlideFromLayout: vi.fn(),
		onInsertSlideFromTemplate: vi.fn(),
		onApplyLayout: vi.fn(),
		onResetSlide: vi.fn(),
		onAddSection: vi.fn(),
	};
	const wrapper = mount(SlidesGroup, {
		props: { canEdit: true, layoutOptions: LAYOUTS, ...handlers, ...overrides },
		attachTo: document.body,
	});
	const control = (id: string) =>
		wrapper.element.querySelector<HTMLElement>(`[data-ribbon-control="home.slides.${id}"]`)!;
	const button = (id: string) => control(id).querySelector('button') ?? control(id);
	return { wrapper, handlers, control, button };
}

describe('slidesGroup', () => {
	it('keeps the group and control ids and routes each button once', () => {
		const { wrapper, handlers, button, control } = mountGroup();
		expect(wrapper.element.querySelectorAll('[data-ribbon-group="home.slides"]')).toHaveLength(1);
		button('newSlide').click();
		button('reset').click();
		button('section').click();
		expect(handlers.onInsertSlideFromLayout).toHaveBeenCalledWith(LAYOUTS[0].path, 'Title Slide');
		expect(handlers.onResetSlide).toHaveBeenCalledOnce();
		expect(handlers.onAddSection).toHaveBeenCalledOnce();
		expect(control('newSlide').dataset.pptxChrome).toBe('split-button');
		wrapper.unmount();
	});

	it('opens the shared layout galleries and runs the picked layout', async () => {
		const { wrapper, handlers, button, control } = mountGroup();
		const caret = control('newSlide').querySelector<HTMLElement>(
			'[data-pptx-chrome="split-caret"]',
		)!;
		caret.click();
		await wrapper.vm.$nextTick();
		expect(caret.getAttribute('aria-expanded')).toBe('true');
		expect(wrapper.element.textContent).toContain('Title and Content');
		control('newSlide')
			.querySelector<HTMLElement>(`[data-layout-path="${LAYOUTS[1].path}"]`)!
			.click();
		expect(handlers.onInsertSlideFromLayout).toHaveBeenCalledWith(
			LAYOUTS[1].path,
			'Title and Content',
		);
		button('layout').click();
		await wrapper.vm.$nextTick();
		expect(button('layout').getAttribute('aria-expanded')).toBe('true');
		control('layout')
			.querySelector<HTMLElement>(`[data-layout-path="${LAYOUTS[0].path}"]`)!
			.click();
		expect(handlers.onApplyLayout).toHaveBeenCalledWith(LAYOUTS[0].path);
		wrapper.unmount();
	});

	it('marks the current layout, loads previews on open and teleports artwork into the tile', async () => {
		const loadLayoutPreviews = vi.fn(async () => [
			{
				path: LAYOUTS[0].path,
				name: 'Title Slide',
				width: 960,
				height: 540,
				elements: [],
				placeholders: [],
			},
		]);
		const { wrapper, button, control } = mountGroup({
			currentLayoutPath: LAYOUTS[1].path,
			loadLayoutPreviews,
		});
		button('layout').click();
		await vi.waitFor(() =>
			expect(
				control('layout').querySelector('.surface .pptx-vue-stage, .surface > *'),
			).toBeTruthy(),
		);
		expect(loadLayoutPreviews).toHaveBeenCalledWith();
		expect(
			control('layout')
				.querySelector(`[data-layout-path="${LAYOUTS[1].path}"]`)!
				.getAttribute('aria-current'),
		).toBe('true');
		wrapper.unmount();
	});

	it('gates on edit rights and layouts, and hides templates without a handler', () => {
		const locked = mountGroup({ canEdit: false });
		for (const id of ['newSlide', 'layout', 'reset', 'section', 'slideTemplates']) {
			expect(locked.button(id).hasAttribute('disabled')).toBeTruthy();
		}
		locked.wrapper.unmount();
		const noLayouts = mountGroup({ layoutOptions: [], onInsertSlideFromTemplate: undefined });
		expect(noLayouts.button('newSlide').hasAttribute('disabled')).toBeTruthy();
		expect(noLayouts.button('layout').hasAttribute('disabled')).toBeTruthy();
		expect(noLayouts.button('reset').hasAttribute('disabled')).toBeFalsy();
		expect(noLayouts.control('slideTemplates').hidden).toBeTruthy();
		expect(
			noLayouts.control('newSlide').querySelector<HTMLElement>('[data-pptx-chrome="split-caret"]')!
				.hidden,
		).toBeTruthy();
		noLayouts.wrapper.unmount();
	});
});
