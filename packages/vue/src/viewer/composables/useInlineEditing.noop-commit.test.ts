import { mount } from '@vue/test-utils';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	createCollaborationLivePatcher,
	createSnapshotTextPositions,
	findElementYMap,
	readSlidesFromYDoc,
	reconcileSlidesInYDoc,
} from 'pptx-viewer-shared';
import type { YjsFactories } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { computed, ref, shallowRef } from 'vue';
import * as Y from 'yjs';

import InlineTextEditor from '../components/InlineTextEditor.vue';
import type { EditorOperations } from './useEditorOperations';
import { useInlineEditing } from './useInlineEditing';
import { useSlideOperations } from './useSlideOperations';

/**
 * Regression cover for "the undo stack jams after two edits".
 *
 * Inline text committed on blur, unconditionally. Clicking into a text box and
 * straight back out therefore recorded an undo step whose snapshot was
 * identical to the live deck. That is wasteful on its own, but it also made
 * Undo unusable: pressing the ribbon's Undo button blurs whatever is focused,
 * so the click ITSELF pushed a fresh no-op entry, and the undo that followed
 * popped only that entry. The deck never moved, the button never went dark, and
 * the two real edits behind the no-op could not be reached at all.
 *
 * The fix is to treat "nothing was typed" as not an edit. These tests pin that
 * without reaching for the DOM: the contract is which calls reach the
 * history-recording editor operation.
 */

interface Harness {
	editing: ReturnType<typeof useInlineEditing>;
	updateElement: ReturnType<typeof vi.fn>;
}

function makeElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'text-1',
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		text: 'Box A',
		textSegments: [{ text: 'Box A', style: {} }],
		...overrides,
	} as unknown as PptxElement;
}

function useHarness(element: PptxElement): Harness {
	const updateElement = vi.fn();
	const editing = useInlineEditing({
		canEdit: () => true,
		findActiveElement: (id) => (id === element.id ? element : undefined),
		ops: { updateElement } as unknown as EditorOperations,
	});
	return { editing, updateElement };
}

