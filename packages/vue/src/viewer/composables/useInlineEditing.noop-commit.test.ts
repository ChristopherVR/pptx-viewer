import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { EditorOperations } from './useEditorOperations';
import { useInlineEditing } from './useInlineEditing';

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
