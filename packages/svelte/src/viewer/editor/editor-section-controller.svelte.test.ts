import type { PptxHandler, PptxSection, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { EditorState } from './editor-state.svelte';

function slide(id: string, sectionId?: string): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: Number(id), sectionId, elements: [] };
}

function setup(sections: PptxSection[] = []) {
	const save = vi.fn(async () => new Uint8Array([1]));
	const editor = new EditorState({
		getCurrent: () => 1,
		getHandler: () => ({ save }) as unknown as PptxHandler,
	});
	editor.editable = true;
	editor.setSlides([slide('1'), slide('2'), slide('3')], [], undefined, undefined, sections);
	return { editor, save };
}

describe('editorSectionController', () => {
	it('adds, renames, moves, collapses, and deletes sections with history', () => {
		const { editor } = setup();
		const id = editor.sectionOps.add('Part 2');
		expect(id).toBeTruthy();
		expect(editor.sections[0].name).toBe('Part 2');
		expect(editor.slides.map((item) => item.sectionId)).toStrictEqual([undefined, id, id]);

		editor.sectionOps.rename(id!, 'Closing');
		expect(editor.sections[0].name).toBe('Closing');
		expect(editor.slides[1].sectionName).toBe('Closing');

		editor.sectionOps.toggle(id!);
		expect(editor.sections[0].collapsed).toBeTruthy();
		editor.sectionOps.delete(id!);
		expect(editor.sections).toStrictEqual([]);
		expect(editor.canUndo).toBeTruthy();
	});

	it('includes sections in document saves', async () => {
		const { editor, save } = setup();
		editor.sectionOps.add('Part 2');
		await editor.save();
		expect(save.mock.calls[0]?.[1]).toMatchObject({ sections: editor.sections });
	});
});
