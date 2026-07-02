/**
 * Regression test for GitHub issue #36: slide-layout element IDs collided
 * across different layout parts.
 *
 * Background: layout-inherited elements are given ids like
 * `layout-pic-${indexInType}`, where `indexInType` is only unique WITHIN a
 * single layout's own `p:spTree`. Two slides that use *different* layouts
 * (e.g. slideLayout4 and slideLayout7) each get their own first picture
 * indexed at 0, so both produced the identical id `layout-pic-0`. Since that
 * id is used as a Map key for resolved media bytes and as a React list key,
 * two unrelated pictures from two different layouts collided, and one
 * clobbered / shadowed the other.
 *
 * The fix namespaces the id with a `layoutToken` derived from the owning
 * layout part's file name (e.g. "slideLayout7"), so the id becomes
 * `layout-pic-${layoutToken}-${indexInType}` (see
 * `PptxHandlerRuntimeLayoutElements.ts`). This test seeds a two-slide deck,
 * points each slide at a *different* layout, injects a distinctly-named
 * `<p:pic>` as the first picture in each of those two layouts, and asserts
 * the resulting `layout-pic-` ids differ and carry their respective layout's
 * token.
 */
import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';

const SLIDE1_RELS_PATH = 'ppt/slides/_rels/slide1.xml.rels';
const SLIDE2_RELS_PATH = 'ppt/slides/_rels/slide2.xml.rels';
const LAYOUT_A_PATH = 'ppt/slideLayouts/slideLayout7.xml'; // "Blank" (seed default)
const LAYOUT_B_PATH = 'ppt/slideLayouts/slideLayout1.xml'; // "Title Slide"

/** Build a minimal `<p:pic>` with an `a:xfrm` (required for parsePicture to
 * accept it) and a distinctive `cNvPr/@name` so the parsed element can be
 * identified after load. No real image relationship is needed since
 * `imagePath`/`imageData` resolve to `undefined` when the rel id is unknown. */
function pictureXml(id: number, name: string, xEmu: number, yEmu: number): string {
	return (
		`<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}"/>` +
		`<p:cNvPicPr/><p:nvPr/></p:nvPicPr>` +
		`<p:blipFill><a:blip r:embed="rIdDoesNotExist"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
		`<p:spPr><a:xfrm><a:off x="${xEmu}" y="${yEmu}"/><a:ext cx="914400" cy="914400"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
	);
}

/**
 * Seed a two-slide deck, verify (and if necessary force) that the two slides
 * point at different layouts, inject a distinctly-named `<p:pic>` as the
 * first picture into each of those two layouts, and return the repackaged
 * bytes.
 */
async function buildDeckWithCollidingLayoutPictures(): Promise<ArrayBuffer> {
	const { handler, data } = await PresentationBuilder.create({ initialSlideCount: 2 });
	const seed = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(seed);

	// Sanity-check the seed: both slides start out on the same ("Blank")
	// layout, which is exactly the setup that used to produce colliding ids.
	const slide1RelsXml = await zip.file(SLIDE1_RELS_PATH)!.async('string');
	const slide2RelsXml = await zip.file(SLIDE2_RELS_PATH)!.async('string');
	expect(slide1RelsXml).toContain('slideLayout7.xml');
	expect(slide2RelsXml).toContain('slideLayout7.xml');

	// Repoint slide 2 at a different, already-existing layout part.
	const patchedSlide2Rels = slide2RelsXml.replace('slideLayout7.xml', 'slideLayout1.xml');
	expect(patchedSlide2Rels).toContain('slideLayout1.xml');
	zip.file(SLIDE2_RELS_PATH, patchedSlide2Rels);

	// Inject the first picture into each of the two distinct layouts.
	const layoutAXml = await zip.file(LAYOUT_A_PATH)!.async('string');
	const layoutBXml = await zip.file(LAYOUT_B_PATH)!.async('string');
	const picA = pictureXml(90, 'LayoutAPic', 100000, 200000);
	const picB = pictureXml(91, 'LayoutBPic', 300000, 400000);
	zip.file(LAYOUT_A_PATH, layoutAXml.replace('</p:spTree>', `${picA}</p:spTree>`));
	zip.file(LAYOUT_B_PATH, layoutBXml.replace('</p:spTree>', `${picB}</p:spTree>`));

	const out = await zip.generateAsync({ type: 'uint8array' });
	return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

describe('layout element id collision (issue #36)', () => {
	it('namespaces layout-pic ids by owning layout so they do not collide across layouts', async () => {
		const buffer = await buildDeckWithCollidingLayoutPictures();
		const handler = new PptxHandler();
		const data = await handler.load(buffer);

		expect(data.slides).toHaveLength(2);
		const slide1Pic = data.slides[0].elements.find((e) => e.id.includes('layout-pic-'));
		const slide2Pic = data.slides[1].elements.find((e) => e.id.includes('layout-pic-'));

		expect(slide1Pic, 'slide 1 layout picture present').toBeTruthy();
		expect(slide2Pic, 'slide 2 layout picture present').toBeTruthy();

		// The core assertion: ids must differ across the two layouts. Before
		// the fix both would have been the identical `layout-pic-0`.
		expect(slide1Pic!.id).not.toBe(slide2Pic!.id);

		// Each id is namespaced with its own layout's token.
		expect(slide1Pic!.id).toContain('slideLayout7');
		expect(slide2Pic!.id).toContain('slideLayout1');

		// Cross-check via element name that we resolved the right picture for
		// the right slide (not merely differently-named ids that still point
		// at swapped data).
		expect('name' in slide1Pic! ? slide1Pic.name : undefined).toBe('LayoutAPic');
		expect('name' in slide2Pic! ? slide2Pic.name : undefined).toBe('LayoutBPic');
	});

	it('resolves distinct rawXml per slide instead of sharing a colliding map entry', async () => {
		const buffer = await buildDeckWithCollidingLayoutPictures();
		const handler = new PptxHandler();
		const data = await handler.load(buffer);

		const slide1Pic = data.slides[0].elements.find((e) => e.id.includes('layout-pic-'));
		const slide2Pic = data.slides[1].elements.find((e) => e.id.includes('layout-pic-'));

		const nameOf = (xml: unknown): string | undefined => {
			const parsed = xml as Record<string, unknown> | undefined;
			const nvPicPr = parsed?.['p:nvPicPr'] as Record<string, unknown> | undefined;
			const cNvPr = nvPicPr?.['p:cNvPr'] as Record<string, unknown> | undefined;
			return cNvPr?.['@_name'] as string | undefined;
		};

		expect(nameOf(slide1Pic!.rawXml)).toBe('LayoutAPic');
		expect(nameOf(slide2Pic!.rawXml)).toBe('LayoutBPic');
	});
});
