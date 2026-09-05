/**
 * table-style-save.test.ts: a table style DEFINITION edit ("Edit style...")
 * must reach the saved `ppt/tableStyles.xml`.
 *
 * The table style editor was wired in W4-E but `ops.save()` never forwarded
 * `tableStyleMap`/`tableStylesDefaultId`/`tableStylesToDelete`, so an edit
 * rendered live but reverted on reload. Mirrors
 * `font-embedding-save.test.ts`'s harness (real loading controller + real
 * editor ops, PACKAGE-level assertions rather than a spy).
 */
import JSZip from 'jszip';
import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import { addTableStyleToMap, createTableStyleEntry, PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createLoadingController } from '../loading-controller';
import { createInitialViewerState, createStore } from '../state';
import type { Store, ViewerState } from '../state';
import { createEditorOps } from './editor-operations';

async function buildDeck(): Promise<ArrayBuffer> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		const bytes = await handler.save(data.slides);
		return bytes.buffer as ArrayBuffer;
	} finally {
		handler.dispose();
	}
}

interface LoadedViewer {
	store: Store<ViewerState>;
	save: (format?: 'pptx') => Promise<Uint8Array>;
	dispose: () => void;
}

/** Load `buffer` through the real loading controller into a real store. */
async function loadViewer(buffer: ArrayBuffer): Promise<LoadedViewer> {
	const store = createStore({ ...createInitialViewerState(), editable: true });
	const loading = createLoadingController({
		options: {},
		store,
		getTranslator: () => createTranslator(),
		getEditor: () => undefined,
	});
	await loading.load(buffer);
	const ops = createEditorOps({
		store,
		getHandler: () => loading.getHandler(),
		onHistoryChange: vi.fn(),
	});
	return { store, save: (format) => ops.save(format), dispose: () => loading.releaseLoaded() };
}

/** `ppt/tableStyles.xml`'s style ids + `@def`, read straight out of the saved package. */
async function readTableStyles(
	bytes: Uint8Array,
): Promise<{ styleIds: string[]; def: string | null }> {
	const zip = await JSZip.loadAsync(bytes);
	const file = zip.file('ppt/tableStyles.xml');
	if (!file) {
		return { styleIds: [], def: null };
	}
	const xml = await file.async('string');
	const styleIds = [...xml.matchAll(/<a:tblStyle\s+styleId="([^"]+)"/gu)].map((m) => m[1] ?? '');
	const def = /<a:tblStyleLst\b[^>]*\bdef="([^"]*)"/u.exec(xml)?.[1] ?? null;
	return { styleIds, def };
}

describe('vanilla table style editor save wiring', () => {
	it('seeds tableStylesDefaultId from the loaded deck', async () => {
		const viewer = await loadViewer(await buildDeck());
		try {
			// A blank deck ships its own default table style GUID; the store must
			// mirror `PptxData.tableStylesDefaultId` from the very first load, the
			// same way `viewProperties`/`tableStyleMap` are seeded.
			expect(viewer.store.get().tableStylesDefaultId).toBeTruthy();
			expect(viewer.store.get().tableStylesToDelete).toStrictEqual([]);
		} finally {
			viewer.dispose();
		}
	}, 60_000);

	it('writes an edited style map and a chosen default id', async () => {
		const viewer = await loadViewer(await buildDeck());
		try {
			const existingMap = viewer.store.get().tableStyleMap ?? {};
			const created = createTableStyleEntry(existingMap, { styleName: 'Probe Style' });
			const nextMap: ParsedTableStyleMap = { ...existingMap };
			addTableStyleToMap(nextMap, created);

			// Exactly what `createDeckActions().updateTableStyleMap` does.
			viewer.store.set({ tableStyleMap: nextMap, tableStylesDefaultId: created.styleId });

			const withNewStyle = await readTableStyles(await viewer.save('pptx'));
			expect(withNewStyle.styleIds).toContain(created.styleId);
			expect(withNewStyle.def).toBe(created.styleId);
		} finally {
			viewer.dispose();
		}
	}, 60_000);

	it('drops a deleted style that is not the current default', async () => {
		const viewer = await loadViewer(await buildDeck());
		try {
			const existingMap = viewer.store.get().tableStyleMap ?? {};
			const created = createTableStyleEntry(existingMap, { styleName: 'Probe Style' });
			const nextMap: ParsedTableStyleMap = { ...existingMap };
			addTableStyleToMap(nextMap, created);
			viewer.store.set({ tableStyleMap: nextMap });

			const withNewStyle = await readTableStyles(await viewer.save('pptx'));
			expect(withNewStyle.styleIds).toContain(created.styleId);

			// Exactly what `createDeckActions().deleteTableStyle` does: drop the
			// entry from the map AND record it in `tableStylesToDelete` (core
			// treats a merely-absent map key as "untouched", never as "delete").
			const { [created.styleId]: _removed, ...withoutCreated } = nextMap;
			viewer.store.set({
				tableStyleMap: withoutCreated,
				tableStylesToDelete: [created.styleId],
			});

			const afterDelete = await readTableStyles(await viewer.save('pptx'));
			expect(afterDelete.styleIds).not.toContain(created.styleId);
		} finally {
			viewer.dispose();
		}
	}, 60_000);
});
