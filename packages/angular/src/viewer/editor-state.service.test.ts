import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { SLIDE_TEMPLATES } from '../internal/shared';
import { EditorStateService } from './editor-state.service';

function element(id: string, x = 0, y = 0): PptxElement {
	return { type: 'shape', id, name: '', x, y, width: 100, height: 50 } as PptxElement;
}

function group(id: string, children: PptxElement[]): PptxElement {
	return {
		type: 'group',
		id,
		name: '',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		children,
	} as PptxElement;
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

	it('moves slides between sections with undo support', () => {
		const svc = new EditorStateService();
		const slides = [slide('s1', []), slide('s2', []), slide('s3', [])];
		slides[0].sectionId = 'a';
		slides[1].sectionId = 'b';
		slides[2].sectionId = 'b';
		svc.setSlides(slides, [
			{ id: 'a', name: 'A', slideIds: ['1'] },
			{ id: 'b', name: 'B', slideIds: ['2', '3'] },
		]);

		svc.sectionOps.moveSlides([0], 'b');
		expect(svc.slides()[0]).toMatchObject({ sectionId: 'b', sectionName: 'B' });
		expect(svc.sections()[0].slideIds).toStrictEqual([]);
		expect(svc.sections()[1].slideIds).toStrictEqual(['2', '3', '1']);
		svc.undo();
		expect(svc.slides()[0].sectionId).toBe('a');
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

	it('inserts a template slide after the given index with elements and undo support', () => {
		const svc = deck();
		svc.insertSlideFromTemplate(0, 'title');
		expect(svc.slides()).toHaveLength(3);
		// The template slide lands AFTER the given index and carries content.
		const inserted = svc.slides()[1];
		expect(inserted.id).not.toBe('s2');
		expect(inserted.elements.length).toBeGreaterThan(0);
		expect(inserted.backgroundColor).toBeTruthy();
		expect(svc.slides().map((s) => s.slideNumber)).toStrictEqual([1, 2, 3]);
		expect(svc.canUndo()).toBeTruthy();
		expect(svc.undoLabel()).toBe('Insert slide from template');
		svc.undo();
		expect(svc.slides().map((s) => s.id)).toStrictEqual(['s1', 's2']);
	});

	it('inserts a distinct slide for every catalogued template (12 gallery options)', () => {
		expect(SLIDE_TEMPLATES).toHaveLength(12);
		const svc = deck();
		for (const spec of SLIDE_TEMPLATES) {
			svc.insertSlideFromTemplate(0, spec.id);
		}
		expect(svc.slides()).toHaveLength(2 + SLIDE_TEMPLATES.length);
		const ids = svc.slides().map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
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
		expect(pasted.x).toBe(20); // original a.x (0) + shared PASTE_OFFSET_PX
		expect(svc.selectedIds()).toStrictEqual([pasted.id]);
	});

	it('re-ids every descendant of a pasted group, not just the root', () => {
		const svc = new EditorStateService();
		svc.setSlides([slide('s1', [group('g', [element('child-1'), element('child-2')])])]);
		svc.select(['g']);
		svc.copySelected(0);
		svc.paste(0);
		const els = svc.slides()[0].elements;
		expect(els).toHaveLength(2);
		const pastedGroup = els[1] as PptxElement & { children: PptxElement[] };
		expect(pastedGroup.id).not.toBe('g');
		const childIds = pastedGroup.children.map((c) => c.id);
		expect(childIds).not.toContain('child-1');
		expect(childIds).not.toContain('child-2');
		expect(new Set(childIds).size).toBe(2);
	});

	it('cuts elements (copy then delete)', () => {
		const svc = service();
		svc.select(['b']);
		svc.cutSelected(0);
		expect(svc.slides()[0].elements.map((e) => e.id)).toStrictEqual(['a', 'c']);
		svc.paste(0);
		expect(svc.slides()[0].elements).toHaveLength(3);
	});

	// G10 (OpenXML parity audit, D3): a:spLocks/a:grpSpLocks/@noGrouping was
	// parsed but never checked by groupSelected/ungroupSelected.
	it('rejects grouping when a selected shape carries noGrouping', () => {
		const locked = { ...element('a'), locks: { noGrouping: true } };
		const svc = new EditorStateService();
		svc.setSlides([slide('s1', [locked, element('b', 200)])]);
		svc.select(['a', 'b']);
		svc.groupSelected(0);
		expect(svc.slides()[0].elements.map((el) => el.type)).toStrictEqual(['shape', 'shape']);
		expect(svc.dirty()).toBeFalsy();
	});

	it('groups an unlocked selection normally', () => {
		const svc = service();
		svc.select(['a', 'b']);
		svc.groupSelected(0);
		expect(svc.slides()[0].elements.some((el) => el.type === 'group')).toBeTruthy();
	});

	it('refuses to ungroup a group whose own noGrouping lock is set', () => {
		const locked = {
			...group('g', [element('c1'), element('c2', 200)]),
			locks: { noGrouping: true },
		};
		const svc = new EditorStateService();
		svc.setSlides([slide('s1', [locked])]);
		svc.select(['g']);
		svc.ungroupSelected(0);
		expect(svc.slides()[0].elements).toStrictEqual([locked]);
		expect(svc.dirty()).toBeFalsy();
	});

	it('ungroups an unlocked group normally', () => {
		const svc = new EditorStateService();
		svc.setSlides([slide('s1', [group('g', [element('c1'), element('c2', 200)])])]);
		svc.select(['g']);
		svc.ungroupSelected(0);
		expect(svc.slides()[0].elements.some((el) => el.type === 'group')).toBeFalsy();
	});
});
