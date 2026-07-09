// oxlint-disable react-hooks/rules-of-hooks
import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type { EditorOperations } from './useEditorOperations';
import { useInsertElementDialogs } from './useInsertElementDialogs';

/** A shape carrying an equation segment (`equationXml`), like a real equation. */
function equationElement(id: string, omml: Record<string, unknown>): PptxElement {
	return {
		id,
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		text: '[Equation]',
		textSegments: [{ text: '[Equation]', equationXml: omml }],
	} as PptxElement;
}

/** A plain text shape with no equation segment. */
function textElement(id: string): PptxElement {
	return { id, type: 'shape', x: 0, y: 0, width: 100, height: 40, text: 'hi' } as PptxElement;
}

function setup(elements: PptxElement[]) {
	const selectedElementIds = ref<string[]>([]);
	const addElement = vi.fn();
	const updateElement = vi.fn();
	const ops = { addElement, updateElement } as unknown as EditorOperations;
	const findActiveElement = (id: string): PptxElement | undefined =>
		elements.find((el) => el.id === id);
	const api = useInsertElementDialogs({ ops, selectedElementIds, findActiveElement });
	return { api, selectedElementIds, addElement, updateElement };
}

describe('useInsertElementDialogs equation re-edit', () => {
	it('opens the editor seeded from an existing equation element', () => {
		const omml = { 'm:oMathPara': {} };
		const el = equationElement('shp-1', omml);
		const { api, selectedElementIds } = setup([el]);

		const opened = api.openEquationEditorForElement(el);

		expect(opened).toBeTruthy();
		expect(api.showEquationEditor.value).toBeTruthy();
		expect(api.editingEquationOmml.value).toStrictEqual(omml);
		expect(selectedElementIds.value).toStrictEqual(['shp-1']);
	});

	it('declines a non-equation element so the caller falls back to inline edit', () => {
		const el = textElement('shp-2');
		const { api } = setup([el]);

		expect(api.openEquationEditorForElement(el)).toBeFalsy();
		expect(api.showEquationEditor.value).toBeFalsy();
		expect(api.editingEquationOmml.value).toBeNull();
	});

	it('patches the edited equation in place without duplicating or remapping', () => {
		const el = equationElement('shp-3', { 'm:oMathPara': { old: true } });
		const { api, updateElement, addElement } = setup([el]);
		api.openEquationEditorForElement(el);

		const newOmml = { 'm:oMathPara': { updated: true } };
		const segment: TextSegment = { text: '[Equation]', equationXml: newOmml };
		api.onApplyEquation(segment);

		// Updated in place on the same element id; the equation segment is
		// swapped wholesale (no plain-text remap that would drop the OMML).
		expect(updateElement).toHaveBeenCalledExactlyOnceWith('shp-3', { textSegments: [segment] });
		// Never inserts a second element.
		expect(addElement).not.toHaveBeenCalled();
		// Edit-mode state cleared afterwards.
		expect(api.showEquationEditor.value).toBeFalsy();
		expect(api.editingEquationOmml.value).toBeNull();
	});

	it('adds and selects a freshly inserted element, clearing edit state', () => {
		const { api, addElement, selectedElementIds } = setup([]);
		const fresh = equationElement('shp-new', { 'm:oMathPara': {} });

		api.onInsertElement(fresh);

		expect(addElement).toHaveBeenCalledWith(fresh);
		expect(selectedElementIds.value).toStrictEqual(['shp-new']);
		expect(api.showEquationEditor.value).toBeFalsy();
		expect(api.editingEquationOmml.value).toBeNull();
	});
});
