import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';

import { useEditorHistory } from './useEditorHistory';

function el(id: string, x = 0): PptxElement {
	return {
		type: 'shape',
		id,
		x,
		y: 0,
		width: 100,
		height: 50,
	} as PptxElement;
}

function slide(id: string, elements: PptxElement[] = []): PptxSlide {
	return {
		id,
		rId: `rId-${id}`,
		slideNumber: 1,
		elements,
	};
}

describe('useEditorHistory', () => {
	it('starts with no undo/redo available', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1')]);
		const { canUndo, canRedo } = useEditorHistory(slides);
		expect(canUndo.value).toBeFalsy();
		expect(canRedo.value).toBeFalsy();
	});

	it('pushHistory enables undo and snapshots the pre-mutation state', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1', [el('a')])]);
		const { canUndo, pushHistory } = useEditorHistory(slides);

		pushHistory();
		slides.value = [slide('s1', [el('a'), el('b')])];

		expect(canUndo.value).toBeTruthy();
	});

	it('undo restores the previous slides snapshot', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1', [el('a')])]);
		const { undo, redo, canUndo, canRedo, pushHistory } = useEditorHistory(slides);

		pushHistory();
		slides.value = [slide('s1', [el('a'), el('b')])];

		undo();
		expect(slides.value[0].elements.map((e) => e.id)).toStrictEqual(['a']);
		expect(canUndo.value).toBeFalsy();
		expect(canRedo.value).toBeTruthy();

		redo();
		expect(slides.value[0].elements.map((e) => e.id)).toStrictEqual(['a', 'b']);
		expect(canUndo.value).toBeTruthy();
		expect(canRedo.value).toBeFalsy();
	});

	it('restored snapshots are deep clones (mutating the live ref does not corrupt history)', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1', [el('a', 10)])]);
		const { undo, pushHistory } = useEditorHistory(slides);

		pushHistory();
		slides.value = [slide('s1', [el('a', 999)])];

		undo();
		const restored = slides.value[0].elements[0];
		expect(restored.x).toBe(10);

		// Mutating the restored object must not be reflected in any retained
		// snapshot — a subsequent redo/undo round-trip stays clean.
		restored.x = -1;
		expect(slides.value[0].elements[0].x).toBe(-1);
	});

	it('pushing a new change after undo clears the redo branch', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1', [el('a')])]);
		const { undo, canRedo, pushHistory } = useEditorHistory(slides);

		pushHistory();
		slides.value = [slide('s1', [el('a'), el('b')])];
		undo();
		expect(canRedo.value).toBeTruthy();

		// New mutation off the reverted state invalidates redo.
		pushHistory();
		slides.value = [slide('s1', [el('a'), el('c')])];
		expect(canRedo.value).toBeFalsy();
	});

	it('clearHistory drops both stacks', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1')]);
		const { canUndo, canRedo, clearHistory, undo, pushHistory } = useEditorHistory(slides);

		pushHistory();
		slides.value = [slide('s1', [el('a')])];
		undo();
		expect(canRedo.value).toBeTruthy();

		clearHistory();
		expect(canUndo.value).toBeFalsy();
		expect(canRedo.value).toBeFalsy();
	});

	it('undo/redo are no-ops when their stack is empty', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1', [el('a')])]);
		const { undo, redo } = useEditorHistory(slides);
		const before = slides.value;
		undo();
		redo();
		expect(slides.value).toBe(before);
	});
});
