/**
 * Presentation-level settings whose UI existed and whose data never reached
 * the file.
 *
 * Two independent defects met here:
 *
 *   1. `extractHeaderFooter()` read `p:presentation/p:hf`, which the OOXML
 *      schema does not allow (CT_Presentation, §19.2.1.26), so
 *      `PptxData.headerFooter` was `undefined` for every real deck and the
 *      Header & Footer dialog opened blank.
 *   2. `PptxPresentationSaveBuilder.applyHeaderFooter` ignored its argument
 *      and deleted any `p:hf` it found, so anything the dialog collected was
 *      discarded. Likewise `p:sldSz` was always re-written from the
 *      load-time dimensions, so a Slide Size edit reverted on reopen.
 *
 * The ground truth is PowerPoint's own: on a deck PowerPoint authored,
 * `SlideMaster.HeadersFooters.Footer.Text` reads the master's `ftr`
 * placeholder and `.Visible` reads `p:sldMaster/p:hf/@ftr`, and
 * `PageSetup.SlideSize` is derived from `p:sldSz/@cx`/`@cy` (an A4-typed
 * `p:sldSz` carrying 4:3 dimensions still reported `ppSlideSizeCustom`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { requireFixture } from '../../../__tests__/require-fixture';
import { PptxHandler } from '../../PptxHandler';

const fixturePath = requireFixture(
	fileURLToPath(
		new URL('../../../../../../e2e/fixtures/header-footer-shows.pptx', import.meta.url),
	),
);

function fixtureBuffer(): ArrayBuffer {
	const bytes = readFileSync(fixturePath);
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function loaded(): Promise<{
	handler: PptxHandler;
	data: Awaited<ReturnType<PptxHandler['load']>>;
}> {
	const handler = new PptxHandler();
	const data = await handler.load(fixtureBuffer());
	return { handler, data };
}

/** The first slide master's XML, inflated out of a saved package. */
async function masterXml(saved: Uint8Array): Promise<string> {
	const zip = await JSZip.loadAsync(saved);
	const path = Object.keys(zip.files)
		.filter((name) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/u.test(name))
		.sort()[0];
	return await zip.file(path)!.async('string');
}

async function presentationXml(saved: Uint8Array): Promise<string> {
	const zip = await JSZip.loadAsync(saved);
	return await zip.file('ppt/presentation.xml')!.async('string');
}

describe('header/footer round-trip', () => {
	it('reads the dialog state off the slide master rather than a non-existent p:presentation/p:hf', async () => {
		const { data } = await loaded();
		// Before the fix this was `undefined` for every real deck.
		expect(data.headerFooter).toBeDefined();
	}, 30_000);

	it('persists footer text and flags onto the slide master', async () => {
		const { handler, data } = await loaded();
		const saved = await handler.save(data.slides, {
			headerFooter: {
				hasFooter: true,
				footerText: 'Confidential Truth',
				hasSlideNumber: true,
				hasDateTime: false,
			},
		});

		const master = await masterXml(saved);
		expect(master).toContain('Confidential Truth');
		// Only the flag that actually CHANGED is written. The fixture's master
		// already means "footer and slide number shown" (it carries both
		// placeholders and a `p:hf` that says nothing about them), so restating
		// `ftr="1" sldNum="1"` would be a gratuitous diff on a part that would
		// otherwise pass through verbatim. Turning the date off is a real change
		// and has to be spelled out, because its spec default is `true`.
		expect(master).toMatch(/<p:hf[^>]*\bdt="0"/u);
		expect(master).not.toMatch(/<p:hf[^>]*\bftr="1"/u);
		// `p:hf` must never appear on `p:presentation`: PowerPoint rejects the
		// package with Sch_InvalidElementContentExpectingComplex.
		await expect(presentationXml(saved)).resolves.not.toContain('<p:hf');
	}, 30_000);

	it('reports the effective flags on reload, written or inherited', async () => {
		const { handler, data } = await loaded();
		const saved = await handler.save(data.slides, {
			headerFooter: { hasFooter: true, hasSlideNumber: true, hasDateTime: false },
		});

		const reloaded = new PptxHandler();
		const reread = await reloaded.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		expect(reread.headerFooter?.hasFooter).toBeTruthy();
		expect(reread.headerFooter?.hasSlideNumber).toBeTruthy();
		expect(reread.headerFooter?.hasDateTime).toBeFalsy();
	}, 30_000);

	it('leaves p:hf untouched when the dialog state matches the file', async () => {
		const { handler, data } = await loaded();
		const before = await masterXml(await handler.save(data.slides));
		// Every binding passes the parsed state back on every save, whether or
		// not the user opened the dialog. That must not churn the part.
		const after = await masterXml(
			await handler.save(data.slides, { headerFooter: data.headerFooter }),
		);
		expect(/<p:hf[^>]*>/u.exec(after)?.[0]).toBe(/<p:hf[^>]*>/u.exec(before)?.[0]);
	}, 30_000);

	it('re-reads what it wrote', async () => {
		const { handler, data } = await loaded();
		const saved = await handler.save(data.slides, {
			headerFooter: { hasFooter: true, footerText: 'Round Tripped', hasSlideNumber: false },
		});

		const reloaded = new PptxHandler();
		const reread = await reloaded.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		expect(reread.headerFooter?.footerText).toBe('Round Tripped');
		expect(reread.headerFooter?.hasFooter).toBeTruthy();
		expect(reread.headerFooter?.hasSlideNumber).toBeFalsy();
	}, 30_000);

	it('leaves the master alone when no header/footer option is supplied', async () => {
		const { handler, data } = await loaded();
		const before = await masterXml(await handler.save(data.slides));
		expect(before).not.toMatch(/Confidential Truth/u);
	}, 30_000);
});

