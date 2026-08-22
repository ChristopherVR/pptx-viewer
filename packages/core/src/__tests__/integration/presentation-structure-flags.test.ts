/**
 * Two presentation/layout-scoped boolean attributes the coverage audit
 * claimed were implemented, with different actual outcomes on inspection:
 *
 * - `p:sldLayout/@showMasterPhAnim` IS genuinely, fully implemented: parsed
 *   with the correct "absent = true" default
 *   (`PptxHandlerRuntimeSlideMasters.ts`), carried on the typed
 *   `PptxSlideLayout` model, and written back by
 *   `PptxHandlerRuntimeSaveSlideLayout.applySlideLayoutChange` - but nothing
 *   tested it (`PptxHandlerRuntimeSaveSlideLayout.ts` has no test file at
 *   all).
 *
 * - `p:presentation/@embedTrueTypeFonts` is now modelled: parsed onto
 *   `PptxData.embedTrueTypeFonts` (`extractEmbedTrueTypeFonts`), editable via
 *   the `embedTrueTypeFonts` save option, and written by
 *   `PptxPresentationSaveBuilder.applyEmbedTrueTypeFonts`. It stays purely
 *   declarative: this library only ever embeds fonts a caller explicitly
 *   supplies via `embeddedFontList`/`embeddedFonts` (there is no
 *   automatic embed-on-save), so the flag does not gate anything here - it
 *   only round-trips the author's stated preference, same as PowerPoint's own
 *   checkbox. `@saveSubsetFonts` is a separate, deliberately unimplemented
 *   flag (no glyph subsetting) and does not interact with this one.
 */
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxData, PptxSlideMaster } from '../../core/types';

async function partXml(saved: Uint8Array, partPath: string): Promise<string> {
	const zip = await JSZip.loadAsync(saved);
	const entry = zip.file(partPath);
	expect(entry, `${partPath} missing from saved archive`).toBeTruthy();
	return entry!.async('string');
}

/** The layout `initialSlideCount` slides use ("Blank", index 7 in the SDK's standard set). */
const BLANK_LAYOUT_PATH = 'ppt/slideLayouts/slideLayout7.xml';

function blankLayoutOf(master: PptxSlideMaster) {
	const layout = master.layouts?.find((l) => l.path === BLANK_LAYOUT_PATH);
	expect(layout, 'Blank layout must be present on the master').toBeTruthy();
	return layout!;
}

