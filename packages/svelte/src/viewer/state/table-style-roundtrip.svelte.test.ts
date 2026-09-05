/**
 * table-style-roundtrip.svelte.test.ts: a table style DEFINITION edit
 * ("Edit style...") must reach the saved `ppt/tableStyles.xml`.
 *
 * `TableSection.svelte`/`TableStyleEditor.svelte` were wired in W4-E but
 * `EditorState`/`saveEditorState` never forwarded `tableStyleMap`/
 * `tableStylesDefaultId`/`tableStylesToDelete`, so an edit rendered live but
 * reverted on reload. Mirrors `view-preferences-roundtrip.svelte.test.ts`'s
 * harness: mounts the real `createViewerState` factory so this pins the
 * WIRING, not just the shared `table-style-map-edits` helpers (already unit
 * tested in `pptx-viewer-shared`).
 */
import { addTableStyleToMap, createTableStyleEntry, PptxHandler } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ViewerStateBag } from './create-viewer-state-types';
import CreateViewerStateHarness from './CreateViewerStateHarness.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

async function buildDeck(): Promise<Uint8Array> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		return await handler.save(data.slides);
	} finally {
		handler.dispose();
	}
}

/** Mount the real factory over `source` and wait for the load to commit. */
async function loadHarness(source: Uint8Array): Promise<ViewerStateBag> {
	let captured: ViewerStateBag | undefined;
	const target = document.createElement('div');
	const instance = mount(CreateViewerStateHarness, {
		target,
		props: {
			source,
			editable: true,
			onready: (state: ViewerStateBag) => {
				captured = state;
			},
		},
	});
	cleanup = () => unmount(instance);
	if (!captured) {
		throw new Error('createViewerState harness did not report its state synchronously');
	}
	const state = captured;
	await vi.waitFor(
		() => {
			flushSync();
			expect(state.loader.loadCount).toBeGreaterThan(0);
		},
		{ timeout: 30_000 },
	);
	flushSync();
	return state;
}

describe('svelte table style editor edits', () => {
	it('seeds tableStylesDefaultId from the loaded deck', async () => {
		const state = await loadHarness(await buildDeck());

		// A blank deck ships its own default table style GUID; the loader must
		// mirror `PptxData.tableStylesDefaultId` from the very first load, the
		// same way `viewProperties`/`tableStyleMap` are seeded.
		expect(state.loader.tableStylesDefaultId).toBeTruthy();
		expect(state.loader.tableStylesToDelete).toStrictEqual([]);
	}, 60_000);

	it('a saved file actually carries an edited style and dropped one (full round-trip)', async () => {
		const state = await loadHarness(await buildDeck());

		const existingMap = state.loader.tableStyleMap ?? {};
		const created = createTableStyleEntry(existingMap, { styleName: 'Probe Style' });
		const nextMap = { ...existingMap };
		addTableStyleToMap(nextMap, created);

		// Exactly what `createInspectorDeckActions().updateTableStyleMap` does.
		state.loader.tableStyleMap = nextMap;
		flushSync();

		const bytes = await state.editor.save();
		const reloadHandler = new PptxHandler();
		try {
			const reloaded = await reloadHandler.load(bytes.buffer as ArrayBuffer);
			expect(reloaded.tableStyleMap?.[created.styleId]).toBeDefined();
		} finally {
			reloadHandler.dispose();
		}
	}, 60_000);

	it('a deleted style does not survive a save (full round-trip)', async () => {
		const state = await loadHarness(await buildDeck());

		const existingMap = state.loader.tableStyleMap ?? {};
		const created = createTableStyleEntry(existingMap, { styleName: 'Probe Style' });
		const nextMap = { ...existingMap };
		addTableStyleToMap(nextMap, created);
		state.loader.tableStyleMap = nextMap;
		flushSync();
		await state.editor.save();

		// Exactly what `createInspectorDeckActions().deleteTableStyle` does: drop
		// the entry from the map AND record it in `tableStylesToDelete` (core
		// treats a merely-absent map key as "untouched", never as "delete").
		const { [created.styleId]: _removed, ...withoutCreated } = nextMap;
		state.loader.tableStyleMap = withoutCreated;
		state.loader.tableStylesToDelete = [created.styleId];
		flushSync();

		const bytes = await state.editor.save();
		const reloadHandler = new PptxHandler();
		try {
			const reloaded = await reloadHandler.load(bytes.buffer as ArrayBuffer);
			expect(reloaded.tableStyleMap?.[created.styleId]).toBeUndefined();
		} finally {
			reloadHandler.dispose();
		}
	}, 60_000);
});
