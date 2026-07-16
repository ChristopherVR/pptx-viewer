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
	it('manages sections as undoable editor state', () => {
		const svc = new EditorStateService();
		svc.setSlides([slide('s1', []), slide('s2', []), slide('s3', [])]);

		svc.sectionOps.add(1, 'Part 2');
		const sectionId = svc.sections()[0]?.id;
		expect(sectionId).toBeTruthy();
		expect(svc.slides().map((item) => item.sectionId)).toStrictEqual([
			undefined,
			sectionId,
			sectionId,
		]);

		svc.sectionOps.rename(sectionId!, 'Closing');
		expect(svc.sections()[0]?.name).toBe('Closing');
		svc.sectionOps.toggle(sectionId!);
		expect(svc.sections()[0]?.collapsed).toBeTruthy();
		svc.sectionOps.delete(sectionId!);
		expect(svc.sections()).toStrictEqual([]);
		svc.undo();
		expect(svc.sections()[0]?.id).toBe(sectionId);
	});

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

	it('adds an element and selects it', () => {
		const svc = service();
		svc.addElement(0, element('x', 5, 5));
		const els = svc.slides()[0].elements;
		expect(els.map((e) => e.id)).toStrictEqual(['a', 'b', 'c', 'x']);
		expect(svc.selectedIds()).toStrictEqual(['x']);
		svc.undo();
		expect(svc.slides()[0].elements).toHaveLength(3);
	});

	function deck(): EditorStateService {
		const svc = new EditorStateService();
		svc.setSlides([slide('s1', [element('a')]), slide('s2', [element('b')])]);
		return svc;
	}

	it('adds a blank slide after the given index and renumbers', () => {
		const svc = deck();
		svc.addSlide(0);
		expect(svc.slides()).toHaveLength(3);
		expect(svc.slides()[1].elements).toHaveLength(0);
		expect(svc.slides().map((s) => s.slideNumber)).toStrictEqual([1, 2, 3]);
		svc.undo();
		expect(svc.slides()).toHaveLength(2);
	});

	it('deletes a slide but keeps at least one', () => {
		const svc = deck();
		svc.deleteSlide(0);
		expect(svc.slides().map((s) => s.id)).toStrictEqual(['s2']);
		svc.deleteSlide(0);
		// last slide is not deletable
		expect(svc.slides()).toHaveLength(1);
	});

	it('duplicates a slide with a fresh id', () => {
		const svc = deck();
		svc.duplicateSlide(0);
		expect(svc.slides()).toHaveLength(3);
		expect(svc.slides()[1].id).not.toBe('s1');
		expect(svc.slides()[1].elements.map((e) => e.id)).toStrictEqual(['a']);
	});

	it('reorders slides', () => {
		const svc = deck();
		svc.moveSlide(0, 1);
		expect(svc.slides().map((s) => s.id)).toStrictEqual(['s2', 's1']);
	});

	it('copies and pastes elements (offset + fresh ids, selected)', () => {
		const svc = service();
		svc.select(['a']);
		svc.copySelected(0);
		expect(svc.hasClipboard()).toBeTruthy();
		svc.paste(0);
		const els = svc.slides()[0].elements;
		expect(els).toHaveLength(4);
		const pasted = els[3];
		expect(pasted.id).not.toBe('a');
		expect(pasted.x).toBe(12); // original a.x (0) + 12 paste offset
		expect(svc.selectedIds()).toStrictEqual([pasted.id]);
	});

	it('cuts elements (copy then delete)', () => {
		const svc = service();
		svc.select(['b']);
		svc.cutSelected(0);
		expect(svc.slides()[0].elements.map((e) => e.id)).toStrictEqual(['a', 'c']);
		svc.paste(0);
		expect(svc.slides()[0].elements).toHaveLength(3);
	});
});
