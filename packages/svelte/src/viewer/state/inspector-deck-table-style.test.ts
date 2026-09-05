import type { ParsedTableStyleMap, PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorState } from '../editor/editor-state.svelte';
import { createInspectorDeckActions } from './inspector-deck';
import { PresentationLoader } from './presentation-loader.svelte';

/**
 * Does an "Edit style..." edit actually update the map the table renderer
 * reads (`loader.tableStyleMap`, via `provideRenderContext`'s
 * `getTableStyleMap`), and does a delete get recorded for save-time removal?
 *
 * `TableSection.svelte`/`TableStyleEditor.svelte` were wired in W4-E but
 * `InspectorPanel.svelte` never supplied `tableStyleMap` or handled
 * `onTableStyleMapChange`/`onDeleteTableStyle`, so the button never rendered.
 */

function mapWith(...ids: string[]): ParsedTableStyleMap {
	const map: ParsedTableStyleMap = {};
	for (const id of ids) {
		map[id] = { styleId: id, styleName: id };
	}
	return map;
}

function makeEditor(): EditorState {
	const editor = new EditorState({
		getCurrent: () => 0,
		getHandler: () => null as PptxHandler | null,
	});
	editor.editable = true;
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] }], []);
	return editor;
}

describe('createInspectorDeckActions table style map actions', () => {
	it('updateTableStyleMap replaces loader.tableStyleMap and marks the deck dirty', () => {
		const editor = makeEditor();
		const loader = new PresentationLoader();
		loader.tableStyleMap = mapWith('a');
		const deck = createInspectorDeckActions({ loader, editor });

		const nextMap = mapWith('a', 'b');
		deck.updateTableStyleMap(nextMap);

		expect(loader.tableStyleMap).toStrictEqual(nextMap);
		expect(loader.tableStylesToDelete).toStrictEqual([]);
		expect(deck.tableStyleMap).toStrictEqual(nextMap);
		expect(editor.dirty).toBeTruthy();
	});

	it('updateTableStyleMap drops a pending delete when the id reappears', () => {
		const editor = makeEditor();
		const loader = new PresentationLoader();
		loader.tableStyleMap = mapWith('a');
		loader.tableStylesToDelete = ['b'];
		const deck = createInspectorDeckActions({ loader, editor });

		deck.updateTableStyleMap(mapWith('a', 'b'));

		expect(loader.tableStylesToDelete).toStrictEqual([]);
	});

	it('deleteTableStyle removes the entry and records the id for save-time deletion', () => {
		const editor = makeEditor();
		const loader = new PresentationLoader();
		loader.tableStyleMap = mapWith('a', 'b');
		const deck = createInspectorDeckActions({ loader, editor });

		deck.deleteTableStyle('a');

		expect(loader.tableStyleMap).toStrictEqual(mapWith('b'));
		expect(loader.tableStylesToDelete).toStrictEqual(['a']);
		expect(editor.dirty).toBeTruthy();
	});
});
