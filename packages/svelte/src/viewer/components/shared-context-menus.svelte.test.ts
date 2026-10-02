import type { PptxSlide } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PresentationContextMenu from './PresentationContextMenu.svelte';
import { ThumbnailRailMenu } from './thumbnail-rail-menu.svelte';
import ThumbnailContextMenu from './ThumbnailContextMenu.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	document.body.replaceChildren();
});

function render(component: unknown, props: Record<string, unknown>): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(component as never, { target, props });
	flushSync();
	cleanup = () => unmount(instance);
	return target;
}
const rows = (target: HTMLElement) =>
	Array.from(
		target
			.querySelector('pptx-ui-context-menu')!
			.shadowRoot!.querySelectorAll<HTMLButtonElement>('button'),
	);

describe('svelte presentation context menu', () => {
	const capabilities = {
		seeAllSlides: true,
		presenterView: true,
		pointerTools: true,
		eraseInk: true,
		blankBlack: true,
		blankWhite: true,
	};

	it('renders through the shared element above the overlay, with headings and a name', () => {
		const target = render(PresentationContextMenu, {
			x: 5,
			y: 6,
			capabilities,
			onaction: vi.fn(),
			onclose: vi.fn(),
		});
		const host = target.querySelector<HTMLElement>('pptx-ui-context-menu')!;
		expect(host.hasAttribute('data-pptx-presentation-menu')).toBeTruthy();
		expect(Number(host.style.zIndex)).toBeGreaterThan(2147483000);
		expect(rows(target).map((row) => row.dataset.itemId)).toHaveLength(12);
		expect(host.shadowRoot!.querySelectorAll('[role="group"]')).toHaveLength(2);
		expect(host.shadowRoot!.querySelector('[role="menu"]')!.getAttribute('aria-label')).toBe(
			'Slide show menu',
		);
	});

	it('runs the action then closes, and closes on Escape', () => {
		const onaction = vi.fn();
		const onclose = vi.fn();
		const target = render(PresentationContextMenu, { x: 0, y: 0, capabilities, onaction, onclose });
		rows(target)
			.find((row) => row.dataset.itemId === 'pointerPen')!
			.click();
		expect(onaction).toHaveBeenCalledWith('pointerPen');
		expect(onclose).toHaveBeenCalledOnce();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(onclose).toHaveBeenCalledTimes(2);
	});
});

describe('svelte thumbnail context menu', () => {
	it('shows the rail markers, counts and routes a command to the rail menu', () => {
		const slides = [0, 1, 2].map((i) => ({ id: `s${i}`, elements: [] })) as unknown as PptxSlide[];
		const menu = new ThumbnailRailMenu();
		menu.contextMenu = { x: 10, y: 20, index: 1, selectedIndexes: [0, 1] };
		const onduplicate = vi.fn();
		const target = render(ThumbnailContextMenu, {
			menu,
			slides,
			actions: { duplicateSlides: onduplicate },
		});
		const host = target.querySelector<HTMLElement>('pptx-ui-context-menu')!;
		expect(host.hasAttribute('data-pptx-slide-pane-context-menu')).toBeTruthy();
		expect(host.hasAttribute('data-pptx-context-menu')).toBeTruthy();
		rows(target)
			.find((row) => row.dataset.itemId === 'duplicate')!
			.click();
		expect(onduplicate).toHaveBeenCalledWith([0, 1]);
		expect(menu.contextMenu).toBeNull();
	});
});
