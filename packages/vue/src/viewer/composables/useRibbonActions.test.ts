import { mount } from '@vue/test-utils';
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxSlide, TextSegment } from 'pptx-viewer-core';
import { elementBulletKind, remapTextToSegments } from 'pptx-viewer-shared';
import type { InlineListController, InlineTextEditSnapshot } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';

import InlineTextEditor from '../components/InlineTextEditor.vue';
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

function useHarness(
	element: PptxElement,
	canEdit = true,
	readInlineSnapshot?: () => InlineTextEditSnapshot | undefined,
	formatInlineSnapshot?: (snapshot: InlineTextEditSnapshot) => boolean,
	endInlineListSession?: () => void,
) {
	const currentSlide = ref(slideWith(element));
	const updateElement = vi.fn((elementId: string, updates: Partial<PptxElement>) => {
		currentSlide.value = {
			...currentSlide.value,
			elements: currentSlide.value.elements.map((el) =>
				el.id === elementId ? ({ ...el, ...updates } as PptxElement) : el,
			),
		};
	});

	const actions = useRibbonActions({
		readInlineSnapshot,
		formatInlineSnapshot,
		endInlineListSession,
		canEdit: () => canEdit,
		presenting: ref(false),
		showMasterView: ref(false),
		tableSelection: ref(
			element.type === 'table' ? { elementId: element.id, rowIndex: 0, columnIndex: 0 } : null,
		),
		selectedElements: computed(() => currentSlide.value.elements),
		selectedElementIds: ref([element.id]),
		activeSlide: computed(() => currentSlide.value),
		activeSlideIndex: ref(0),
		slides: ref([currentSlide.value]),
		pushHistory: vi.fn(),
		ops: { updateElement } as unknown as EditorOperations,
	});

	return { actions, element: () => currentSlide.value.elements[0], updateElement };
}

describe('ribbonUpdateTextStyle list commands', () => {
	it('formats the mounted live body and refuses model-only changes during composition', async () => {
		const source = textElement();
		Object.assign(source, {
			text: '◆ Original',
			textSegments: [
				{ text: '◆ ', style: {}, bulletInfo: { char: '◆' }, paragraphLevel: 1 },
				{ text: 'Original', style: { italic: true } },
			],
		});
		let snapshot: InlineTextEditSnapshot | undefined;
		let controller: InlineListController | undefined;
		const wrapper = mount(InlineTextEditor, {
			attachTo: document.body,
			props: {
				element: source,
				onChange: (_text: string, current?: InlineTextEditSnapshot) => {
					snapshot = current;
				},
				onListSession: (event: { controller: InlineListController; active: boolean }) => {
					controller = event.active ? event.controller : undefined;
				},
			},
		});
		try {
			const surface = wrapper.get('[data-inline-editor]');
			const run = surface.element.querySelector('span')!;
			run.textContent = 'Current';
			await surface.trigger('input');
			const { actions, element, updateElement } = useHarness(
				source,
				true,
				() => snapshot,
				(next) => controller?.format(next).kind === 'supported',
			);
			actions.ribbonUpdateTextStyle({ bold: true });
			expect(run.style.fontWeight).toBe('bold');
			expect(element()).toMatchObject({ text: 'Current' });
			const validSnapshot = snapshot;
			await surface.trigger('compositionstart');
			snapshot = validSnapshot; // Even a stale host payload cannot bypass the controller's composition guard.
			actions.ribbonUpdateTextStyle({ italic: false });
			expect(updateElement).toHaveBeenCalledOnce();
		} finally {
			wrapper.unmount();
		}
	});

	it('formats the current rich draft without rebuilding it from the old body', () => {
		const source = textElement();
		const snapshot = {
			elementId: source.id,
			text: 'Current body',
			textSegments: [{ text: 'Current body', style: { italic: true }, paragraphLevel: 1 }],
		};
		const { actions, element } = useHarness(source, true, () => snapshot);
		actions.ribbonUpdateTextStyle({ bold: true });
		expect(element()).toMatchObject({
			text: 'Current body',
			textSegments: [
				{ text: 'Current body', style: { italic: true, bold: true }, paragraphLevel: 1 },
			],
		});
	});

	it('creates markers for plain multiline text without segments', () => {
		const source = textElement();
		if (!hasTextProperties(source)) {
			throw new Error('expected text');
		}
		delete source.textSegments;
		source.text = 'first\nsecond';
		const { actions, element } = useHarness(source);
		actions.ribbonUpdateTextStyle({ listType: 'bullet' });
		const result = element();
		if (!hasTextProperties(result)) {
			throw new Error('expected text');
		}
		expect(result.textSegments?.filter((segment) => segment.bulletInfo?.char)).toHaveLength(2);
		expect(
			result.textSegments
				?.filter((segment) => !segment.bulletInfo)
				.map((segment) => segment.text)
				.join(''),
		).toBe('first\nsecond');
	});

	it.each(['bullet', 'numbered'] as const)(
		'sets %s semantics and preserves accompanying formatting',
		(kind) => {
			const source = textElement();
			const { actions, element, updateElement } = useHarness(source);
			actions.ribbonUpdateTextStyle({ listType: kind, bold: true });
			expect(elementBulletKind(element())).toBe(kind);
			const first = element();
			if (!hasTextProperties(first)) {
				throw new Error('expected text');
			}
			expect(first.textSegments?.[0].bulletInfo).toBeDefined();
			expect(
				first.textSegments
					?.slice(1)
					.map((segment) => segment.text)
					.join(''),
			).toBe('hello world');
			expect(first.textSegments?.at(-1)?.style.bold).toBeTruthy();
			expect(updateElement).toHaveBeenCalledOnce();
			actions.ribbonUpdateTextStyle({ listType: kind });
			expect(element()).toStrictEqual(first);
			actions.ribbonUpdateTextStyle({ listType: 'none' });
			expect(elementBulletKind(element())).toBe('none');
			expect(source).toStrictEqual(textElement());
		},
	);

	it('preserves uncommitted inline text when adding a list', () => {
		const editor = document.createElement('div');
		editor.dataset.inlineEditor = '';
		editor.textContent = 'hello world, typed more';
		document.body.appendChild(editor);
		try {
			const { actions, element } = useHarness(textElement());
			actions.ribbonUpdateTextStyle({ listType: 'bullet' });
			const result = element();
			if (!hasTextProperties(result)) {
				throw new Error('expected text');
			}
			expect(result.text).toBe(editor.textContent);
			expect(
				result.textSegments
					?.slice(1)
					.map((segment) => segment.text)
					.join(''),
			).toBe(editor.textContent);
		} finally {
			editor.remove();
		}
	});

	it('does not change read-only selections', () => {
		const { actions, updateElement } = useHarness(textElement(), false);
		actions.ribbonUpdateTextStyle({ listType: 'bullet' });
		expect(updateElement).not.toHaveBeenCalled();
	});

	it('ignores unsupported table lists while applying other requested cell styles', () => {
		const table: PptxElement = {
			id: 'table',
			type: 'table',
			x: 0,
			y: 0,
			width: 100,
			height: 40,
			tableData: { rows: [{ cells: [{ text: 'cell', style: {} }] }], columnWidths: [1] },
		};
		const { actions, element, updateElement } = useHarness(table);
		actions.ribbonUpdateTextStyle({ listType: 'bullet' });
		expect(updateElement).not.toHaveBeenCalled();
		actions.ribbonUpdateTextStyle({ listType: 'bullet', bold: true });
		const result = element();
		if (result.type !== 'table') {
			throw new Error('expected table');
		}
		expect(result.tableData?.rows[0].cells[0].style).toStrictEqual({ bold: true });
		expect('textSegments' in result).toBeFalsy();
	});
});

