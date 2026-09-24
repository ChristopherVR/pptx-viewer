import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

/**
 * Core save audit P0: `handler.save(slidesWithoutOne)` (the shape every
 * binding uses for slide delete, NOT the dialog-driven `opts` path that
 * always echoes `customShows`/`sections` back) left `p:custShowLst` and
 * `p14:sectionLst` untouched when the caller supplied neither option. A
 * custom show's `p:sld/@r:id` is a `presentation.xml.rels` relationship id
 * for the deleted slide's own relationship, which the reconciler drops
 * entirely from the rels part on delete, so the leftover reference pointed
 * at a relationship id that no longer existed anywhere in the package.
 * PowerPoint refuses to open a file with a dangling internal reference like
 * that. Sections have the analogous numeric-slide-id version of the bug.
 */
describe('custom show / section references survive a slide delete without opts', () => {
	it('prunes a custom show and section entry pointing at a removed slide', async () => {
		const created = await PresentationBuilder.create();
		created.data.slides.push(created.createSlide('Blank').addText('One').build());
		created.data.slides.push(created.createSlide('Blank').addText('Two').build());
		created.data.slides.push(created.createSlide('Blank').addText('Three').build());

		// Bake real (parser-produced) custom show + section XML into the file
		// via a normal opts save, exactly like an authoring host would.
		const baseBytes = await created.handler.save(created.data.slides);
		const baseZip = await JSZip.loadAsync(baseBytes);
		const basePresentation = await baseZip.file('ppt/presentation.xml')!.async('string');
		const slideMatches = [
			...basePresentation.matchAll(/<p:sldId\s+id="([^"]+)"\s+r:id="([^"]+)"/g),
		];
		expect(slideMatches).toHaveLength(3);
		const [[, id1, rId1], [, id2, rId2], [, id3, rId3]] = slideMatches;

		const seededBytes = await created.handler.save(created.data.slides, {
			customShows: [{ id: '1', name: 'All three', slideRIds: [rId1, rId2, rId3] }],
			sections: [
				{
					id: '{22222222-2222-2222-2222-222222222222}',
					name: 'Everything',
					slideIds: [id1, id2, id3],
				},
			],
		});

		// Reload as a fresh handler (parser-produced input, no hand-built XML)
		// and delete the middle slide the way a binding does: filter the
		// slide array and save WITHOUT re-passing customShows/sections.
		const editor = new PptxHandler();
		const seeded = await editor.load(seededBytes.buffer as ArrayBuffer);
		expect(seeded.customShows).toMatchObject([{ slideRIds: [rId1, rId2, rId3] }]);
		expect(seeded.sections).toMatchObject([{ slideIds: [id1, id2, id3] }]);

		const middleSlide = seeded.slides[1];
		const slidesWithoutMiddle = seeded.slides.filter((slide) => slide.id !== middleSlide.id);
		const editedBytes = await editor.save(slidesWithoutMiddle);

		// The saved package itself must not carry a custom-show / section
		// reference to a relationship id that no longer exists.
		const editedZip = await JSZip.loadAsync(editedBytes);
		const relsXml = await editedZip.file('ppt/_rels/presentation.xml.rels')!.async('string');
		const survivingRIds = new Set([...relsXml.matchAll(/Id="(rId\d+)"/g)].map((m) => m[1]));
		const presentationXml = await editedZip.file('ppt/presentation.xml')!.async('string');
		expect(presentationXml).not.toContain(`r:id="${rId2}"`);
		const custShowRIds = [...presentationXml.matchAll(/<p:sld\s+r:id="([^"]+)"/g)].map((m) => m[1]);
		for (const rid of custShowRIds) {
			expect(survivingRIds.has(rid)).toBeTruthy();
		}

		// Reload the edited package and confirm the surviving references
		// resolve to the correct (surviving) slides, not a stale/reused id.
		const reloader = new PptxHandler();
		const reloaded = await reloader.load(editedBytes.buffer as ArrayBuffer);
		expect(reloaded.slides).toHaveLength(2);
		const survivingRIdsOnSlides = reloaded.slides.map((slide) => slide.rId);

		// `p14:sldId/@id` (sections) is the numeric slide id, distinct from
		// the relationship id: map each surviving slide's rId to its current
		// numeric id from the just-edited presentation.xml.
		const numericIdByRId = new Map(
			[...presentationXml.matchAll(/<p:sldId\s+id="([^"]+)"\s+r:id="([^"]+)"/g)].map((m) => [
				m[2],
				m[1],
			]),
		);
		const survivingNumericIds = survivingRIdsOnSlides.map((rid) => numericIdByRId.get(rid));
		expect(survivingNumericIds.every((id) => id !== undefined)).toBeTruthy();

		expect(reloaded.customShows).toHaveLength(1);
		expect(reloaded.customShows![0].slideRIds).toStrictEqual(survivingRIdsOnSlides);

		expect(reloaded.sections).toHaveLength(1);
		expect(reloaded.sections![0].slideIds).toStrictEqual(survivingNumericIds);
	});
});
