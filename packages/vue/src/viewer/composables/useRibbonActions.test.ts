import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';

import type { EditorOperations } from './useEditorOperations';
import { useRibbonActions } from './useRibbonActions';

function textElement(): PptxElement {
	return {
		type: 'text',
		id: 't1',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: 'hello world',
		textStyle: { fontSize: 18 },
		textSegments: [{ text: 'hello world', style: { fontSize: 18 } }],
	} as PptxElement;
}

function slideWith(element: PptxElement): PptxSlide {
	return { id: 's1', rId: 's1', slideNumber: 1, elements: [element] };
}

function useHarness(element: PptxElement) {
	let currentSlide = slideWith(element);
	const updateElement = vi.fn((elementId: string, updates: Partial<PptxElement>) => {
		currentSlide = {
			...currentSlide,
			elements: currentSlide.elements.map((el) =>
				el.id === elementId ? ({ ...el, ...updates } as PptxElement) : el,
			),
		};
	});

	const actions = useRibbonActions({
		canEdit: () => true,
		presenting: ref(false),
		showMasterView: ref(false),
		tableSelection: ref(null),
		selectedElements: computed(() => currentSlide.elements),
		selectedElementIds: ref([element.id]),
		activeSlide: computed(() => currentSlide),
		activeSlideIndex: ref(0),
		slides: ref([currentSlide]),
		pushHistory: vi.fn(),
		ops: { updateElement } as unknown as EditorOperations,
	});

	return { actions, element: () => currentSlide.elements[0] };
}

describe('ribbonUpdateTextCase', () => {
	it('rewrites run text per a change-case mode', () => {
		const { actions, element } = useHarness(textElement());
		actions.ribbonUpdateTextCase('upper');

		const el = element() as PptxElement & { text?: string; textSegments?: Array<{ text: string }> };
		expect(el.textSegments?.[0].text).toBe('HELLO WORLD');
		expect(el.text).toBe('HELLO WORLD');
	});

	it('reconciles against a live open inline editor before transforming case', () => {
		// `InlineTextEditor.vue`'s contenteditable is uncontrolled: text typed
		// since the edit session began is not yet on the model's
		// `textSegments`/`.text`. Regression: previously the case transform ran
		// against that stale snapshot, leaving anything typed since
		// untransformed once the edit session committed.
		const editor = document.createElement('div');
		editor.dataset.inlineEditor = '';
		editor.textContent = 'hello world, typed more';
		document.body.appendChild(editor);
		try {
			const { actions, element } = useHarness(textElement()); // model still says "hello world"
			actions.ribbonUpdateTextCase('upper');

			const el = element() as PptxElement & {
				text?: string;
				textSegments?: Array<{ text: string }>;
			};
			expect(el.textSegments?.map((s) => s.text).join('')).toBe('HELLO WORLD, TYPED MORE');
			expect(el.text).toBe('HELLO WORLD, TYPED MORE');
		} finally {
			editor.remove();
		}
	});
});
