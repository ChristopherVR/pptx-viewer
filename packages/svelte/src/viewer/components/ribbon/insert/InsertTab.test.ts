import type { CanvasSize } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import InsertTab from './InsertTab.svelte';

/**
 * InsertTab tests: the orchestrator wiring. Text box / table (unchanged
 * one-click inserts) and the two file-picker actions (image / media) that
 * stay owned by this file rather than a subcomponent, plus the equation
 * panel's open/close toggle. The dropdown/grid subcomponents (ShapePicker,
 * ChartMenu, SmartArtMenu, ActionButtonMenu, FieldMenu, EquationEditorDialog) each
 * have their own focused test file.
 */

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

function mountTab(editor: EditorState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(InsertTab, { target, props: { editor, canvasSize: CANVAS } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function fireChange(input: HTMLInputElement, file: File): void {
	Object.defineProperty(input, 'files', { value: [file], configurable: true });
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('insertTab', () => {
	it('inserts a text box on click', () => {
		const editor = makeEditor();
		const target = mountTab(editor);
		target.querySelector('button')?.click();
		flushSync();
		expect(editor.slides[0]?.elements[0]?.type).toBe('text');
	});

	it('inserts a 3x3 table via the table button', () => {
		const editor = makeEditor();
		const target = mountTab(editor);
		// Named by its visible text, not an aria-label: the ribbon-inventory
		// contract is that every binding calls this button "Table".
		const tableBtn = Array.from(target.querySelectorAll('button')).find(
			(b) => b.textContent?.trim() === 'Table',
		);
		tableBtn?.click();
		flushSync();
		expect(editor.slides[0]?.elements[0]?.type).toBe('table');
	});

	it('inserts a media element from the audio/video file input', async () => {
		const editor = makeEditor();
		const target = mountTab(editor);
		const mediaInput = target.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
		if (!mediaInput) {
			throw new Error('media input not found');
		}
		const file = new File(['fake-audio'], 'clip.mp3', { type: 'audio/mpeg' });
		fireChange(mediaInput, file);

		// The file -> data URL -> element pipeline runs through FileReader's
		// async event, so poll until the insert lands.
		await vi.waitFor(() => {
			flushSync();
			expect(editor.slides[0]?.elements).toHaveLength(1);
		});

		expect(editor.slides[0]?.elements[0]?.type).toBe('media');
	});

	it('toggles the docked equation panel open/closed', () => {
		const target = mountTab(makeEditor());
		expect(target.querySelector('[role="dialog"]')).toBeNull();

		const equationBtn = Array.from(target.querySelectorAll('button')).find(
			(b) => b.getAttribute('aria-haspopup') === 'dialog',
		);
		equationBtn?.click();
		flushSync();
		expect(target.querySelector('[role="dialog"]')).not.toBeNull();

		equationBtn?.click();
		flushSync();
		expect(target.querySelector('[role="dialog"]')).toBeNull();
	});
});
