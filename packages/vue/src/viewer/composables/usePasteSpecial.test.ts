// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxElement, ShapePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, ref, shallowRef } from 'vue';

import type { EditorOperations } from './useEditorOperations';
import { usePasteSpecial } from './usePasteSpecial';
import type { UsePasteSpecialResult } from './usePasteSpecial';

const SHAPE: ShapePptxElement = {
	type: 'shape',
	id: 'shape-1',
	x: 10,
	y: 10,
	width: 100,
	height: 50,
	rotation: 0,
	text: 'Hello',
	shapeStyle: { fillColor: '#ff0000' },
	textStyle: { color: '#0000ff' },
} as unknown as ShapePptxElement;

interface Harness {
	pasteSpecial: UsePasteSpecialResult;
	elements: { value: PptxElement[] };
}

function setup(): Harness {
	const elements: { value: PptxElement[] } = { value: [] };
	const clipboard = shallowRef<PptxElement | null>(SHAPE);
	const selectedElementIds = ref<string[]>([]);
	const ops = {
		addElement: (element: PptxElement) => {
			elements.value = [...elements.value, element];
		},
		updateElement: (id: string, updates: Partial<PptxElement>) => {
			elements.value = elements.value.map((el) =>
				el.id === id ? ({ ...el, ...updates } as PptxElement) : el,
			);
		},
	} as unknown as EditorOperations;

	let result: UsePasteSpecialResult | null = null;
	mount(
		defineComponent({
			setup() {
				result = usePasteSpecial({ clipboard, ops, selectedElementIds });
				return () => h('div');
			},
		}),
	);
	return { pasteSpecial: result as unknown as UsePasteSpecialResult, elements };
}

describe('usePasteSpecial dialog', () => {
	it('opens only when the clipboard holds an element', () => {
		const clipboard = shallowRef<PptxElement | null>(null);
		const selectedElementIds = ref<string[]>([]);
		let result: UsePasteSpecialResult | null = null;
		mount(
			defineComponent({
				setup() {
					result = usePasteSpecial({
						clipboard,
						ops: {} as EditorOperations,
						selectedElementIds,
					});
					return () => h('div');
				},
			}),
		);
		const pasteSpecial = result as unknown as UsePasteSpecialResult;
		pasteSpecial.openPasteSpecialDialog();
		expect(pasteSpecial.isPasteSpecialDialogOpen.value).toBeFalsy();

		clipboard.value = SHAPE;
		pasteSpecial.openPasteSpecialDialog();
		expect(pasteSpecial.isPasteSpecialDialogOpen.value).toBeTruthy();
		pasteSpecial.closePasteSpecialDialog();
		expect(pasteSpecial.isPasteSpecialDialogOpen.value).toBeFalsy();
	});
});

describe('usePasteSpecial pasteWithFormat', () => {
	it('inserts a theme-stripped clone for use-destination-theme', async () => {
		const { pasteSpecial, elements } = setup();
		await pasteSpecial.pasteWithFormat('use-destination-theme');
		expect(elements.value).toHaveLength(1);
		const pasted = elements.value?.[0] as ShapePptxElement;
		expect(pasted.id).not.toBe(SHAPE.id);
		expect(pasted.shapeStyle?.fillColor).toBeUndefined();
		expect(pasteSpecial.isPasteSpecialDialogOpen.value).toBeFalsy();
		expect(pasteSpecial.pasteOptionsToolbar.value?.elementId).toBe(pasted.id);
	});

	it('inserts a bare text box for keep-text-only', async () => {
		const { pasteSpecial, elements } = setup();
		await pasteSpecial.pasteWithFormat('keep-text-only');
		expect(elements.value?.[0]).toMatchObject({ type: 'text', text: 'Hello' });
	});

	it('degrades gracefully for picture when the pasted node is never mounted', async () => {
		const { pasteSpecial, elements } = setup();
		await pasteSpecial.pasteWithFormat('picture');
		expect(elements.value).toHaveLength(1);
		expect(elements.value?.[0].type).toBe('shape');
	});
});

describe('usePasteSpecial reformatPastedElement (Paste Options toolbar)', () => {
	it('re-derives every choice from the frozen source clone, never cumulatively', async () => {
		const { pasteSpecial, elements } = setup();
		await pasteSpecial.pasteWithFormat('keep-source-formatting');
		const pastedId = pasteSpecial.pasteOptionsToolbar.value?.elementId;

		await pasteSpecial.reformatPastedElement('keep-text-only');
		expect(elements.value?.find((el) => el.id === pastedId)?.type).toBe('text');

		await pasteSpecial.reformatPastedElement('use-destination-theme');
		const reformatted = elements.value?.find((el) => el.id === pastedId) as ShapePptxElement;
		expect(reformatted.type).toBe('shape');
		expect(reformatted.shapeStyle?.fillColor).toBeUndefined();
	});

	it('is a no-op once the toolbar has been dismissed', async () => {
		const { pasteSpecial, elements } = setup();
		await pasteSpecial.pasteWithFormat('keep-source-formatting');
		const before = JSON.stringify(elements.value);
		pasteSpecial.dismissPasteOptionsToolbar();
		await pasteSpecial.reformatPastedElement('keep-text-only');
		expect(JSON.stringify(elements.value)).toBe(before);
	});
});
