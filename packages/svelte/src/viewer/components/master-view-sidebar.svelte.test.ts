import type { PptxHandoutMaster, PptxNotesMaster, PptxSlideMaster } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../editor/editor-state.svelte';
import MasterViewSidebar from './MasterViewSidebar.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountSidebar() {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	const slides: PptxSlideMaster[] = [{ path: 'master.xml', name: 'Primary', elements: [] }];
	const notes: PptxNotesMaster = { path: 'notes.xml', placeholders: [{ type: 'body' }] };
	const handout: PptxHandoutMaster = { path: 'handout.xml', slidesPerPage: 6 };
	editor.setSlides([], slides, notes, handout);
	editor.masterOps.enter();
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(MasterViewSidebar, {
		target,
		props: { editor, canvasSize: { width: 960, height: 540 }, mediaDataUrls: new Map() },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, editor };
}

describe('masterViewSidebar', () => {
	it('exposes the three accessible master navigation tabs', () => {
		const { target } = mountSidebar();
		const tabs = target.querySelectorAll('[role="tab"]');
		expect(tabs).toHaveLength(3);
		expect(Array.from(tabs).map((tab) => tab.textContent?.trim())).toStrictEqual([
			'Slides',
			'Notes',
			'Handout',
		]);
		expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
	});

	it('switches panels and history-tracks handout layout selection', () => {
		const { target, editor } = mountSidebar();
		target.querySelector<HTMLButtonElement>('[data-testid="master-tab-notes"]')?.click();
		flushSync();
		expect(editor.masterViewTarget?.tab).toBe('notes');
		expect(target.querySelector('[data-testid="notes-master-panel"]')).not.toBeNull();

		target.querySelector<HTMLButtonElement>('[data-testid="master-tab-handout"]')?.click();
		flushSync();
		const four = Array.from(target.querySelectorAll<HTMLButtonElement>('.options button')).find(
			(button) => button.textContent === '4',
		);
		four?.click();
		flushSync();
		expect(editor.handoutMaster?.slidesPerPage).toBe(4);
		expect(editor.canUndo).toBeTruthy();
		editor.undo();
		expect(editor.handoutMaster?.slidesPerPage).toBe(6);
	});

	it('closes the master workspace from the canonical collapse hook', () => {
		const { target, editor } = mountSidebar();
		target.querySelector<HTMLButtonElement>('[data-testid="master-collapse"]')?.click();
		expect(editor.masterViewTarget).toBeNull();
	});
});
