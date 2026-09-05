/**
 * table-style-save.test.ts: a table style DEFINITION edit ("Edit style...")
 * must reach the saved `ppt/tableStyles.xml`.
 *
 * `LoadContentService` now seeds `tableStylesDefaultId`/`tableStylesToDelete`
 * on load and spreads `tableStyleSaveOptions` into `saveSlides`'s options,
 * mirroring `font-embedding-save.test.ts`'s wiring style for the Fonts panel.
 *
 * This asserts the PACKAGE, not that a spy fired: `ppt/tableStyles.xml` is
 * unzipped and its styles / `@def` are read back.
 *
 * Built in a throwaway injection context with a `DestroyRef` stub, same as
 * `font-embedding-save.test.ts`; no TestBed.
 */
import { DestroyRef, Injector } from '@angular/core';
import JSZip from 'jszip';
import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import { addTableStyleToMap, createTableStyleEntry, PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { LoadContentService } from './load-content.service';

function createLoader(): LoadContentService {
	const destroyRefStub: Pick<DestroyRef, 'onDestroy'> = {
		onDestroy: () => () => {},
	};
	const injector = Injector.create({
		providers: [{ provide: DestroyRef, useValue: destroyRefStub }, LoadContentService],
	});
	return injector.get(LoadContentService);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function buildDeck(): Promise<Uint8Array> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		return await handler.save(data.slides);
	} finally {
		handler.dispose();
	}
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

describe('table style editor save wiring', () => {
	it('writes an edited style map and a chosen default id', async () => {
		const loader = createLoader();
		await loader.load(toArrayBuffer(await buildDeck()));

		const existingMap = loader.tableStyleMap() ?? {};
		const created = createTableStyleEntry(existingMap, { styleName: 'Probe Style' });
		const nextMap: ParsedTableStyleMap = { ...existingMap };
		addTableStyleToMap(nextMap, created);

		// Exactly what `InspectorPanelComponent.onTableStyleMapChange` does.
		loader.tableStyleMap.set(nextMap);
		loader.tableStylesDefaultId.set(created.styleId);

		const withNewStyle = await readTableStyles(await loader.saveSlides(loader.slides()));
		expect(withNewStyle.styleIds).toContain(created.styleId);
		expect(withNewStyle.def).toBe(created.styleId);
	});

	it('drops a deleted style that is not the current default', async () => {
		const loader = createLoader();
		await loader.load(toArrayBuffer(await buildDeck()));

		const existingMap = loader.tableStyleMap() ?? {};
		const created = createTableStyleEntry(existingMap, { styleName: 'Probe Style' });
		const nextMap: ParsedTableStyleMap = { ...existingMap };
		addTableStyleToMap(nextMap, created);
		loader.tableStyleMap.set(nextMap);

		const withNewStyle = await readTableStyles(await loader.saveSlides(loader.slides()));
		expect(withNewStyle.styleIds).toContain(created.styleId);

		// Exactly what `InspectorPanelComponent.onDeleteTableStyle` does: drop the
		// entry from the map AND record it in `tableStylesToDelete` (core treats
		// a merely-absent map key as "untouched", never as "delete").
		const { [created.styleId]: _removed, ...withoutCreated } = nextMap;
		loader.tableStyleMap.set(withoutCreated);
		loader.tableStylesToDelete.set([created.styleId]);

		const afterDelete = await readTableStyles(await loader.saveSlides(loader.slides()));
		expect(afterDelete.styleIds).not.toContain(created.styleId);
	});

	it('seeds tableStylesDefaultId from the loaded deck', async () => {
		const loader = createLoader();
		await loader.load(toArrayBuffer(await buildDeck()));

		// A blank deck ships its own default table style GUID; the loader must
		// mirror `PptxData.tableStylesDefaultId` from the very first load, the
		// same way `viewProperties`/`tableStyleMap` are seeded.
		expect(loader.tableStylesDefaultId()).toBeTruthy();
		expect(loader.tableStylesToDelete()).toStrictEqual([]);
	});
});
