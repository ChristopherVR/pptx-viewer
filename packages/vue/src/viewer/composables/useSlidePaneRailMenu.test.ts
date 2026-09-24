import { mount } from '@vue/test-utils';
// oxlint-disable react-hooks/rules-of-hooks
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

import { useSlidePaneRailMenu } from './useSlidePaneRailMenu';
import type { SlidePaneRailMenuEmit, UseSlidePaneRailMenuResult } from './useSlidePaneRailMenu';

function slide(id: string, hidden = false): PptxSlide {
	return { id, slideNumber: 1, elements: [], hidden } as unknown as PptxSlide;
}

/** `useSlidePaneRailMenu` calls `useI18n()`, so it must run inside a component setup. */
function setup(
	slides: PptxSlide[],
	activeIndex = 0,
	canEdit = true,
): UseSlidePaneRailMenuResult & {
	emit: { [K in keyof SlidePaneRailMenuEmit]: ReturnType<typeof vi.fn> };
} {
	let result: UseSlidePaneRailMenuResult | null = null;
	const emit = {
		select: vi.fn(),
		'add-slide-after': vi.fn(),
		duplicate: vi.fn(),
		delete: vi.fn(),
		'toggle-hidden': vi.fn(),
		layout: vi.fn(),
		'add-section': vi.fn(),
	};
	mount(
		defineComponent({
			setup() {
				result = useSlidePaneRailMenu(
					() => slides,
					() => activeIndex,
					() => canEdit,
					(event, ...args) => (emit[event] as (...a: unknown[]) => void)(...args),
				);
				return () => h('div');
			},
		}),
	);
	return { ...(result as unknown as UseSlidePaneRailMenuResult), emit };
}

function mouseEvent(mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) {
	return { ctrlKey: false, metaKey: false, shiftKey: false, ...mods } as MouseEvent;
}

describe('useSlidePaneRailMenu multi-select', () => {
	it('a plain click selects just that slide and reports select', () => {
		const slides = [slide('s1'), slide('s2'), slide('s3')];
		const rail = setup(slides);
		rail.onSlideClick(mouseEvent(), 1);
		expect(rail.selectedIds.value).toStrictEqual(['s2']);
		expect(rail.emit.select).toHaveBeenCalledWith(1);
	});

	it('ctrl-click adds to the selection', () => {
		const slides = [slide('s1'), slide('s2'), slide('s3')];
		const rail = setup(slides);
		rail.onSlideClick(mouseEvent(), 0);
		rail.onSlideClick(mouseEvent({ ctrlKey: true }), 2);
		expect(rail.selectedIds.value).toStrictEqual(['s1', 's3']);
	});

	it('shift-click selects the contiguous range', () => {
		const slides = [slide('s1'), slide('s2'), slide('s3')];
		const rail = setup(slides);
		rail.onSlideClick(mouseEvent(), 0);
		rail.onSlideClick(mouseEvent({ shiftKey: true }), 2);
		expect(rail.selectedIds.value).toStrictEqual(['s1', 's2', 's3']);
	});
});

describe('useSlidePaneRailMenu Enter key', () => {
	it('enter inserts a new slide after the active one when editable', () => {
		const rail = setup([slide('s1'), slide('s2')], 1, true);
		const event = { key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent;
		rail.onPaneKeydown(event);
		expect(rail.emit['add-slide-after']).toHaveBeenCalledWith(1);
	});

	it('enter does nothing when read-only', () => {
		const rail = setup([slide('s1')], 0, false);
		const event = { key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent;
		rail.onPaneKeydown(event);
		expect(rail.emit['add-slide-after']).not.toHaveBeenCalled();
	});
});

describe('useSlidePaneRailMenu context menu', () => {
	it('offers the shared six-command set for a single-slide right-click', () => {
		const slides = [slide('s1'), slide('s2')];
		const rail = setup(slides);
		rail.onContextMenu(
			{ preventDefault: vi.fn(), clientX: 5, clientY: 8 } as unknown as MouseEvent,
			0,
		);
		const ids = rail.menuItems.value.filter((i) => !i.separator).map((i) => i.id);
		expect(ids).toStrictEqual([
			'new-slide',
			'duplicate',
			'delete',
			'layout',
			'hide',
			'add-section',
		]);
	});

	it('right-clicking a slide already selected acts on the whole selection', () => {
		const slides = [slide('s1'), slide('s2'), slide('s3'), slide('s4')];
		const rail = setup(slides);
		rail.onSlideClick(mouseEvent(), 0);
		rail.onSlideClick(mouseEvent({ shiftKey: true }), 2);
		rail.onContextMenu(
			{ preventDefault: vi.fn(), clientX: 0, clientY: 0 } as unknown as MouseEvent,
			1,
		);
		rail.onMenuSelect('duplicate');
		expect(rail.emit.duplicate).toHaveBeenCalledWith([0, 1, 2]);
	});

	it('right-clicking a slide OUTSIDE the selection acts on just that one', () => {
		const slides = [slide('s1'), slide('s2'), slide('s3')];
		const rail = setup(slides);
		rail.onSlideClick(mouseEvent(), 0);
		rail.onContextMenu(
			{ preventDefault: vi.fn(), clientX: 0, clientY: 0 } as unknown as MouseEvent,
			2,
		);
		rail.onMenuSelect('delete');
		expect(rail.emit.delete).toHaveBeenCalledWith([2]);
	});

	it('layout reports the right-clicked index and the click point', () => {
		const slides = [slide('s1')];
		const rail = setup(slides);
		rail.onContextMenu(
			{ preventDefault: vi.fn(), clientX: 12, clientY: 34 } as unknown as MouseEvent,
			0,
		);
		rail.onMenuSelect('layout');
		expect(rail.emit.layout).toHaveBeenCalledWith({ index: 0, x: 12, y: 34 });
	});
});