describe('ribbonUpdateTextCase', () => {
	it('ends the native list session before changing its body and leaves marker text intact', () => {
		const source = textElement();
		const snapshot = {
			elementId: source.id,
			text: 'lower',
			textSegments: [
				{
					text: 'iii. ',
					style: {},
					bulletInfo: { autoNumType: 'romanLcPeriod', autoNumStartAt: 3, paragraphIndex: 0 },
				},
				{ text: 'lower', style: { italic: true } },
			],
		};
		const end = vi.fn();
		const { actions, element, updateElement } = useHarness(
			source,
			true,
			() => snapshot,
			undefined,
			end,
		);
		actions.ribbonUpdateTextCase('upper');
		expect(end).toHaveBeenCalledOnce();
		expect(end.mock.invocationCallOrder[0]).toBeLessThan(updateElement.mock.invocationCallOrder[0]);
		expect(element()).toMatchObject({
			text: 'LOWER',
			textSegments: [{ text: 'iii. ' }, { text: 'LOWER', style: { italic: true } }],
		});
	});

	it.each([false, true])(
		'honors explicit formatting before runless typing (with list=%s)',
		(withList) => {
			const initial = {
				...textElement(),
				text: '',
				textSegments: [
					{
						text: '',
						style: {},
						paragraphInsertionStyle: { bold: true, color: '#007000', fontSize: 40 },
					},
				],
			} as PptxElement;
			const harness = useHarness(initial);
			const updates = { bold: false, color: '#000000', fontSize: 24 };
			harness.actions.ribbonUpdateTextStyle({
				...updates,
				...(withList ? { listType: 'numbered' as const } : {}),
			});
			const element = harness.element() as PptxElement & { textSegments: TextSegment[] };
			const typed = remapTextToSegments('Typed', element.textSegments, {});
			expect(typed.at(-1)?.style).toMatchObject(updates);
			expect(typed.every((segment) => !segment.paragraphInsertionStyle)).toBeTruthy();
		},
	);

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
