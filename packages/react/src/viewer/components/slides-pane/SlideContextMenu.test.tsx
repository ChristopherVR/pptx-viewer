// @vitest-environment happy-dom
/**
 * The thumbnail right-click menu: New Slide, Duplicate, Delete, Layout, Hide,
 * Add Section, sourced from the shared `buildSlidePaneContextMenuEntries` list.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) =>
			params?.count ? `${key}:${params.count}` : key,
	}),
}));

const { SlideContextMenu } = await import('./SlideContextMenu');
type SlideContextMenuState = import('./types').SlideContextMenuState;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

function slides(count: number, hidden: number[] = []): PptxSlide[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `s${i}`,
		slideNumber: i + 1,
		elements: [],
		hidden: hidden.includes(i),
	})) as unknown as PptxSlide[];
}

function props(overrides: Partial<React.ComponentProps<typeof SlideContextMenu>> = {}) {
	const state: SlideContextMenuState = { x: 10, y: 20, slideIndex: 0, selectedIndexes: [0] };
	return {
		state,
		slides: slides(3),
		onAddSlideAfter: vi.fn(),
		onDuplicateSlides: vi.fn(),
		onDeleteSlides: vi.fn(),
		onHideSlides: vi.fn(),
		onOpenLayoutForSlide: vi.fn(),
		onAddSection: vi.fn(),
		onClose: vi.fn(),
		...overrides,
	};
}

function clickItem(label: string): void {
	const item = Array.from(container.querySelectorAll('button')).find(
		(b) => (b.textContent ?? '').trim() === label,
	);
	if (!item) {
		throw new Error(`no menu item labelled "${label}"`);
	}
	act(() => item.click());
}

describe('slideContextMenu', () => {
	it('renders the six shared commands', () => {
		act(() => {
			root.render(<SlideContextMenu {...props()} />);
		});
		expect(container.querySelectorAll('[role="menuitem"]')).toHaveLength(6);
	});

	it('new Slide inserts after the right-clicked slide and closes', () => {
		const onAddSlideAfter = vi.fn();
		const onClose = vi.fn();
		act(() => {
			root.render(<SlideContextMenu {...props({ onAddSlideAfter, onClose })} />);
		});
		clickItem('pptx.slidesPane.contextMenu.newSlide');
		expect(onAddSlideAfter).toHaveBeenCalledWith(0);
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('duplicate acts on the whole selection, not just the right-clicked slide', () => {
		const onDuplicateSlides = vi.fn();
		const state: SlideContextMenuState = { x: 0, y: 0, slideIndex: 1, selectedIndexes: [0, 1, 2] };
		act(() => {
			root.render(<SlideContextMenu {...props({ state, onDuplicateSlides })} />);
		});
		clickItem('pptx.slidesPane.contextMenu.duplicateCount:3');
		expect(onDuplicateSlides).toHaveBeenCalledWith([0, 1, 2]);
	});

	it('delete acts on the whole selection, not just the right-clicked slide', () => {
		const onDeleteSlides = vi.fn();
		const state: SlideContextMenuState = { x: 0, y: 0, slideIndex: 1, selectedIndexes: [0, 1, 2] };
		act(() => {
			// 5 slides, 3 selected: deleting the selection would not empty the
			// deck, unlike `slides(3)` with all 3 selected (correctly disabled).
			root.render(<SlideContextMenu {...props({ state, onDeleteSlides, slides: slides(5) })} />);
		});
		clickItem('pptx.slidesPane.contextMenu.deleteCount:3');
		expect(onDeleteSlides).toHaveBeenCalledWith([0, 1, 2]);
	});

	it('layout opens the gallery for the right-clicked slide at the click point', () => {
		const onOpenLayoutForSlide = vi.fn();
		act(() => {
			root.render(<SlideContextMenu {...props({ onOpenLayoutForSlide })} />);
		});
		clickItem('pptx.slidesPane.contextMenu.layout');
		expect(onOpenLayoutForSlide).toHaveBeenCalledWith(0, 10, 20);
	});

	it('hide/Show toggles the selection and Add Section targets the right-clicked slide', () => {
		const onHideSlides = vi.fn();
		const onAddSection = vi.fn();
		act(() => {
			root.render(<SlideContextMenu {...props({ onHideSlides, onAddSection })} />);
		});
		clickItem('pptx.slidesPane.contextMenu.hide');
		expect(onHideSlides).toHaveBeenCalledWith([0]);
		clickItem('pptx.slidesPane.contextMenu.addSection');
		expect(onAddSection).toHaveBeenCalledWith('pptx.sections.defaultName', 0);
	});

	it('disables Layout and Add Section for a multi-selection', () => {
		const state: SlideContextMenuState = { x: 0, y: 0, slideIndex: 0, selectedIndexes: [0, 1] };
		act(() => {
			root.render(<SlideContextMenu {...props({ state })} />);
		});
		const buttons = Array.from(container.querySelectorAll('button'));
		const layout = buttons.find((b) => b.textContent === 'pptx.slidesPane.contextMenu.layout');
		const addSection = buttons.find(
			(b) => b.textContent === 'pptx.slidesPane.contextMenu.addSection',
		);
		expect(layout?.disabled).toBeTruthy();
		expect(addSection?.disabled).toBeTruthy();
	});
});
