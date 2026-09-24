import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createStore } from '../state/store';
import { createInitialViewerState } from '../state/viewer-state';
import type { ViewerState } from '../state/viewer-state';
import { createClipboardActions } from './editor-clipboard-actions';
import type { EditorOps } from './editor-operations';

function el(id: string, extra: Partial<PptxElement> = {}): PptxElement {
	return { type: 'shape', id, x: 0, y: 0, width: 10, height: 10, ...extra } as PptxElement;
}

function slide(elements: PptxElement[]): PptxSlide {
	return { id: 's', rId: 'rId-s', slideNumber: 1, elements };
}

function harness(elements: PptxElement[]) {
	const store = createStore<ViewerState>({
		...createInitialViewerState(),
		editable: true,
		slides: [slide(elements)],
		currentSlide: 0,
	});
	const ops: EditorOps = {
		selectedElement: () => undefined,
		select: vi.fn(),
		pushHistory: vi.fn(),
		commitChange: vi.fn(),
		deleteSelected: vi.fn(),
	} as unknown as EditorOps;
	const actions = createClipboardActions({ store, ops });
	return { store, actions };
}

describe('createClipboardActions paste (Keep Source Formatting)', () => {
	it('records the pasted clone as its own pristine Paste Options source', () => {
		const { store, actions } = harness([el('a')]);
		store.set({ clipboardPayload: { element: el('a'), isTemplate: false } });
		actions.paste();
		const toolbar = store.get().pasteOptionsToolbar;
		expect(toolbar).toHaveLength(1);
		expect(toolbar?.[0].id).toBe(store.get().slides[0].elements[1].id);
	});
});

describe('createClipboardActions pasteWithFormat', () => {
	it('applies use-destination-theme to the inserted clone', () => {
		const styled = el('a', { shapeStyle: { fillColor: '#ff0000' } } as Partial<PptxElement>);
		const { store, actions } = harness([styled]);
		store.set({ clipboardPayload: { element: styled, isTemplate: false } });
		const id = actions.pasteWithFormat('use-destination-theme');
		expect(id).not.toBeNull();
		const pasted = store.get().slides[0].elements.find((e) => e.id === id) as PptxElement & {
			shapeStyle?: { fillColor?: string };
		};
		expect(pasted.shapeStyle?.fillColor).toBeUndefined();
	});

	it('inserts a bare text box for keep-text-only', () => {
		const withText = el('a', { text: 'Hello' } as Partial<PptxElement>);
		const { store, actions } = harness([withText]);
		store.set({ clipboardPayload: { element: withText, isTemplate: false } });
		const id = actions.pasteWithFormat('keep-text-only');
		const pasted = store.get().slides[0].elements.find((e) => e.id === id);
		expect(pasted).toMatchObject({ type: 'text', text: 'Hello' });
	});

	it('returns null with an empty clipboard', () => {
		const { actions } = harness([el('a')]);
		expect(actions.pasteWithFormat('picture')).toBeNull();
	});
});

describe('createClipboardActions reformatPasted / replaceElement', () => {
	it('re-derives from the frozen source clone, never cumulatively', () => {
		const styled = el('a', {
			text: 'Hello',
			shapeStyle: { fillColor: '#ff0000' },
		} as Partial<PptxElement>);
		const { store, actions } = harness([styled]);
		store.set({ clipboardPayload: { element: styled, isTemplate: false } });
		const id = actions.pasteWithFormat('keep-source-formatting') as string;
		const sourceClone = store.get().pasteOptionsToolbar?.[0]?.sourceClone as PptxElement;

		actions.reformatPasted(id, sourceClone, 'keep-text-only');
		expect(store.get().slides[0].elements.find((e) => e.id === id)?.type).toBe('text');

		actions.reformatPasted(id, sourceClone, 'use-destination-theme');
		const reformatted = store.get().slides[0].elements.find((e) => e.id === id) as PptxElement & {
			shapeStyle?: { fillColor?: string };
		};
		expect(reformatted.type).toBe('shape');
		expect(reformatted.shapeStyle?.fillColor).toBeUndefined();
	});

	it('is a no-op for picture (the caller rasterizes and calls replaceElement itself)', () => {
		const { store, actions } = harness([el('a')]);
		const before = store.get().slides[0].elements;
		actions.reformatPasted('a', el('a'), 'picture');
		expect(store.get().slides[0].elements).toBe(before);
	});
});
