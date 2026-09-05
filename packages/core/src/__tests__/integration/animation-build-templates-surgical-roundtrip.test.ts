import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../core/types';
import { PptxHandler } from '../../index';

/**
 * `p:tmpl/@lvl` write wiring (`buildTemplates`) on the SURGICAL timing write
 * path.
 *
 * `animation-build-templates-full-rebuild.test.ts` proves `buildTemplates`
 * survives the FULL-REBUILD path (a brand-new slide with no prior
 * `p:timing`). Most real decks are not brand new: they already have a
 * `p:timing` tree, so every save takes the SURGICAL path
 * (`surgicallyUpdateTimingTree`) instead, which used to clone `p:bldLst`
 * and never look at it again. That was correct for a build the editor never
 * touched, but meant editing `PptxElementAnimation.sequence` or
 * `.buildTemplates` through the model on an already-timed slide silently
 * kept the deck's stale `p:bldP` forever.
 *
 * `anatidae-animation.pptx` slide 1 is a real PowerPoint-authored deck whose
 * `p:timing` already carries a `p:bldLst` with two `p:bldP` entries: spid 2
 * (Title, no `@build`, i.e. "all at once") and spid 3 (Subtitle,
 * `@build="p"`, i.e. "by paragraph"). Editing spid 3's build here exercises
 * the surgical path end to end; spid 2 stays untouched to prove the fix does
 * not regress the "editor never opinionated" case.
 */
const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/anatidae-animation.pptx', import.meta.url),
);

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe('p:bldLst/p:bldP re-derivation on the surgical animation write path', () => {
	it('rewrites an existing p:bldP build type and p:tmplLst when the model edits sequence/buildTemplates', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		const slide = data.slides[0]!;
		// This fixture has never been touched by the editor: confirms the
		// surgical path (not the full-rebuild path) is what runs below.
		expect(slide.animations ?? []).toHaveLength(0);
		expect(slide.rawTiming).toBeDefined();

		const subtitle = slide.elements.find((el) => el.shapeId === '3');
		if (!subtitle) {
			throw new Error('subtitle element (shapeId 3) not found');
		}

		const preservedTnLst: XmlObject = {
			'p:par': { 'p:cTn': { '@_id': '99', '@_presetID': '1', '@_presetClass': 'entr' } },
		};
		slide.animations = [
			{
				elementId: subtitle.id,
				entrance: 'fadeIn',
				durationMs: 400,
				sequence: 'byWord',
				buildTemplates: [{ level: 2, timeNodeList: preservedTnLst, rawXml: { '@_lvl': '2' } }],
			},
		];

		const saved = await handler.save(data.slides);
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedSlide = reloaded.slides[0]!;

		const reloadedBldP = ((reloadedSlide.rawTiming as XmlObject)['p:bldLst'] as XmlObject)[
			'p:bldP'
		] as XmlObject[];
		const spid3 = reloadedBldP.find((node) => String(node['@_spid']) === '3');
		if (!spid3) {
			throw new Error('spid 3 p:bldP not found after save');
		}
		expect(spid3['@_build']).toBe('word');
		expect((spid3['p:tmplLst'] as XmlObject)['p:tmpl']).toMatchObject({ '@_lvl': '2' });

		const reloadedAnim = reloadedSlide.animations?.find((a) => a.sequence !== undefined);
		expect(reloadedAnim?.sequence).toBe('byWord');
		expect(reloadedAnim?.buildTemplates).toHaveLength(1);
		expect(reloadedAnim?.buildTemplates?.[0]?.level).toBe(2);
		expect(reloadedAnim?.buildTemplates?.[0]?.timeNodeList).toStrictEqual(preservedTnLst);
	});

	it("leaves an untouched p:bldP byte-identical when its animation's sequence is never set by the editor", async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		const slide = data.slides[0]!;

		const title = slide.elements.find((el) => el.shapeId === '2');
		if (!title) {
			throw new Error('title element (shapeId 2) not found');
		}
		const originalBldLst = JSON.parse(JSON.stringify((slide.rawTiming as XmlObject)['p:bldLst']));

		// Author an edit to this element's effect WITHOUT setting `sequence`:
		// the effect node itself is surgically patched (proving this is not a
		// no-op save), but the build-related fields stay `undefined`, i.e.
		// "never touched by the editor".
		slide.animations = [{ elementId: title.id, entrance: 'fadeIn', durationMs: 999 }];

		const saved = await handler.save(data.slides);
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedSlide = reloaded.slides[0]!;

		expect((reloadedSlide.rawTiming as XmlObject)['p:bldLst']).toStrictEqual(originalBldLst);
		// Confirm the save was not a no-op: the effect's duration did change.
		const reloadedAnim = reloadedSlide.animations?.find((a) => a.elementId === title.id);
		expect(reloadedAnim?.durationMs).toBe(999);
	});
});
