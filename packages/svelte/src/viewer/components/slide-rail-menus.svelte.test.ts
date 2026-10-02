/**
 * #397: the section-header menu, the sorter tile menu and the rail's action
 * row are one feature across all five bindings. The command lists come from
 * `pptx-viewer-shared`; these tests pin that Svelte renders and routes them.
 */
import type { PptxSection, PptxSlide } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SlideSorterOverlay from './SlideSorterOverlay.svelte';
import ThumbnailRail from './ThumbnailRail.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	vi.unstubAllGlobals();
	document.body.replaceChildren();
});

const CANVAS = { width: 960, height: 540 };

function deck(count = 3): PptxSlide[] {
	return Array.from(
		{ length: count },
		(_unused, index) =>
			({
				id: `s${index + 1}`,
				rId: `rId${index + 1}`,
				slideNumber: index + 1,
				sectionId: index === 0 ? 'sec1' : 'sec2',
				elements: [],
			}) as PptxSlide,
	);
}

const sections = [
	{ id: 'sec1', name: 'Intro', slideIds: ['s1'] },
	{ id: 'sec2', name: 'Body', slideIds: ['s2', 's3'] },
] as PptxSection[];

function render(component: never, props: Record<string, unknown>): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(component, { target, props });
	cleanup = () => {
		void unmount(instance);
		target.remove();
	};
	flushSync();
	return target;
}

function rightClick(target: Element): void {
	target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
	flushSync();
}

const items = (): HTMLButtonElement[] =>
	Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menu"] [role="menuitem"]'));
const item = (label: string): HTMLButtonElement =>
	items().find((candidate) => candidate.textContent?.trim() === label)!;
const labels = (): (string | undefined)[] => items().map((node) => node.textContent?.trim());

function rail(extra: Record<string, unknown> = {}): HTMLElement {
	return render(ThumbnailRail as never, {
		slides: deck(),
		canvasSize: CANVAS,
		mediaDataUrls: new Map<string, string>(),
		current: 0,
		sections,
		editable: true,
		onselect: () => undefined,
		onaddslide: () => undefined,
		...extra,
	});
}

const headers = (target: HTMLElement): HTMLElement[] =>
	Array.from(target.querySelectorAll<HTMLElement>('[data-pptx-chrome="section-header"]'));

describe('svelte section header menu', () => {
	it('opens the shared five-command menu and carries no inline buttons', () => {
		const target = rail();
		expect(headers(target)[0].querySelectorAll('button')).toHaveLength(1);
		rightClick(headers(target)[0]);
		expect(document.querySelector('[data-pptx-section-context-menu]')?.getAttribute('role')).toBe(
			'menu',
		);
		expect(labels()).toStrictEqual([
			'Rename',
			'Delete',
			'Move Up',
			'Move Down',
			'Add Section After',
		]);
	});

	it('gates Move Up on the first section and Move Down on the last', () => {
		const target = rail();
		rightClick(headers(target)[0]);
		expect(item('Move Up').disabled).toBeTruthy();
		expect(item('Move Down').disabled).toBeFalsy();
		item('Delete').click();
		flushSync();
		rightClick(headers(target)[1]);
		expect(item('Move Up').disabled).toBeFalsy();
		expect(item('Move Down').disabled).toBeTruthy();
	});

	it('routes Delete, Move and Add Section After to the host', () => {
		const onsectiondelete = vi.fn();
		const onsectionmove = vi.fn();
		const onaddsectionat = vi.fn();
		const target = rail({ onsectiondelete, onsectionmove, onaddsectionat });
		rightClick(headers(target)[0]);
		item('Delete').click();
		flushSync();
		rightClick(headers(target)[0]);
		item('Move Down').click();
		flushSync();
		rightClick(headers(target)[0]);
		item('Add Section After').click();
		flushSync();
		expect(onsectiondelete).toHaveBeenCalledWith('sec1');
		expect(onsectionmove).toHaveBeenCalledWith('sec1', 'down');
		expect(onaddsectionat).toHaveBeenCalledWith(1);
	});

	it('renames inline without a prompt', () => {
		const prompt = vi.fn();
		vi.stubGlobal('prompt', prompt);
		const onsectionrename = vi.fn();
		const target = rail({ onsectionrename });
		rightClick(headers(target)[1]);
		item('Rename').click();
		flushSync();
		const input = headers(target)[1].querySelector<HTMLInputElement>('input[type="text"]')!;
		expect(input.value).toBe('Body');
		input.value = 'Agenda';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		flushSync();
		expect(onsectionrename).toHaveBeenCalledWith('sec2', 'Agenda');
		expect(prompt).not.toHaveBeenCalled();
	});
});

describe('svelte slide rail footer', () => {
	it('holds only Add Slide', () => {
		const target = rail();
		const buttons = target.querySelectorAll('[data-pptx-chrome="slide-footer"] button');
		expect(buttons).toHaveLength(1);
		expect(buttons[0].textContent?.trim()).toBe('Add Slide');
	});
});

describe('svelte slide sorter menu', () => {
	function sorter() {
		const onduplicate = vi.fn();
		const ontogglehidden = vi.fn();
		const target = render(SlideSorterOverlay as never, {
			slides: deck(),
			canvasSize: CANVAS,
			mediaDataUrls: new Map<string, string>(),
			current: 0,
			canEdit: true,
			onselect: () => undefined,
			onmove: () => undefined,
			ondelete: () => undefined,
			onduplicate,
			ontogglehidden,
			onclose: () => undefined,
		});
		const tile = (index: number): Element =>
			target.querySelectorAll('[data-pptx-chrome="sorter-tile"]')[index];
		return { tile, onduplicate, ontogglehidden };
	}

	it('offers the shared list and no inline per-card action buttons', () => {
		const { tile } = sorter();
		rightClick(tile(1));
		expect(labels()).toStrictEqual(['Copy', 'Duplicate', 'Hide Slides', 'Delete']);
		expect(document.querySelector('[data-pptx-sorter-context-menu]')).not.toBeNull();
	});

	it('offers Paste only after Copy and pastes a copy of the copied slide', () => {
		const { tile, onduplicate } = sorter();
		rightClick(tile(1));
		item('Copy').click();
		flushSync();
		rightClick(tile(2));
		expect(labels()).toContain('Paste');
		item('Paste').click();
		flushSync();
		expect(onduplicate).toHaveBeenCalledWith(1);
	});

	it('routes Hide to the right-clicked slide', () => {
		const { tile, ontogglehidden } = sorter();
		rightClick(tile(2));
		item('Hide Slides').click();
		flushSync();
		expect(ontogglehidden).toHaveBeenCalledWith(2);
	});
});
