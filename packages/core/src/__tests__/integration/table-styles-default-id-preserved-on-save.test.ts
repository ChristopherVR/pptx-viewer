import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import {
	addTableStyleToMap,
	createTableStyleEntry,
} from '../../core/core/runtime/table-style-editor';
import { PptxHandler } from '../../core/PptxHandler';
import type { ParsedTableStyleMap, PptxData } from '../../core/types';

/**
 * `PptxData.tableStylesDefaultId` (from `a:tblStyleLst/@def`) must be
 * honoured on save when `saveOptions.tableStylesDefaultId` is ABSENT: a
 * caller editing table styles for an unrelated reason (adding/renaming a
 * style) must not accidentally clear or change which style GUID the deck's
 * `@def` claims as default. `applyTableStylesPart` (`PptxHandlerRuntime
 * SaveViewProperties.ts`) only overwrites `@def` when `hasDefault` (an
 * explicit `tableStylesDefaultId` was passed); otherwise the value already
 * parsed off the untouched source XML survives, which this proves via a
 * SECOND save that rewrites `ppt/tableStyles.xml` (by passing an unrelated
 * `tableStyles` edit) without repeating `tableStylesDefaultId`.
 */
async function buildSeed(): Promise<ArrayBuffer> {
	const { handler, data, createSlide } = await PresentationBuilder.create({ initialSlideCount: 0 });
	data.slides.push(createSlide('Blank').build());
	const seed = await handler.save(data.slides);
	return seed.buffer.slice(seed.byteOffset, seed.byteOffset + seed.byteLength) as ArrayBuffer;
}

describe('tableStylesDefaultId survives a save that omits it', () => {
	it('keeps the previously-set default GUID across a later, unrelated table-style edit', async () => {
		// Establish a default via an explicit first save.
		let handler = new PptxHandler();
		let data: PptxData = await handler.load(await buildSeed());
		let map: ParsedTableStyleMap = {};
		const defaultStyle = createTableStyleEntry(map, { styleName: 'Original Default' });
		addTableStyleToMap(map, defaultStyle);

		let saved = await handler.save(data.slides, {
			tableStyles: map,
			tableStylesDefaultId: defaultStyle.styleId,
		});

		handler = new PptxHandler();
		data = await handler.load(saved.buffer as ArrayBuffer);
		expect(data.tableStylesDefaultId).toBe(defaultStyle.styleId);

		// Second save: edit an UNRELATED style (forces a tableStyles.xml
		// rewrite) without passing tableStylesDefaultId at all.
		map = { ...data.tableStyleMap };
		const unrelated = createTableStyleEntry(map, { styleName: 'Unrelated New Style' });
		addTableStyleToMap(map, unrelated);

		saved = await handler.save(data.slides, { tableStyles: map });

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.tableStylesDefaultId).toBe(defaultStyle.styleId);
		expect(reloaded.tableStyleMap?.[unrelated.styleId]).toBeDefined();
	});
});
