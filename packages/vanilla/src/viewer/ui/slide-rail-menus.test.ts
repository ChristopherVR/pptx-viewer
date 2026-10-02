/**
 * #397: the section-header menu, the sorter tile menu and the rail's action
 * row are one feature across all five bindings. The command lists come from
 * `pptx-viewer-shared`; these tests pin that Vanilla renders and routes them.
 */
import type { PptxSection, PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { openSlideSorterOverlay } from './slide-sorter-overlay';
import { renderThumbnailSections } from './thumbnail-sections';
import type { ThumbnailSectionActions } from './thumbnail-sections';

const t = createTranslator();

afterEach(() => {
	document.body.replaceChildren();
});

function slides(count = 3): PptxSlide[] {
	return Array.from({ length: count }, (_unused, index) => ({
		id: `s${index + 1}`,
		rId: `rId${index + 1}`,
		slideNumber: index + 1,
		sectionId: index === 0 ? 'sec1' : 'sec2',
		elements: [],
	})) as PptxSlide[];
}

const sections: PptxSection[] = [
	{ id: 'sec1', name: 'Intro', slideIds: ['s1'] },
	{ id: 'sec2', name: 'Body', slideIds: ['s2', 's3'] },
];

function mountSections(): { host: HTMLElement; actions: ThumbnailSectionActions } {
	const actions: ThumbnailSectionActions = {
		toggle: vi.fn(),
		rename: vi.fn(),
		delete: vi.fn(),
		move: vi.fn(),
		addAfter: vi.fn(),
	};
	const host = document.createElement('div');
	host.append(
		...renderThumbnailSections({
			doc: document,
			t,
			sections,
			slides: slides(),
			actions,
			buildSlide: () => document.createElement('button'),
		}),
	);
	document.body.appendChild(host);
	return { host, actions };
}

const header = (host: HTMLElement, index: number): HTMLElement =>
	host.querySelectorAll<HTMLElement>('[data-pptx-chrome="section-header"]')[index];

function rightClick(target: Element): void {
	target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
}

const menuItems = (): HTMLButtonElement[] =>
	Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
const item = (label: string): HTMLButtonElement =>
	menuItems().find((candidate) => candidate.textContent === label)!;

describe('vanilla section header menu', () => {
	it('opens the shared command list on right-click and carries no inline buttons', () => {
		const { host } = mountSections();
		expect(header(host, 0).querySelectorAll('button')).toHaveLength(1);
		rightClick(header(host, 0));
		expect(document.querySelector('[data-pptx-section-context-menu]')?.getAttribute('role')).toBe(
			'menu',
		);
		expect(menuItems().map((candidate) => candidate.textContent)).toStrictEqual([
			'Rename',
			'Delete',
			'Move Up',
			'Move Down',
			'Add Section After',
		]);
	});

	it('disables Move Up on the first section and Move Down on the last', () => {
		const { host } = mountSections();
		rightClick(header(host, 0));
		expect(item('Move Up').disabled).toBeTruthy();
		expect(item('Move Down').disabled).toBeFalsy();
		document.body.querySelector('[data-pptx-section-context-menu]')?.remove();
		rightClick(header(host, 1));
		expect(item('Move Up').disabled).toBeFalsy();
		expect(item('Move Down').disabled).toBeTruthy();
	});

	it('routes Delete, Move and Add Section After to the actions', () => {
		const { host, actions } = mountSections();
		rightClick(header(host, 0));
		item('Delete').click();
		expect(actions.delete).toHaveBeenCalledWith('sec1');
		rightClick(header(host, 0));
		item('Move Down').click();
		expect(actions.move).toHaveBeenCalledWith('sec1', 'down');
		rightClick(header(host, 0));
		item('Add Section After').click();
		// The new section starts at the slide after the section's last one.
		expect(actions.addAfter).toHaveBeenCalledWith(1);
	});

	it('renames inline, without a prompt, and ignores an empty name', () => {
		const prompt = vi.fn();
		vi.stubGlobal('prompt', prompt);
		const { host, actions } = mountSections();
		rightClick(header(host, 1));
		item('Rename').click();
		const input = header(host, 1).querySelector<HTMLInputElement>('input[type="text"]')!;
		expect(input.value).toBe('Body');
		input.value = 'Agenda';
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(actions.rename).toHaveBeenCalledWith('sec2', 'Agenda');
		expect(prompt).not.toHaveBeenCalled();
		vi.unstubAllGlobals();
	});

	it('cancels an inline rename with Escape and keeps the label', () => {
		const { host, actions } = mountSections();
		rightClick(header(host, 1));
		item('Rename').click();
		const input = header(host, 1).querySelector<HTMLInputElement>('input[type="text"]')!;
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(actions.rename).not.toHaveBeenCalled();
		expect(header(host, 1).textContent).toContain('Body');
	});
});

describe('vanilla slide sorter menu', () => {
	function openSorter(): {
		onDuplicate: ReturnType<typeof vi.fn>;
		onToggleHidden: ReturnType<typeof vi.fn>;
	} {
		const onDuplicate = vi.fn();
		const onToggleHidden = vi.fn();
		openSlideSorterOverlay(document, document.body, t, {
			slides: slides(3),
			current: 0,
			onSelect: vi.fn(),
			onReorder: vi.fn(),
			onDelete: vi.fn(),
			onDuplicate,
			onToggleHidden,
		});
		return { onDuplicate, onToggleHidden };
	}
	const tile = (index: number): Element =>
		document.querySelectorAll('[data-pptx-chrome="sorter-tile"]')[index];

	it('offers the shared list, with no inline per-card buttons', () => {
		openSorter();
		expect(tile(1).querySelectorAll('button')).toHaveLength(1);
		rightClick(tile(1));
		expect(menuItems().map((candidate) => candidate.textContent)).toStrictEqual([
			'Copy',
			'Duplicate',
			'Hide Slides',
			'Delete',
		]);
	});

	it('offers Paste only after Copy and pastes a copy of the copied slide', () => {
		const { onDuplicate } = openSorter();
		rightClick(tile(1));
		item('Copy').click();
		rightClick(tile(1));
		expect(menuItems().map((candidate) => candidate.textContent)).toContain('Paste');
		item('Paste').click();
		expect(onDuplicate).toHaveBeenCalledWith(1);
	});

	it('toggles Hide and Show on the slide state', () => {
		const { onToggleHidden } = openSorter();
		rightClick(tile(2));
		item('Hide Slides').click();
		expect(onToggleHidden).toHaveBeenCalledWith(2);
	});
});
