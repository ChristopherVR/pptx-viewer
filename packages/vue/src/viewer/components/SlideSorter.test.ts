import { mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import type { CanvasSize } from '../types';
import SlideSorter from './SlideSorter.vue';

const canvasSize: CanvasSize = { width: 960, height: 540 };

function makeSlides(count: number): PptxSlide[] {
	return Array.from(
		{ length: count },
		(_, i): PptxSlide =>
			({
				id: `slide-${i}`,
				elements: [],
			}) as unknown as PptxSlide,
	);
}

function mountSorter(slides: PptxSlide[], activeIndex = 0) {
	return mount(SlideSorter, {
		props: {
			slides,
			canvasSize,
			mediaDataUrls: new Map<string, string>(),
			activeIndex,
		},
	});
}

describe('slideSorter', () => {
	it('renders one tile per slide', () => {
		const wrapper = mountSorter(makeSlides(4));
		expect(wrapper.findAll('.pptx-vue-sorter-tile')).toHaveLength(4);
	});

	it('marks the active tile with the active class', () => {
		const wrapper = mountSorter(makeSlides(3), 2);
		const tiles = wrapper.findAll('.pptx-vue-sorter-tile');
		expect(tiles[2]!.classes()).toContain('is-active');
		expect(tiles[0]!.classes()).not.toContain('is-active');
	});

	it('emits select with the clicked tile index', async () => {
		const wrapper = mountSorter(makeSlides(3));
		await wrapper.findAll('.pptx-vue-sorter-tile')[1]!.trigger('click');
		expect(wrapper.emitted('select')).toStrictEqual([[1]]);
	});

	it('emits reorder with from and to on a simulated drop', async () => {
		const wrapper = mountSorter(makeSlides(4));
		const tiles = wrapper.findAll('.pptx-vue-sorter-tile');
		const dataTransfer = {
			effectAllowed: '',
			dropEffect: '',
			setData: (): void => undefined,
			getData: (): string => '',
		};

		await tiles[0]!.trigger('dragstart', { dataTransfer });
		await tiles[2]!.trigger('dragover', { dataTransfer });
		await tiles[2]!.trigger('drop', { dataTransfer });

		expect(wrapper.emitted('reorder')).toStrictEqual([[0, 2]]);
	});

	it('does not emit reorder when dropped on the source tile', async () => {
		const wrapper = mountSorter(makeSlides(3));
		const tiles = wrapper.findAll('.pptx-vue-sorter-tile');
		const dataTransfer = {
			effectAllowed: '',
			dropEffect: '',
			setData: (): void => undefined,
			getData: (): string => '',
		};

		await tiles[1]!.trigger('dragstart', { dataTransfer });
		await tiles[1]!.trigger('drop', { dataTransfer });

		expect(wrapper.emitted('reorder')).toBeUndefined();
	});

	it('emits close when the close button is clicked', async () => {
		const wrapper = mountSorter(makeSlides(2));
		await wrapper.find('.pptx-vue-sorter-close').trigger('click');
		expect(wrapper.emitted('close')).toStrictEqual([[]]);
	});

	describe('context menu', () => {
		// The menu teleports to `document.body` (`ContextMenu.vue`'s `Teleport`),
		// so it has to be located there, not under `wrapper.element`. `unmount()`
		// matters here, not just clearing the DOM: leaving a prior test's
		// `attachTo: document.body` instance's reactive effects live while its
		// nodes are yanked out from under it corrupts the NEXT test's mount.
		let activeWrapper: ReturnType<typeof mount> | undefined;
		afterEach(() => {
			activeWrapper?.unmount();
			activeWrapper = undefined;
			document.body.replaceChildren();
		});

		function mountEditable(slides: PptxSlide[]) {
			activeWrapper = mount(SlideSorter, {
				attachTo: document.body,
				props: {
					slides,
					canvasSize,
					mediaDataUrls: new Map<string, string>(),
					activeIndex: 0,
					canEdit: true,
				},
			});
			return activeWrapper;
		}

		/**
		 * Right-click used to also emit `select`, which the host's `select`
		 * handler treats as "navigate and close the sorter" - so the whole
		 * overlay (including this just-opened menu) tore itself down again
		 * before a mouse click on Duplicate/Hide/Delete was ever reachable.
		 */
		it('does not emit select on right-click, so the menu stays reachable', async () => {
			const wrapper = mountEditable(makeSlides(3));
			await wrapper.findAll('.pptx-vue-sorter-tile')[1]!.trigger('contextmenu');
			expect(wrapper.emitted('select')).toBeUndefined();
			expect(document.querySelector('.pptx-vue-context-menu')).not.toBeNull();
		});

		it('opens on right-click and emits duplicate for the target tile on selection', async () => {
			const wrapper = mountEditable(makeSlides(3));
			await wrapper.findAll('.pptx-vue-sorter-tile')[2]!.trigger('contextmenu');
			const duplicateItem = document.querySelector<HTMLButtonElement>('[data-item-id="duplicate"]');
			duplicateItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			await wrapper.vm.$nextTick();
			expect(wrapper.emitted('duplicate')).toStrictEqual([[2]]);
		});

		it('does not open when canEdit is false', async () => {
			const wrapper = mountSorter(makeSlides(3));
			await wrapper.findAll('.pptx-vue-sorter-tile')[1]!.trigger('contextmenu');
			expect(document.querySelector('.pptx-vue-context-menu')).toBeNull();
		});
	});
});