describe('commitInlineEdit', () => {
	it('retires the connected editor when a peer reorder activates a duplicate with the same element id', () => {
		const slides = shallowRef<PptxSlide[]>([
			{ id: 'original', slideNumber: 1, elements: [makeElement()] },
		]);
		const activeSlideIndex = ref(0);
		useSlideOperations({ slides, activeSlideIndex, pushHistory: vi.fn() }).duplicateSlide(0);
		activeSlideIndex.value = 0;
		const [original, duplicate] = slides.value;
		expect(duplicate.id).not.toBe(original.id);
		expect(duplicate.elements[0].id).toBe(original.elements[0].id);
		const activeSlide = computed(() => slides.value[activeSlideIndex.value]);
		const doc = new Y.Doc();
		const factories: YjsFactories = {
			createMap: () => new Y.Map(),
			createArray: () => new Y.Array(),
			createText: () => new Y.Text(),
			createTextPositions: (text) =>
				createSnapshotTextPositions(text as unknown as Y.Text, {
					read: () => Y.snapshot(doc),
					equal: Y.equalSnapshots,
					subscribeBeforeObservers: (listener) => {
						doc.on('beforeObserverCalls', listener);
						return () => doc.off('beforeObserverCalls', listener);
					},
				}),
		};
		reconcileSlidesInYDoc(slides.value, doc, factories);
		const patcher = createCollaborationLivePatcher();
		patcher.configure(doc, factories, true);
		const updateElement = vi.fn();
		const editing = useInlineEditing({
			canEdit: () => true,
			findActiveElement: (id) => activeSlide.value?.elements.find((element) => element.id === id),
			activeSlide: () => activeSlide.value,
			livePatcher: () => patcher,
			ops: { updateElement } as unknown as EditorOperations,
		});
		editing.enterInlineEdit(original.elements[0].id);
		const wrapper = mount(InlineTextEditor, {
			attachTo: document.body,
			props: {
				element: original.elements[0],
				livePatcher: patcher,
				slideId: original.id,
				onChange: editing.updateInlineText,
				onListSession: editing.onListSession,
				onCancel: editing.cancelInlineEdit,
				onCommit: editing.commitInlineEdit,
			},
		});
		try {
			const surface = wrapper.get('[data-inline-editor]').element;
			const node = surface.querySelector('span')!.firstChild as Text;
			expect(editing.readInlineSnapshot()?.text).toBe('Box A');
			// A peer reorders the existing slides without changing our numeric index.
			const current = readSlidesFromYDoc(doc);
			reconcileSlidesInYDoc([current[1], current[0]], doc, factories);
			slides.value = readSlidesFromYDoc(doc);
			expect(activeSlide.value.id).toBe(duplicate.id);
			expect(editing.inlineEditingElementId.value).toBeNull();
			expect(editing.readInlineSnapshot()).toBeUndefined();
			window.getSelection()!.setBaseAndExtent(node, 5, node, 5);
			surface.dispatchEvent(
				new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText' }),
			);
			node.data += ' wrong slide';
			surface.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
			surface.dispatchEvent(new FocusEvent('blur'));
			expect(updateElement).not.toHaveBeenCalled();
			expect(
				(findElementYMap(doc, original.id, 'text-1')!.get('textBody') as Y.Text).toString(),
			).toBe('Box A');
			expect(
				(findElementYMap(doc, duplicate.id, 'text-1')!.get('textBody') as Y.Text).toString(),
			).toBe('Box A');
		} finally {
			wrapper.unmount();
			patcher.dispose();
			doc.destroy();
		}
	});

	it('does not fall back to the previous rich draft during connected composition or revoked ownership', () => {
		const source = makeElement();
		const { editing, updateElement } = useHarness(source);
		editing.enterInlineEdit(source.id);
		editing.updateInlineText('Stale', {
			elementId: source.id,
			text: 'Stale',
			textSegments: [{ text: 'Stale', style: {} }],
		});
		let reason = 'composition-active';
		editing.onListSession({
			active: true,
			controller: {
				checkModel: () => true,
				readAccepted: () => undefined,
				read: () => ({ kind: 'unsupported', reason, text: 'Stale' }),
				dispose: vi.fn(),
				format: vi.fn(),
				refresh: vi.fn(),
				readSelection: vi.fn(),
			} as unknown as Parameters<typeof editing.onListSession>[0]['controller'],
		});
		expect(editing.isInlineInputPending()).toBeTruthy();
		expect(editing.readInlineSnapshot()).toBeUndefined();
		editing.commitInlineEdit();
		expect(updateElement).not.toHaveBeenCalled();
		expect(editing.inlineEditingElementId.value).toBe(source.id);
		reason = 'inactive-session';
		editing.commitInlineEdit();
		expect(updateElement).not.toHaveBeenCalled();
		expect(editing.inlineEditingElementId.value).toBeNull();
	});

	it('invalidates a mounted stale list body on model undo without cancelling geometry-only changes', async () => {
		const source = makeElement({
			text: '◆ Original',
			textSegments: [
				{ text: '◆ ', style: {}, bulletInfo: { char: '◆' } },
				{ text: 'Original', style: {} },
			],
		});
		const current = shallowRef(source);
		const updateElement = vi.fn();
		const editing = useInlineEditing({
			canEdit: () => true,
			findActiveElement: () => current.value,
			ops: { updateElement } as unknown as EditorOperations,
		});
		editing.enterInlineEdit(source.id);
		const wrapper = mount(InlineTextEditor, {
			attachTo: document.body,
			props: {
				element: source,
				onChange: editing.updateInlineText,
				onListSession: editing.onListSession,
			},
		});
		try {
			const surface = wrapper.get('[data-inline-editor]');
			surface.element.querySelector('span')!.textContent = 'Current';
			await surface.trigger('input');
			current.value = { ...source, x: 20 };
			expect(editing.readInlineSnapshot()?.text).toBe('Current');
			current.value = {
				...source,
				text: 'Current',
				textSegments: editing.readInlineSnapshot()!.textSegments,
			};
			expect(editing.inlineEditingElementId.value).toBe(source.id);
			current.value = source;
			expect(editing.inlineEditingElementId.value).toBeNull();
			expect(editing.readInlineSnapshot()).toBeUndefined();
			editing.commitInlineEdit();
			expect(updateElement).not.toHaveBeenCalled();
		} finally {
			wrapper.unmount();
		}
	});

	it('commits current list segments even when the body text is unchanged', () => {
		const element = makeElement();
		const { editing, updateElement } = useHarness(element);
		const textSegments = [{ text: 'Box A', style: { bold: true }, paragraphLevel: 1 }];
		editing.enterInlineEdit(element.id);
		editing.updateInlineText('Box A', { elementId: element.id, text: 'Box A', textSegments });
		editing.commitInlineEdit();
		expect(updateElement).toHaveBeenCalledExactlyOnceWith(element.id, {
			text: 'Box A',
			textSegments,
		});
	});

	it('does not reuse a rich snapshot after a later plain fallback input', () => {
		const element = makeElement();
		const { editing, updateElement } = useHarness(element);
		editing.enterInlineEdit(element.id);
		editing.updateInlineText('Draft', {
			elementId: element.id,
			text: 'Draft',
			textSegments: [{ text: 'Draft', style: { bold: true } }],
		});
		editing.updateInlineText('Fallback');
		editing.commitInlineEdit();
		expect(updateElement.mock.calls[0][1].textSegments).toStrictEqual([
			{ text: 'Fallback', style: {} },
		]);
	});

	it('ignores a snapshot belonging to another edited element', () => {
		const element = makeElement();
		const { editing, updateElement } = useHarness(element);
		editing.enterInlineEdit(element.id);
		editing.updateInlineText('Box A', {
			elementId: 'other',
			text: 'Box A',
			textSegments: [{ text: 'Box A', style: { bold: true } }],
		});
		editing.commitInlineEdit();
		expect(updateElement).not.toHaveBeenCalled();
	});

	it.each(['First\nInserted\nLast', 'Last'])(
		'records one changed commit preserving suffix spacing for %s',
		(text) => {
			const last = {
				text: 'Last',
				style: { color: '#006600' },
				paragraphProperties: { paragraphSpacingAfter: 10 },
			};
			const element = makeElement({
				text: 'First\nLast',
				textSegments: [
					{ text: 'First', style: {}, paragraphProperties: { paragraphSpacingAfter: 20 } },
					{ text: '\n', style: {}, isParagraphBreak: true },
					last,
				],
			} as Partial<PptxElement>);
			const { editing, updateElement } = useHarness(element);
			editing.enterInlineEdit(element.id);
			editing.updateInlineText(text);
			editing.commitInlineEdit();
			expect(updateElement).toHaveBeenCalledOnce();
			expect(updateElement.mock.calls[0][1]).toMatchObject({ text });
			expect(updateElement.mock.calls[0][1].textSegments.at(-1)).toStrictEqual(last);
		},
	);

	it('records nothing when the text was not changed', () => {
		const element = makeElement();
		const { editing, updateElement } = useHarness(element);

		editing.enterInlineEdit(element.id);
		editing.commitInlineEdit();

		expect(updateElement).not.toHaveBeenCalled();
	});

	it('still leaves inline editing when a no-op commit is dropped', () => {
		const element = makeElement();
		const { editing } = useHarness(element);

		editing.enterInlineEdit(element.id);
		editing.commitInlineEdit();

		expect(editing.inlineEditingElementId.value).toBeNull();
	});

	it('records the edit when the text did change', () => {
		const element = makeElement();
		const { editing, updateElement } = useHarness(element);

		editing.enterInlineEdit(element.id);
		editing.updateInlineText('Box B');
		editing.commitInlineEdit();

		expect(updateElement).toHaveBeenCalledOnce();
		expect(updateElement.mock.calls[0][1]).toMatchObject({ text: 'Box B' });
	});

	it('records an edit that only clears the text', () => {
		const element = makeElement();
		const { editing, updateElement } = useHarness(element);

		editing.enterInlineEdit(element.id);
		editing.updateInlineText('');
		editing.commitInlineEdit();

		expect(updateElement).toHaveBeenCalledOnce();
		expect(updateElement.mock.calls[0][1]).toMatchObject({ text: '' });
	});

	it('does not erase the runs of an element that carries segments but no plain text', () => {
		// The editor seeds itself from `text`, which is absent here, so an
		// untouched commit used to remap the runs from an empty string and drop
		// them for good.
		const element = makeElement({ text: undefined } as Partial<PptxElement>);
		const { editing, updateElement } = useHarness(element);

		editing.enterInlineEdit(element.id);
		editing.commitInlineEdit();

		expect(updateElement).not.toHaveBeenCalled();
	});

	it('is inert when nothing is being edited', () => {
		const element = makeElement();
		const { editing, updateElement } = useHarness(element);

		editing.commitInlineEdit();

		expect(updateElement).not.toHaveBeenCalled();
	});
});
