import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { AiChangeBatch } from '../../internal/shared-ai';
import { AiPanelStore } from './ai-panel-store';

function el(id: string, type: PptxElement['type']): PptxElement {
	return { type, id, name: '', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
}

function slide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, elements } as PptxSlide;
}

/** A store bound to a mutable selection snapshot, bypassing TestBed. */
function setup(initial?: {
	activeSlideIndex?: number;
	selectedIds?: string[];
	selected?: PptxElement | null;
}): { store: AiPanelStore; sel: { index: number; ids: string[]; element: PptxElement | null } } {
	const store = new AiPanelStore();
	const sel = {
		index: initial?.activeSlideIndex ?? 0,
		ids: initial?.selectedIds ?? [],
		element: initial?.selected ?? null,
	};
	store.bind({
		activeSlideIndex: () => sel.index,
		selectedElementIds: () => sel.ids,
		selectedElementId: () => sel.ids[0] ?? null,
		selectedElement: () => sel.element,
	});
	return { store, sel };
}

describe('aiPanelStore pick mode', () => {
	it('enters pick mode and turns picked clicks into element targets', () => {
		const { store } = setup();
		expect(store.pickMode()).toBeFalsy();
		store.startPicking();
		expect(store.pickMode()).toBeTruthy();

		store.addPick(2, 'shape-1');
		store.addPick(2, 'shape-2');
		// Duplicate id is ignored (dedupe).
		store.addPick(2, 'shape-1');

		expect(store.pickTargets()).toStrictEqual([
			{ kind: 'element', slideIndex: 2, elementId: 'shape-1' },
			{ kind: 'element', slideIndex: 2, elementId: 'shape-2' },
		]);
		expect(store.hasPicks()).toBeTruthy();
		// Picks feed the focused targets handed to the assistant.
		expect(store.getFocusedTargets()).toStrictEqual(store.pickTargets());
	});

	it('clearPicks empties the set and leaves pick mode', () => {
		const { store } = setup();
		store.startPicking();
		store.addPick(0, 'a');
		store.clearPicks();
		expect(store.pickTargets()).toStrictEqual([]);
		expect(store.pickMode()).toBeFalsy();
	});
});

describe('aiPanelStore focus precedence', () => {
	it('follows the live selection when nothing is pinned or picked', () => {
		const { store } = setup({ activeSlideIndex: 4, selectedIds: ['x'] });
		expect(store.getFocusedTargets()).toStrictEqual([
			{ kind: 'element', slideIndex: 4, elementId: 'x' },
		]);
		expect(store.isPinned()).toBeFalsy();
	});

	it('a pin beats the live selection; picks beat a pin', () => {
		const { store, sel } = setup({ activeSlideIndex: 1, selectedIds: ['a'] });
		store.pinFocus();
		expect(store.isPinned()).toBeTruthy();
		// Selection moves on, but the pinned focus stays put.
		sel.index = 9;
		sel.ids = ['later'];
		expect(store.getFocusedTargets()).toStrictEqual([
			{ kind: 'element', slideIndex: 1, elementId: 'a' },
		]);
		// A pick now overrides the pin.
		store.addPick(9, 'picked');
		expect(store.getFocusedTargets()).toStrictEqual([
			{ kind: 'element', slideIndex: 9, elementId: 'picked' },
		]);
	});
});

describe('aiPanelStore ask / fix directives', () => {
	it('askAboutSelection pins the focus and bumps an empty prefill', () => {
		const { store } = setup({ selectedIds: ['a'] });
		const before = store.prefill().nonce;
		store.askAboutSelection();
		expect(store.pinnedFocus()).not.toBeNull();
		expect(store.prefill().text).toBe('');
		expect(store.prefill().nonce).toBe(before + 1);
	});

	it('fixSelection prefills a fix directive built from the selected element', () => {
		const { store } = setup({ activeSlideIndex: 2, selected: el('shape-7', 'shape') });
		store.fixSelection();
		expect(store.prefill().text).toContain('shape');
		expect(store.prefill().text).toContain('id=shape-7');
		expect(store.prefill().text).toContain('slide 3');
	});
});

describe('aiPanelStore live tool focus', () => {
	it('flashToolTarget navigates focus to the tool element as an active ring', () => {
		const { store } = setup();
		expect(store.canvasAnimating()).toBeFalsy();
		store.flashToolTarget({ slideIndex: 5, elementIds: ['e1'] });
		expect(store.canvasAnimating()).toBeTruthy();
		expect(store.canvasHighlights()).toStrictEqual([
			{ slideIndex: 5, elementId: 'e1', variant: 'active' },
		]);
	});

	it('a null tool target still enables the colour tween (no element ring)', () => {
		const { store } = setup();
		store.flashToolTarget(null);
		expect(store.canvasAnimating()).toBeTruthy();
		expect(store.canvasHighlights()).toStrictEqual([]);
	});

	it('renders picks as persistent rings alongside the active tool ring', () => {
		const { store } = setup();
		store.addPick(0, 'pick-1');
		store.flashToolTarget({ slideIndex: 0, elementIds: ['tool-1'] });
		expect(store.canvasHighlights()).toStrictEqual([
			{ slideIndex: 0, elementId: 'pick-1', variant: 'pick' },
			{ slideIndex: 0, elementId: 'tool-1', variant: 'active' },
		]);
	});
});

describe('aiPanelStore change animation', () => {
	it('showChangeBatch sets and clears the change batch signal', () => {
		const { store } = setup();
		expect(store.changeBatch()).toBeNull();
		const batch = { changes: [], slideIndex: 3, nonce: 1 } as unknown as AiChangeBatch;
		store.showChangeBatch(batch);
		expect(store.changeBatch()).toBe(batch);
		store.showChangeBatch(null);
		expect(store.changeBatch()).toBeNull();
	});

	it('publishAiChange broadcasts a diffed batch to changeAnimator subscribers', () => {
		const { store } = setup();
		const received: Array<AiChangeBatch | null> = [];
		const unsubscribe = store.changeAnimator.subscribe((b) => received.push(b));

		const before = [slide('s1', [el('a', 'shape')])];
		const moved = { ...el('a', 'shape'), x: 200 } as PptxElement;
		store.publishAiChange(before, [slide('s1', [moved])]);

		const batch = received.find((b): b is AiChangeBatch => b !== null);
		expect(batch).toBeTruthy();
		expect(batch?.slideIndex).toBe(0);
		expect(batch?.changes[0]).toMatchObject({ elementId: 'a', kind: 'moved', slideIndex: 0 });

		unsubscribe();
		store.changeAnimator.dispose();
	});

	it('configureChangeAnimation with enabled:false suppresses publishing', () => {
		const { store } = setup();
		store.configureChangeAnimation({ enabled: false });
		const received: Array<AiChangeBatch | null> = [];
		store.changeAnimator.subscribe((b) => received.push(b));

		// A removed element would normally diff to a batch; disabled => no emit.
		store.publishAiChange([slide('s1', [el('a', 'shape')])], [slide('s1', [])]);
		expect(received).toStrictEqual([]);

		store.changeAnimator.dispose();
	});
});
