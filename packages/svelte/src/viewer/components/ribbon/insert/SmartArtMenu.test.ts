import type { CanvasSize } from 'pptx-viewer-shared';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import SmartArtMenu from './SmartArtMenu.svelte';

const CANVAS: CanvasSize = { width: 960, height: 540 };

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function makeEditor(editable = true): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = editable;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] }]);
	return editor;
}

function mountMenu(editor: EditorState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(SmartArtMenu, { target, props: { editor, canvasSize: CANVAS } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function clickButton(target: HTMLElement, text: string): void {
	const button = [...target.querySelectorAll<HTMLButtonElement>('button')].find(
		(candidate) => candidate.textContent?.trim() === text,
	);
	expect(button).toBeDefined();
	button?.click();
	flushSync();
}

describe('smartArtMenu', () => {
	it('opens the accessible SmartArt dialog from the ribbon trigger', () => {
		const target = mountMenu(makeEditor());
		const trigger = target.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]');
		expect(target.querySelector('[role="dialog"]')).toBeNull();

		trigger?.click();
		flushSync();

		const dialog = target.querySelector('[role="dialog"]');
		expect(dialog?.getAttribute('aria-label')).toBe('Insert SmartArt');
		expect(dialog?.getAttribute('aria-modal')).toBe('true');
		expect(trigger?.getAttribute('aria-expanded')).toBe('true');
	});

	it('disables the trigger when the editor is not editable', () => {
		const target = mountMenu(makeEditor(false));
		expect(target.querySelector('[aria-haspopup="dialog"]')?.hasAttribute('disabled')).toBeTruthy();
	});

	it('selects an option before inserting and exposes listbox state', () => {
		const editor = makeEditor();
		const target = mountMenu(editor);
		target.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')?.click();
		flushSync();

		const listbox = target.querySelector('[role="listbox"]');
		const options = listbox?.querySelectorAll<HTMLButtonElement>('[role="option"]');
		expect(listbox?.getAttribute('aria-label')).toBe('SmartArt layouts');
		expect(options?.length).toBeGreaterThan(0);
		expect(options?.[0]?.getAttribute('aria-selected')).toBe('false');

		options?.[0]?.click();
		flushSync();
		expect(options?.[0]?.getAttribute('aria-selected')).toBe('true');
		expect(editor.slides[0]?.elements).toHaveLength(0);

		clickButton(target, 'Insert');
		expect(editor.slides[0]?.elements[0]?.type).toBe('smartArt');
		expect(target.querySelector('[role="dialog"]')).toBeNull();
	});

	it('filters layouts by category and clears the current selection', () => {
		const target = mountMenu(makeEditor());
		target.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')?.click();
		flushSync();
		const firstOption = target.querySelector<HTMLButtonElement>('[role="option"]');
		firstOption?.click();
		flushSync();
		expect(firstOption?.getAttribute('aria-selected')).toBe('true');

		clickButton(target, 'Hierarchy');
		const options = target.querySelectorAll<HTMLButtonElement>('[role="option"]');
		expect(options).toHaveLength(1);
		expect(options[0]?.textContent).toContain('Hierarchy');
		expect(options[0]?.getAttribute('aria-selected')).toBe('false');
	});

	it('cancels without inserting and restores focus to the trigger', async () => {
		const editor = makeEditor();
		const target = mountMenu(editor);
		const trigger = target.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]');
		trigger?.click();
		flushSync();

		clickButton(target, 'Cancel');
		await tick();

		expect(target.querySelector('[role="dialog"]')).toBeNull();
		expect(editor.slides[0]?.elements).toHaveLength(0);
		expect(document.activeElement).toBe(trigger);
	});
});
