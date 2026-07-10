import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createEditorOps } from './editor-operations';

function buildSlide(id: string, notes = ''): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements: [], notes };
}

describe('createEditorOps commitNotes', () => {
	it('writes the plain-text notes onto the current slide and records history when editable', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', 'old notes')],
			currentSlide: 0,
			editable: true,
		});
		const onHistoryChange = vi.fn();
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange });

		ops.commitNotes('new notes');

		expect(store.get().slides[0].notes).toBe('new notes');
		expect(store.get().dirty).toBeTruthy();
		expect(ops.canUndo()).toBeTruthy();

		ops.undo();
		expect(store.get().slides[0].notes).toBe('old notes');
	});

	it('is a no-op when the viewer is not editable (view-only mode)', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', 'old notes')],
			currentSlide: 0,
			editable: false,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });

		ops.commitNotes('attempted edit');

		expect(store.get().slides[0].notes).toBe('old notes');
		expect(store.get().dirty).toBeFalsy();
		expect(ops.canUndo()).toBeFalsy();
	});

	it('is a no-op when the text is unchanged (no spurious history entry)', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', 'same notes')],
			currentSlide: 0,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });

		ops.commitNotes('same notes');

		expect(ops.canUndo()).toBeFalsy();
	});

	it('commits onto the active slide only, leaving the other slides untouched', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [buildSlide('a', 'notes a'), buildSlide('b', 'notes b')],
			currentSlide: 1,
			editable: true,
		});
		const ops = createEditorOps({ store, getHandler: () => null, onHistoryChange: vi.fn() });

		ops.commitNotes('updated b');

		expect(store.get().slides[0].notes).toBe('notes a');
		expect(store.get().slides[1].notes).toBe('updated b');
	});
});
