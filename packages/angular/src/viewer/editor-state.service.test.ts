import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorStateService } from './editor-state.service';

function element(id: string, x = 0, y = 0): PptxElement {
	return { type: 'shape', id, name: '', x, y, width: 100, height: 50 } as PptxElement;
}

function slide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements } as PptxSlide;
}

function service(): EditorStateService {
	const svc = new EditorStateService();
	svc.setSlides([slide('s1', [element('a'), element('b'), element('c')])]);
	return svc;
}

describe('editorStateService', () => {
	it('clones slides on load (source mutation does not leak in)', () => {
		const svc = new EditorStateService();
		const src = [slide('s1', [element('a')])];
		svc.setSlides(src);
		src[0].elements[0].x = 999;
		expect(svc.slides()[0].elements[0].x).toBe(0);
		expect(svc.dirty()).toBeFalsy();
		expect(svc.canUndo()).toBeFalsy();
	});

	it('toggles selection (single + additive)', () => {
		const svc = service();
		svc.toggleSelect('a', false);
		expect(svc.selectedIds()).toStrictEqual(['a']);
		svc.toggleSelect('b', true);
		expect(svc.selectedIds()).toStrictEqual(['a', 'b']);
		svc.toggleSelect('a', true);
		expect(svc.selectedIds()).toStrictEqual(['b']);
		svc.toggleSelect('b', false);
		expect(svc.selectedIds()).toStrictEqual([]);
	});

	it('deletes the selection and supports undo/redo', () => {
		const svc = service();
		svc.select(['b']);
		svc.deleteSelected(0);
		expect(svc.slides()[0].elements.map((e) => e.id)).toStrictEqual(['a', 'c']);
		expect(svc.dirty()).toBeTruthy();
		expect(svc.canUndo()).toBeTruthy();
		expect(svc.undoLabel()).toBe('Delete');

		svc.undo();
		expect(svc.slides()[0].elements.map((e) => e.id)).toStrictEqual(['a', 'b', 'c']);
		expect(svc.canRedo()).toBeTruthy();

		svc.redo();
		expect(svc.slides()[0].elements.map((e) => e.id)).toStrictEqual(['a', 'c']);
	});

	it('moves the selection and undoes the move', () => {
		const svc = service();
		svc.select(['a']);
		svc.moveSelectedBy(0, 10, 5);
		expect(svc.slides()[0].elements[0]).toMatchObject({ x: 10, y: 5 });
		svc.undo();
		expect(svc.slides()[0].elements[0]).toMatchObject({ x: 0, y: 0 });
	});

	it('duplicates the selection and selects the copies', () => {
		const svc = service();
		svc.select(['a']);
		svc.duplicateSelected(0);
		expect(svc.slides()[0].elements).toHaveLength(4);
		expect(svc.selectedIds()).toHaveLength(1);
		// The new id is not one of the originals.
		expect(['a', 'b', 'c']).not.toContain(svc.selectedIds()[0]);
	});

	it('reorders z-index (bring to front / send to back)', () => {
		const svc = service();
		svc.select(['a']);
		svc.bringSelectedToFront(0);
		expect(svc.slides()[0].elements.map((e) => e.id)).toStrictEqual(['b', 'c', 'a']);
		svc.sendSelectedToBack(0);
		expect(svc.slides()[0].elements.map((e) => e.id)).toStrictEqual(['a', 'b', 'c']);
	});

	it('no-ops element ops when nothing is selected', () => {
		const svc = service();
		svc.deleteSelected(0);
		expect(svc.slides()[0].elements).toHaveLength(3);
		expect(svc.canUndo()).toBeFalsy();
	});
});
