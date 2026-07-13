import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createFindReplaceActions } from './editor-find-replace-actions';
import type { EditorOps } from './editor-operations';

function slideWithText(text: string): PptxSlide {
	return {
		id: 's1',
		rId: '',
		slideNumber: 1,
		elements: [
			{
				type: 'text',
				id: 'el1',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				text,
				textSegments: [{ text, style: {} }],
			},
		],
	} as PptxSlide;
}

function fakeOps(): EditorOps {
	return {
		selectedElement: () => undefined,
		select: vi.fn(),
		pushHistory: vi.fn(),
		commitChange: vi.fn(),
		patchGeometry: vi.fn(),
		deleteSelected: vi.fn(),
		duplicateSelected: () => null,
		nudgeSelected: vi.fn(),
		commitInlineText: vi.fn(),
		commitNotes: vi.fn(),
		applyFormatPainter: vi.fn(() => false),
		undo: vi.fn(),
		redo: vi.fn(),
		canUndo: () => false,
		canRedo: () => false,
		clearHistory: vi.fn(),
		save: vi.fn(),
	};
}

describe('editor-find-replace-actions', () => {
	it('counts matches without mutating', () => {
		const store = createStore({
			...createInitialViewerState(),
			slides: [slideWithText('hello world')],
		});
		const ops = fakeOps();
		const actions = createFindReplaceActions({ store, ops });
		expect(actions.search('world', false)).toBe(1);
		expect(store.get().slides[0].elements[0]).toMatchObject({ text: 'hello world' });
	});

	it('replaces the first match and pushes history', () => {
		const store = createStore({
			...createInitialViewerState(),
			editable: true,
			slides: [slideWithText('hello world')],
		});
		const ops = fakeOps();
		const actions = createFindReplaceActions({ store, ops });
		const count = actions.replaceCurrent('world', 'there', false);
		expect(count).toBe(1);
		expect(ops.pushHistory).toHaveBeenCalledOnce();
		expect(ops.commitChange).toHaveBeenCalledOnce();
		expect((store.get().slides[0].elements[0] as { text: string }).text).toBe('hello there');
	});

	it('replaces every match with replaceAll', () => {
		const store = createStore({
			...createInitialViewerState(),
			editable: true,
			slides: [slideWithText('cat cat cat')],
		});
		const ops = fakeOps();
		const actions = createFindReplaceActions({ store, ops });
		const count = actions.replaceAll('cat', 'dog', false);
		expect(count).toBe(3);
		expect((store.get().slides[0].elements[0] as { text: string }).text).toBe('dog dog dog');
	});

	it('is a no-op when not editable', () => {
		const store = createStore({ ...createInitialViewerState(), slides: [slideWithText('hello')] });
		const ops = fakeOps();
		const actions = createFindReplaceActions({ store, ops });
		expect(actions.replaceAll('hello', 'bye', false)).toBe(0);
		expect(ops.pushHistory).not.toHaveBeenCalled();
	});
});