describe('p:sldLayout/@showMasterPhAnim', () => {
	it('defaults to undefined (spec default: true) when the attribute is absent', async () => {
		const built = await PresentationBuilder.create({ initialSlideCount: 1 });
		const seed = await built.handler.save(built.data.slides);
		const data = await new PptxHandler().load(seed.buffer as ArrayBuffer);
		const layout = blankLayoutOf(data.slideMasters![0]!);
		expect(layout.showMasterPhAnim).toBeUndefined();
	});

	it('survives an unrelated save untouched when nobody edited it (no slideMasters option)', async () => {
		const built = await PresentationBuilder.create({ initialSlideCount: 1 });
		const seed = await built.handler.save(built.data.slides);
		const zip = await JSZip.loadAsync(seed);
		const layoutXml = await zip.file(BLANK_LAYOUT_PATH)!.async('string');
		const patched = layoutXml.replace('<p:sldLayout ', '<p:sldLayout showMasterPhAnim="0" ');
		expect(patched).not.toBe(layoutXml);
		zip.file(BLANK_LAYOUT_PATH, patched);
		const bytes = await zip.generateAsync({ type: 'uint8array' });

		const handler = new PptxHandler();
		const data = await handler.load(bytes.buffer as ArrayBuffer);
		// A plain save with no `slideMasters` option never routes through
		// `applySlideLayoutChange`; the layout's cached XmlObject is flushed
		// as-is (the same passthrough that keeps every untouched layout
		// byte-identical).
		const saved = await handler.save(data.slides);
		const layoutXmlAfter = await partXml(saved, BLANK_LAYOUT_PATH);
		expect(layoutXmlAfter).toContain('showMasterPhAnim="0"');
	});

	it('parses an explicit @showMasterPhAnim="0" as false', async () => {
		const built = await PresentationBuilder.create({ initialSlideCount: 1 });
		const seed = await built.handler.save(built.data.slides);
		const zip = await JSZip.loadAsync(seed);
		const layoutXml = await zip.file(BLANK_LAYOUT_PATH)!.async('string');
		const patched = layoutXml.replace('<p:sldLayout ', '<p:sldLayout showMasterPhAnim="0" ');
		expect(patched).not.toBe(layoutXml);
		zip.file(BLANK_LAYOUT_PATH, patched);
		const bytes = await zip.generateAsync({ type: 'uint8array' });

		const data = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		const layout = blankLayoutOf(data.slideMasters![0]!);
		expect(layout.showMasterPhAnim).toBeFalsy();
	});

	it('round-trips an edit through the typed model: false -> XML -> parsed false again', async () => {
		const built = await PresentationBuilder.create({ initialSlideCount: 1 });
		const seed = await built.handler.save(built.data.slides);
		const handler = new PptxHandler();
		const data: PptxData = await handler.load(seed.buffer as ArrayBuffer);

		const layout = blankLayoutOf(data.slideMasters![0]!);
		layout.showMasterPhAnim = false;
		const saved = await handler.save(data.slides, { slideMasters: data.slideMasters });

		const layoutXml = await partXml(saved, BLANK_LAYOUT_PATH);
		expect(layoutXml).toContain('showMasterPhAnim="0"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(blankLayoutOf(reloaded.slideMasters![0]!).showMasterPhAnim).toBeFalsy();
	});

	it('writes @showMasterPhAnim="1" for an explicit true (not just omitted)', async () => {
		const built = await PresentationBuilder.create({ initialSlideCount: 1 });
		const seed = await built.handler.save(built.data.slides);
		const handler = new PptxHandler();
		const data: PptxData = await handler.load(seed.buffer as ArrayBuffer);

		const layout = blankLayoutOf(data.slideMasters![0]!);
		layout.showMasterPhAnim = true;
		const saved = await handler.save(data.slides, { slideMasters: data.slideMasters });

		const layoutXml = await partXml(saved, BLANK_LAYOUT_PATH);
		expect(layoutXml).toContain('showMasterPhAnim="1"');
	});
});

describe('p:presentation/@embedTrueTypeFonts', () => {
	it('defaults to undefined (spec default: false) when the attribute is absent', async () => {
		const built = await PresentationBuilder.create({ initialSlideCount: 1 });
		const seed = await built.handler.save(built.data.slides);
		const data = await new PptxHandler().load(seed.buffer as ArrayBuffer);
		expect(data.embedTrueTypeFonts).toBeUndefined();
	});

	it('parses an explicit @embedTrueTypeFonts="1" as true onto the typed model', async () => {
		const built = await PresentationBuilder.create({ initialSlideCount: 1 });
		const seed = await built.handler.save(built.data.slides);
		const zip = await JSZip.loadAsync(seed);
		const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');
		const patched = presentationXml.replace(
			'saveSubsetFonts="1">',
			'saveSubsetFonts="1" embedTrueTypeFonts="1">',
		);
		expect(patched).not.toBe(presentationXml);
		zip.file('ppt/presentation.xml', patched);
		const bytes = await zip.generateAsync({ type: 'uint8array' });

		const data = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		expect(data.embedTrueTypeFonts).toBeTruthy();
	});

	it('survives an unrelated save as raw passthrough on the presentation root', async () => {
		const built = await PresentationBuilder.create({ initialSlideCount: 1 });
		const seed = await built.handler.save(built.data.slides);
		const zip = await JSZip.loadAsync(seed);
		const presentationXml = await zip.file('ppt/presentation.xml')!.async('string');
		const patched = presentationXml.replace(
			'saveSubsetFonts="1">',
			'saveSubsetFonts="1" embedTrueTypeFonts="1">',
		);
		expect(patched).not.toBe(presentationXml);
		zip.file('ppt/presentation.xml', patched);
		const bytes = await zip.generateAsync({ type: 'uint8array' });

		const handler = new PptxHandler();
		const data = await handler.load(bytes.buffer as ArrayBuffer);
		// An unrelated, typed edit (adding a slide) forces presentation.xml to
		// be rewritten (the sldIdLst changes); with no `embedTrueTypeFonts`
		// save option the writer leaves the attribute alone.
		const seedTwo = await PresentationBuilder.create({ initialSlideCount: 1 });
		data.slides.push(seedTwo.data.slides[0]!);
		const saved = await handler.save(data.slides);

		const resavedPresentationXml = await partXml(saved, 'ppt/presentation.xml');
		expect(resavedPresentationXml).toContain('embedTrueTypeFonts="1"');
	});

	it('round-trips an edit through the typed model: true -> XML -> parsed true again', async () => {
		const built = await PresentationBuilder.create({ initialSlideCount: 1 });
		const seed = await built.handler.save(built.data.slides);
		const handler = new PptxHandler();
		const data: PptxData = await handler.load(seed.buffer as ArrayBuffer);

		const saved = await handler.save(data.slides, { embedTrueTypeFonts: true });
		const presentationXml = await partXml(saved, 'ppt/presentation.xml');
		expect(presentationXml).toContain('embedTrueTypeFonts="1"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.embedTrueTypeFonts).toBeTruthy();
	});

	it('writes @embedTrueTypeFonts="0" for an explicit false (not just omitted)', async () => {
		const built = await PresentationBuilder.create({ initialSlideCount: 1 });
		const seed = await built.handler.save(built.data.slides);
		const handler = new PptxHandler();
		const data: PptxData = await handler.load(seed.buffer as ArrayBuffer);

		const saved = await handler.save(data.slides, { embedTrueTypeFonts: false });
		const presentationXml = await partXml(saved, 'ppt/presentation.xml');
		expect(presentationXml).toContain('embedTrueTypeFonts="0"');

		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		expect(reloaded.embedTrueTypeFonts).toBeFalsy();
	});
});