describe('slide size round-trip', () => {
	it('writes a requested p:sldSz instead of the load-time dimensions', async () => {
		const { handler, data } = await loaded();
		const saved = await handler.save(data.slides, {
			slideSize: { widthEmu: 9906000, heightEmu: 6858000, type: 'A4' },
		});
		const presentation = await presentationXml(saved);
		expect(presentation).toMatch(/<p:sldSz[^>]*cx="9906000"/u);
		expect(presentation).toMatch(/<p:sldSz[^>]*cy="6858000"/u);
		expect(presentation).toMatch(/<p:sldSz[^>]*type="A4"/u);
	}, 30_000);

	it('re-reads the new dimensions', async () => {
		const { handler, data } = await loaded();
		const saved = await handler.save(data.slides, {
			slideSize: { widthEmu: 9906000, heightEmu: 6858000, type: 'A4' },
		});
		const reloaded = new PptxHandler();
		const reread = await reloaded.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		expect(reread.widthEmu).toBe(9906000);
		expect(reread.heightEmu).toBe(6858000);
		expect(reread.slideSizeType).toBe('A4');
	}, 30_000);

	it('drops @type when the caller explicitly clears it', async () => {
		const { handler, data } = await loaded();
		const saved = await handler.save(data.slides, {
			slideSize: { widthEmu: 7620000, heightEmu: 5715000, type: '' },
		});
		const presentation = await presentationXml(saved);
		expect(presentation).toMatch(/<p:sldSz[^>]*cx="7620000"/u);
		expect(presentation).not.toMatch(/<p:sldSz[^>]*type=/u);
	}, 30_000);

	it('preserves the loaded size when the option is omitted', async () => {
		const { handler, data } = await loaded();
		const saved = await handler.save(data.slides);
		const presentation = await presentationXml(saved);
		expect(presentation).toMatch(new RegExp(`<p:sldSz[^>]*cx="${data.widthEmu}"`, 'u'));
	}, 30_000);
});

describe('custom shows and sections round-trip', () => {
	it('keeps p:showPr/p:custShow across a save, so an authored show survives', async () => {
		const { handler, data } = await loaded();
		expect(data.presentationProperties?.showSlidesMode).toBe('customShow');
		const saved = await handler.save(data.slides, {
			presentationProperties: data.presentationProperties,
			customShows: data.customShows,
		});

		const reloaded = new PptxHandler();
		const reread = await reloaded.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		expect(reread.presentationProperties?.showSlidesMode).toBe('customShow');
		expect(reread.presentationProperties?.showSlidesCustomShowId).toBe('0');
		// The membership must stay relationship ids: PowerPoint rejects a
		// `p:custShow/p:sldLst/p:sld/@r:id` that is anything else.
		expect(reread.customShows?.map((show) => show.slideRIds)).toStrictEqual([
			['rId2', 'rId4'],
			['rId4', 'rId3', 'rId2'],
		]);
	}, 30_000);

	it('exposes the presentation-level slide id every section names slides by', async () => {
		const { data } = await loaded();
		// PowerPoint's ST_SlideId starts at 256; anything 1-based means the id
		// was fabricated from the slide number.
		for (const slide of data.slides) {
			expect(Number(slide.slideId)).toBeGreaterThanOrEqual(256);
		}
	}, 30_000);

	it('round-trips a section authored here with its slides still in it', async () => {
		const { handler, data } = await loaded();
		const section = {
			id: '{4E9C3F1A-0B2D-4C7E-9A1F-2D3E4F5A6B7C}',
			name: 'Intro',
			slideIds: data.slides.slice(0, 2).map((slide) => String(slide.slideId)),
		};
		const saved = await handler.save(data.slides, { sections: [section] });

		const reloaded = new PptxHandler();
		const reread = await reloaded.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		expect(reread.sections?.[0]?.slideIds).toStrictEqual(section.slideIds);
		// The membership has to reach the SLIDES too, or the rail shows every
		// slide as ungrouped while the section header sits above nothing.
		expect(reread.slides.map((slide) => slide.sectionId)).toStrictEqual([
			section.id,
			section.id,
			undefined,
		]);
	}, 30_000);
});
