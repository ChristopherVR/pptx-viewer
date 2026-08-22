/**
 * Integration: what a save does to `<p:bg>` on a slide master and its layouts.
 *
 * Two defects met here.
 *
 * 1. `p:bg` has two mutually exclusive shapes (§19.3.1.1): `p:bgPr` is a
 *    literal fill, `p:bgRef` points into the theme's `a:bgFillStyleLst`. The
 *    loader flattens a `bgRef` to a hex so something can be painted, every
 *    binding hands the whole `slideMasters` array back on every save, and the
 *    writer treated "colour is defined" as "colour was chosen": the first save
 *    of any deck rewrote the reference into a literal fill and the master
 *    stopped following its theme.
 * 2. Nothing ever passed the `slideLayouts` save option, and the layout writer
 *    only read that option, so every layout-level edit made through
 *    `slideMasters[i].layouts[j]` (the shape the Slide Master view produces)
 *    was dropped.
 *
 * Ground truth for case 1's *edited* branch is PowerPoint itself: setting
 * `CustomLayouts(1).Background.Fill.Solid()` through COM on a stock deck emits
 * `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>
 * <a:effectLst/></p:bgPr></p:bg>` and drops the reference, while untouched
 * layouts keep no `<p:bg>` at all.
 *
 * And ground truth for the *unedited* branch is the theme-follow test, which is
 * what "keeps a themed `p:bgRef`" is actually protecting. Repointing the
 * theme's light-1 slot through COM
 * (`SlideMaster.Theme.ThemeColorScheme.Colors(msoThemeLight1).RGB`) and reading
 * `SlideMaster.Background.Fill.ForeColor.RGB` back measured:
 *
 *   PowerPoint's own deck   before=0xFFFFFF after=0x2266AA  followed
 *   through our save (now)  before=0xFFFFFF after=0x2266AA  followed
 *   with `bgRef` flattened  before=0xFFFFFF after=0xFFFFFF  pinned
 *
 * A literal fill is not a different spelling of the same colour; it severs the
 * link and the deck can never be re-themed again. Asserting the colour
 * round-trips would have passed on all three.
 */
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxData } from '../../core/types';

/** A freshly loaded deck whose master carries `<p:bgRef idx="1001">`. */
async function loadGeneratedDeck(): Promise<{ handler: PptxHandler; data: PptxData }> {
	const seed = await PresentationBuilder.create();
	const bytes = await seed.handler.save(seed.data.slides);
	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	return { handler, data };
}

async function partXml(saved: Uint8Array, partPath: string): Promise<string> {
	const zip = await JSZip.loadAsync(saved);
	const entry = zip.file(partPath);
	expect(entry, `${partPath} missing from saved archive`).toBeTruthy();
	return entry!.async('string');
}

function backgroundOf(xml: string): string {
	return xml.match(/<p:bg>[\s\S]*?<\/p:bg>/u)?.[0] ?? '';
}

describe('slide master and layout background round-trip', () => {
	it('keeps a themed `p:bgRef` when nobody edited the background', async () => {
		const { handler, data } = await loadGeneratedDeck();
		const master = data.slideMasters![0];
		// The loader resolved the reference to a paintable colour, which is the
		// value every binding hands straight back on save.
		expect(master.backgroundColor).toBeTruthy();

		const saved = await handler.save(data.slides, { slideMasters: data.slideMasters });
		const bg = backgroundOf(await partXml(saved, master.path));
		expect(bg).toContain('<p:bgRef');
		expect(bg).not.toContain('<p:bgPr');
	});

	it('replaces `p:bgRef` with an explicit `p:bgPr` when a colour is chosen', async () => {
		const { handler, data } = await loadGeneratedDeck();
		const master = data.slideMasters![0];
		master.backgroundColor = '#ff0000';

		const saved = await handler.save(data.slides, { slideMasters: data.slideMasters });
		const bg = backgroundOf(await partXml(saved, master.path));
		expect(bg).not.toContain('<p:bgRef');
		expect(bg).toContain('<a:srgbClr val="FF0000"');
	});

	it('persists a layout background chosen through `slideMasters[].layouts[]`', async () => {
		const { handler, data } = await loadGeneratedDeck();
		const master = data.slideMasters![0];
		const layout = master.layouts![0];
		layout.backgroundColor = '#123456';

		const saved = await handler.save(data.slides, { slideMasters: data.slideMasters });
		const bg = backgroundOf(await partXml(saved, layout.path));
		expect(bg).toContain('<a:srgbClr val="123456"');

		// And it survives the reload, so the value is really in the part rather
		// than only in the model the binding still holds.
		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		expect(reloaded.slideMasters?.[0]?.layouts?.[0]?.backgroundColor?.toUpperCase()).toBe(
			'#123456',
		);
	});

	it('leaves an unedited layout with no `p:bg` at all, as PowerPoint does', async () => {
		const { handler, data } = await loadGeneratedDeck();
		const master = data.slideMasters![0];
		master.layouts![0].backgroundColor = '#123456';

		const saved = await handler.save(data.slides, { slideMasters: data.slideMasters });
		const untouched = master.layouts![1];
		expect(backgroundOf(await partXml(saved, untouched.path))).toBe('');
	});

	it('persists other layout-level edits made through the master model', async () => {
		const { handler, data } = await loadGeneratedDeck();
		const layout = data.slideMasters![0].layouts![0];
		layout.matchingName = 'RoutedThroughMaster';
		layout.preserve = true;

		const saved = await handler.save(data.slides, { slideMasters: data.slideMasters });
		const xml = await partXml(saved, layout.path);
		expect(xml).toContain('matchingName="RoutedThroughMaster"');
		expect(xml).toContain('preserve="1"');
	});

	// `p:sldMaster/@preserve` (CT_SlideMaster, ECMA-376 §19.3.1.38) mirrors
	// the layout-level flag exercised above: PowerPoint auto-deletes an
	// unused master unless this is set.
	it('persists `p:sldMaster/@preserve` set through the typed model', async () => {
		const { handler, data } = await loadGeneratedDeck();
		const master = data.slideMasters![0];
		master.preserve = true;

		const saved = await handler.save(data.slides, { slideMasters: data.slideMasters });
		const xml = await partXml(saved, master.path);
		expect(xml).toContain('preserve="1"');

		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		expect(reloaded.slideMasters?.[0]?.preserve).toBeTruthy();
	});

	it('parses `p:sldMaster/@preserve="0"` as false rather than leaving it unset', async () => {
		const { handler, data } = await loadGeneratedDeck();
		const master = data.slideMasters![0];
		master.preserve = false;

		const saved = await handler.save(data.slides, { slideMasters: data.slideMasters });
		const xml = await partXml(saved, master.path);
		expect(xml).toContain('preserve="0"');

		const reloaded = await handler.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		expect(reloaded.slideMasters?.[0]?.preserve).toBeFalsy();
	});
});
