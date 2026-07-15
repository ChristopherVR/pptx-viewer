import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../editor/editor-state.svelte';
import InspectorPanel from './InspectorPanel.svelte';

/**
 * InspectorPanel tests: the orchestrator that gates each element-type-aware
 * section (Fill & Stroke, and more as they land) on the selected element's
 * `type` discriminant, plus the always-present Position section and the
 * empty/no-selection state. Named `*.svelte.test.ts` per the mounted-props
 * convention (see `notes-panel.svelte.test.ts`); here the selection itself
 * changes reactively via `editor.select(...)`, which the panel's own
 * `$derived(editor.selectedElement)` already tracks, so no manual prop
 * refresh is needed between assertions.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function shapeEl(): PptxElement {
	return {
		type: 'shape',
		id: 's1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: {},
	} as PptxElement;
}

function textEl(): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'hi',
		textStyle: {},
	} as PptxElement;
}

function imageEl(): PptxElement {
	return {
		type: 'image',
		id: 'img1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		imagePath: 'ppt/media/image1.png',
	} as PptxElement;
}

function tableEl(): PptxElement {
	return {
		type: 'table',
		id: 'tbl1',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		tableData: { rows: [{ cells: [{ text: 'A' }] }], columnWidths: [1] },
	} as PptxElement;
}

function makeEditor(elements: PptxElement[]): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements }]);
	return editor;
}

function mountInspector(editor: EditorState): { target: HTMLElement } {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(InspectorPanel, { target, props: { editor } });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target };
}

function sectionTitles(target: HTMLElement): string[] {
	return Array.from(target.querySelectorAll('.pptx-svelte-inspector-section h4')).map(
		(h) => h.textContent ?? '',
	);
}

describe('inspectorPanel', () => {
	it('shows the empty state when nothing is selected', () => {
		const editor = makeEditor([shapeEl()]);
		const { target } = mountInspector(editor);

		expect(target.querySelector('aside')?.getAttribute('aria-label')).toBe('Properties');
		expect(target.querySelector('.pptx-svelte-inspector-empty')).not.toBeNull();
		expect(target.querySelector('.pptx-svelte-inspector-grid')).toBeNull();
	});

	it('shows Position + Fill & Stroke + Text for a shape element (shapes carry text properties too)', () => {
		const el = shapeEl();
		const editor = makeEditor([el]);
		editor.select(el.id);
		const { target } = mountInspector(editor);

		expect(target.querySelector('.pptx-svelte-inspector-grid')).not.toBeNull();
		expect(sectionTitles(target)).toStrictEqual(['Fill & Stroke', 'Text']);
		expect(target.querySelector('.pptx-svelte-inspector-empty')).toBeNull();
	});

	it('shows Position + Fill & Stroke + Text for a text element (text has shapeStyle too)', () => {
		const el = textEl();
		const editor = makeEditor([el]);
		editor.select(el.id);
		const { target } = mountInspector(editor);

		expect(sectionTitles(target)).toStrictEqual(['Fill & Stroke', 'Text']);
	});

	it('shows Position + Fill & Stroke + Image for an image element (no Text section)', () => {
		const el = imageEl();
		const editor = makeEditor([el]);
		editor.select(el.id);
		const { target } = mountInspector(editor);

		expect(sectionTitles(target)).toStrictEqual(['Fill & Stroke', 'Image']);
	});

	it('shows only Position + Table for a table element (no Fill & Stroke or Text)', () => {
		const el = tableEl();
		const editor = makeEditor([el]);
		editor.select(el.id);
		const { target } = mountInspector(editor);

		expect(sectionTitles(target)).toStrictEqual(['Table']);
	});

	it('collapses and expands via the header toggle', () => {
		const el = shapeEl();
		const editor = makeEditor([el]);
		editor.select(el.id);
		const { target } = mountInspector(editor);

		const header = target.querySelector<HTMLButtonElement>('.pptx-svelte-inspector-header');
		expect(header?.getAttribute('aria-expanded')).toBe('true');
		header?.click();
		flushSync();
		expect(header?.getAttribute('aria-expanded')).toBe('false');
		expect(target.querySelector('.pptx-svelte-inspector-body')).toBeNull();
	});
});
