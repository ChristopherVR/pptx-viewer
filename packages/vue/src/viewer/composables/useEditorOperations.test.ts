// These are Vue composables (Composition API), not React hooks; the react-hooks
// rule misfires on the `useX` naming when invoked inside a test `setup` fn.
// oxlint-disable react-hooks/rules-of-hooks
import type { PptxElement, PptxSlide, SmartArtPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref, shallowRef } from 'vue';

import { useEditorHistory } from './useEditorHistory';
import { useEditorOperations } from './useEditorOperations';

function shapeEl(id: string, x = 0): PptxElement {
	return {
		type: 'shape',
		id,
		x,
		y: 0,
		width: 100,
		height: 50,
	} as PptxElement;
}

function textEl(id: string, text: string): PptxElement {
	return {
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text,
		textSegments: [{ text, style: { bold: true } }],
	} as PptxElement;
}

function smartArtEl(id: string): SmartArtPptxElement {
	return {
		type: 'smartArt',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		smartArtData: {
			nodes: [
				{ id: 'n1', text: 'one' },
				{ id: 'n2', text: 'two' },
			],
		},
	} as SmartArtPptxElement;
}

function slide(id: string, elements: PptxElement[] = []): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements };
}

function setup(elements: PptxElement[] = []) {
	const slides = shallowRef<PptxSlide[]>([slide('s1', elements)]);
	const activeSlideIndex = ref(0);
	const history = useEditorHistory(slides);
	const ops = useEditorOperations({
		slides,
		activeSlideIndex,
		pushHistory: history.pushHistory,
	});
	const ids = () => slides.value[0].elements.map((e) => e.id);
	return { slides, activeSlideIndex, history, ops, ids };
}

describe('useEditorOperations - CRUD', () => {
	it('addElement appends and selects the new element', () => {
		const { ops, ids, history } = setup([shapeEl('a')]);
		ops.addElement(shapeEl('b'));
		expect(ids()).toStrictEqual(['a', 'b']);
		expect(ops.selectedElementIds.value).toStrictEqual(['b']);
		expect(history.canUndo.value).toBeTruthy();
	});

	it('updateElement shallow-merges patch into the target', () => {
		const { ops, slides } = setup([shapeEl('a', 5)]);
		ops.updateElement('a', { x: 42 });
		expect(slides.value[0].elements[0].x).toBe(42);
	});

	it('removeElement deletes and deselects', () => {
		const { ops, ids } = setup([shapeEl('a'), shapeEl('b')]);
		ops.selectedElementIds.value = ['b'];
		ops.removeElement('b');
		expect(ids()).toStrictEqual(['a']);
		expect(ops.selectedElementIds.value).toStrictEqual([]);
	});
});

describe('useEditorOperations - transform', () => {
	it('transformElement patches geometry only', () => {
		const { ops, slides } = setup([shapeEl('a')]);
		ops.transformElement('a', { x: 10, y: 20, width: 200, height: 80, rotation: 45 });
		const el = slides.value[0].elements[0];
		expect(el.x).toBe(10);
		expect(el.y).toBe(20);
		expect(el.width).toBe(200);
		expect(el.height).toBe(80);
		expect(el.rotation).toBe(45);
	});

	it('moveElement is an alias of transformElement', () => {
		const { ops } = setup([shapeEl('a')]);
		expect(ops.moveElement).toBe(ops.transformElement);
	});
});

describe('useEditorOperations - duplicate', () => {
	it('duplicateElement clones with a new id, offset, and selection', () => {
		const { ops, slides } = setup([shapeEl('a', 100)]);
		const newId = ops.duplicateElement('a');
		expect(newId).toBeDefined();
		expect(slides.value[0].elements).toHaveLength(2);
		const copy = slides.value[0].elements[1];
		expect(copy.id).not.toBe('a');
		expect(copy.x).toBe(120);
		expect(copy.y).toBe(20);
		expect(ops.selectedElementIds.value).toStrictEqual([copy.id]);
	});

	it('duplicateElement returns undefined for an unknown id', () => {
		const { ops } = setup([shapeEl('a')]);
		expect(ops.duplicateElement('nope')).toBeUndefined();
	});
});

describe('useEditorOperations - z-order', () => {
	it('bringForward swaps one step toward the front', () => {
		const { ops, ids } = setup([shapeEl('a'), shapeEl('b'), shapeEl('c')]);
		ops.bringForward('a');
		expect(ids()).toStrictEqual(['b', 'a', 'c']);
	});

	it('sendBackward swaps one step toward the back', () => {
		const { ops, ids } = setup([shapeEl('a'), shapeEl('b'), shapeEl('c')]);
		ops.sendBackward('c');
		expect(ids()).toStrictEqual(['a', 'c', 'b']);
	});

	it('bringForward is a no-op for the front-most element', () => {
		const { ops, ids, history } = setup([shapeEl('a'), shapeEl('b')]);
		ops.bringForward('b');
		expect(ids()).toStrictEqual(['a', 'b']);
		expect(history.canUndo.value).toBeFalsy();
	});

	it('reorder moves an element to an explicit index', () => {
		const { ops, ids } = setup([shapeEl('a'), shapeEl('b'), shapeEl('c')]);
		ops.reorder('a', 2);
		expect(ids()).toStrictEqual(['b', 'c', 'a']);
	});
});

describe('useEditorOperations - text', () => {
	it('updateElementText replaces text and collapses segments', () => {
		const { ops, slides } = setup([textEl('t', 'old')]);
		ops.updateElementText('t', 'new');
		const el = slides.value[0].elements[0];
		expect(el.type).toBe('text');
		if (el.type === 'text') {
			expect(el.text).toBe('new');
			expect(el.textSegments).toHaveLength(1);
			expect(el.textSegments?.[0].text).toBe('new');
			// First segment's style is preserved.
			expect(el.textSegments?.[0].style.bold).toBeTruthy();
		}
	});

	it('updateElementText targets a smartArt node by id', () => {
		const { ops, slides } = setup([smartArtEl('sa')]);
		ops.updateElementText('sa', 'ONE', 'n1');
		const el = slides.value[0].elements[0];
		if (el.type === 'smartArt') {
			const node = el.smartArtData?.nodes.find((n) => n.id === 'n1');
			expect(node?.text).toBe('ONE');
			// Other nodes untouched.
			expect(el.smartArtData?.nodes.find((n) => n.id === 'n2')?.text).toBe('two');
		}
	});
});

describe('useEditorOperations - history integration', () => {
	it('every mutation pushes an undoable snapshot and undo reverts it', () => {
		const { ops, history, ids } = setup([shapeEl('a')]);
		ops.addElement(shapeEl('b'));
		ops.transformElement('a', { x: 50 });
		expect(history.canUndo.value).toBeTruthy();

		history.undo(); // reverts transform
		history.undo(); // reverts add
		expect(ids()).toStrictEqual(['a']);
	});

	it('uses an external selection ref when provided', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1', [shapeEl('a')])]);
		const activeSlideIndex = ref(0);
		const selection = ref<string[]>([]);
		const history = useEditorHistory(slides);
		const ops = useEditorOperations({
			slides,
			activeSlideIndex,
			pushHistory: history.pushHistory,
			selectedElementIds: selection,
		});
		ops.addElement(shapeEl('b'));
		expect(selection.value).toStrictEqual(['b']);
		expect(ops.selectedElementIds).toBe(selection);
	});
});
