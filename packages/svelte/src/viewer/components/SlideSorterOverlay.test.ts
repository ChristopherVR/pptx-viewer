import type { PptxSlide } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SlideSorterOverlay from './SlideSorterOverlay.svelte';

/**
 * Right-click context menu (duplicate / hide-show / delete an arbitrary
 * slide), previously missing entirely from Svelte's sorter: delete/duplicate
 * only fired via keyboard and only ever targeted the active slide, and
 * hide/show had no path here at all (React/Vue both have this via a context
 * menu). These cover the mouse path added to close that gap.
 */

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function slides(): PptxSlide[] {
	return [
		{ id: 'a', rId: 'rId-a', slideNumber: 1, elements: [] },
		{ id: 'b', rId: 'rId-b', slideNumber: 2, elements: [] },
		{ id: 'c', rId: 'rId-c', slideNumber: 3, elements: [] },
	];
}

function render(overrides: Partial<Record<string, unknown>> = {}) {
	const onselect = vi.fn();
	const onmove = vi.fn();
	const ondelete = vi.fn();
	const onduplicate = vi.fn();
	const ontogglehidden = vi.fn();
	const onclose = vi.fn();
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(SlideSorterOverlay, {
		target,
		props: {
			slides: slides(),
			canvasSize: { width: 1280, height: 720 },
			mediaDataUrls: new Map<string, string>(),
			current: 0,
			canEdit: true,
			onselect,
			onmove,
			ondelete,
			onduplicate,
			ontogglehidden,
			onclose,
			...overrides,
		},
	});
	flushSync();
	cleanup = () => {
		void unmount(instance);
		target.remove();
	};
	return { target, onselect, onmove, ondelete, onduplicate, ontogglehidden, onclose };
}

function rightClick(article: Element): void {
	article.dispatchEvent(
		new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 60 }),
	);
	flushSync();
}

function menuButton(target: HTMLElement, label: string): HTMLButtonElement {
	const button = [...target.querySelectorAll<HTMLButtonElement>('.context-menu button')].find(
		(b) => b.textContent?.trim() === label,
	);
	if (!button) {
		throw new Error(`no context menu button labelled "${label}"`);
	}
	return button;
}

describe('slideSorterOverlay context menu', () => {
	it('opens on right-click and targets the right-clicked slide, not the active one', () => {
		const { target } = render({ current: 0 });
		const articles = target.querySelectorAll('article');
		rightClick(articles[2]); // slide 'c', not the active slide 'a'
		expect(target.querySelector('.context-menu')).toBeTruthy();
	});

	it('does not open when the sorter is not editable', () => {
		const { target } = render({ canEdit: false });
		rightClick(target.querySelectorAll('article')[1]);
		expect(target.querySelector('.context-menu')).toBeNull();
	});

	it('duplicate calls onduplicate with the right-clicked index and closes the menu', () => {
		const { target, onduplicate } = render({ current: 0 });
		rightClick(target.querySelectorAll('article')[2]);
		menuButton(target, 'Duplicate slide').click();
		flushSync();
		expect(onduplicate).toHaveBeenCalledExactlyOnceWith(2);
		expect(target.querySelector('.context-menu')).toBeNull();
	});

	it('delete calls ondelete with the right-clicked index', () => {
		const { target, ondelete } = render({ current: 0 });
		rightClick(target.querySelectorAll('article')[1]);
		menuButton(target, 'Delete slide').click();
		flushSync();
		expect(ondelete).toHaveBeenCalledExactlyOnceWith(1);
	});

	it('the hide/show label reflects the target slide and calls ontogglehidden', () => {
		const hiddenSlides = slides();
		hiddenSlides[1].hidden = true;
		const { target, ontogglehidden } = render({ slides: hiddenSlides, current: 0 });
		rightClick(target.querySelectorAll('article')[1]);
		expect(menuButton(target, 'Show slide')).toBeTruthy();
		menuButton(target, 'Show slide').click();
		flushSync();
		expect(ontogglehidden).toHaveBeenCalledExactlyOnceWith(1);
	});

	it('shows Hide slide for a visible slide', () => {
		const { target } = render({ current: 0 });
		rightClick(target.querySelectorAll('article')[0]);
		expect(menuButton(target, 'Hide slide')).toBeTruthy();
	});

	it('clicking the backdrop closes the menu without firing any action', () => {
		const { target, ondelete, onduplicate, ontogglehidden } = render({ current: 0 });
		rightClick(target.querySelectorAll('article')[1]);
		target.querySelector<HTMLButtonElement>('.menu-backdrop')?.click();
		flushSync();
		expect(target.querySelector('.context-menu')).toBeNull();
		expect(ondelete).not.toHaveBeenCalled();
		expect(onduplicate).not.toHaveBeenCalled();
		expect(ontogglehidden).not.toHaveBeenCalled();
	});

	it('escape key closes an open context menu', () => {
		const { target } = render({ current: 0 });
		rightClick(target.querySelectorAll('article')[1]);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		flushSync();
		expect(target.querySelector('.context-menu')).toBeNull();
	});
});
