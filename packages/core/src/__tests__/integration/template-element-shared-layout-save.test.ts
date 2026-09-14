/**
 * Regression guard: an edit to a layout-inherited shape must survive a save
 * that also carries a sibling slide's untouched copy of the same shape.
 *
 * Every slide on a layout is handed the SAME parsed layout element objects,
 * each pointing at one shared `rawXml` node inside the cached layout part. The
 * save writer persists an inherited edit by patching that node in place, and
 * it used to do so from EVERY slide's copy. Bindings update state immutably,
 * so the edit on slide 1 was a fresh element object while slide 2 still held
 * the pristine one; whichever the slide loop reached last won, and the
 * pristine copy quietly wrote the original scheme colour back over the edit.
 * The colour showed in the editor and was missing from the downloaded file.
 */
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSlide } from '../../core/types';

const SHAPE_NAME = 'Background_Picture_Dark';
const SCHEME_FILL =
	'<a:solidFill><a:schemeClr val="accent6"><a:lumMod val="20000"/><a:lumOff val="80000"/>' +
	'</a:schemeClr></a:solidFill>';

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Resolve the layout part a slide's own `.rels` points at. */
async function layoutPathOfSlide(zip: JSZip, slidePath: string): Promise<string> {
	const slideFile = slidePath.slice(slidePath.lastIndexOf('/') + 1);
	const rels = await zip.file(`ppt/slides/_rels/${slideFile}.rels`)?.async('string');
	const target = /Target="\.\.\/(slideLayouts\/slideLayout\d+\.xml)"/u.exec(rels ?? '')?.[1];
	if (!target) {
		throw new Error(`No slideLayout relationship for ${slidePath}`);
	}
	return `ppt/${target}`;
}

function decorativeShapeXml(): string {
	return (
		`<p:sp><p:nvSpPr><p:cNvPr id="90" name="${SHAPE_NAME}"/>` +
		`<p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="100000" y="200000"/><a:ext cx="1828800" cy="457200"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${SCHEME_FILL}</p:spPr></p:sp>`
	);
}

/**
 * Two blank slides on the same layout, with one decorative scheme-filled
 * shape injected into that layout.
 */
async function buildTwoSlideDeckWithLayoutShape(): Promise<{
	bytes: ArrayBuffer;
	layoutPath: string;
}> {
	const created = await PresentationBuilder.create();
	const first = created.createSlide('Blank').build();
	const second = created.createSlide('Blank').build();
	const seed = await created.handler.save([first, second]);

	const zip = await JSZip.loadAsync(seed);
	const layoutPath = await layoutPathOfSlide(zip, 'ppt/slides/slide1.xml');
	await expect(layoutPathOfSlide(zip, 'ppt/slides/slide2.xml')).resolves.toBe(layoutPath);
	const layoutXml = await zip.file(layoutPath)!.async('string');
	zip.file(layoutPath, layoutXml.replace('</p:spTree>', `${decorativeShapeXml()}</p:spTree>`));
	const bytes = await zip.generateAsync({ type: 'uint8array' });
	return { bytes: asArrayBuffer(bytes), layoutPath };
}

/**
 * A binding-style immutable edit: new slide, new element, new shapeStyle. The
 * style change is what Home > Shape Fill commits for a plain swatch: the hex
 * plus an explicit `fillColorRef: undefined`, since a retained theme ref wins
 * over the hex on save.
 */
function withFill(slide: PptxSlide, fillColor: string): PptxSlide {
	return {
		...slide,
		isDirty: true,
		elements: slide.elements.map((el) =>
			el.name === SHAPE_NAME && 'shapeStyle' in el
				? {
						...el,
						shapeStyle: { ...el.shapeStyle, fillMode: 'solid', fillColor, fillColorRef: undefined },
					}
				: el,
		),
	} as PptxSlide;
}

/** The `<p:sp>` markup of the injected shape inside a saved layout part. */
async function savedLayoutShape(saved: Uint8Array, layoutPath: string): Promise<string> {
	const zip = await JSZip.loadAsync(saved);
	const xml = await zip.file(layoutPath)!.async('string');
	const nameAt = xml.indexOf(`name="${SHAPE_NAME}"`);
	expect(nameAt, 'injected shape present in saved layout').toBeGreaterThan(-1);
	const start = xml.lastIndexOf('<p:sp>', nameAt);
	const end = xml.indexOf('</p:sp>', nameAt);
	return xml.slice(start, end + '</p:sp>'.length);
}

describe('template element edit with a sibling slide holding the untouched copy', () => {
	it('exposes the layout shape on both slides', async () => {
		const { bytes } = await buildTwoSlideDeckWithLayoutShape();
		const handler = new PptxHandler();
		const data = await handler.load(bytes);
		for (const slide of data.slides) {
			const copy = slide.elements.find((el) => el.name === SHAPE_NAME);
			expect(copy?.id.startsWith('layout-')).toBeTruthy();
		}
	});

	it('persists an edit made on slide 1 while slide 2 still holds the pristine copy', async () => {
		const { bytes, layoutPath } = await buildTwoSlideDeckWithLayoutShape();
		const handler = new PptxHandler();
		const [first, second] = (await handler.load(bytes)).slides;

		const saved = await handler.save([withFill(first, '#FF0000'), second]);
		const sp = await savedLayoutShape(saved, layoutPath);
		expect(sp).toContain('<a:srgbClr val="FF0000"');
		expect(sp).not.toContain('<a:schemeClr val="accent6"');
	});

	it('keeps the edit on a second save where slide 2 still holds its stale copy', async () => {
		const { bytes, layoutPath } = await buildTwoSlideDeckWithLayoutShape();
		const handler = new PptxHandler();
		const [first, second] = (await handler.load(bytes)).slides;

		const edited = withFill(first, '#FF0000');
		await handler.save([edited, second]);
		const saved = await handler.save([edited, { ...second, isDirty: true }]);
		const sp = await savedLayoutShape(saved, layoutPath);
		expect(sp).toContain('<a:srgbClr val="FF0000"');
		expect(sp).not.toContain('<a:schemeClr val="accent6"');
	});

	it('writes an undo (a new object carrying the original colour) back to the layout', async () => {
		const { bytes, layoutPath } = await buildTwoSlideDeckWithLayoutShape();
		const handler = new PptxHandler();
		const [first, second] = (await handler.load(bytes)).slides;

		await handler.save([withFill(first, '#FF0000'), second]);

		const undone: PptxSlide = {
			...first,
			isDirty: true,
			elements: first.elements.map((el) => (el.name === SHAPE_NAME ? { ...el } : el)),
		};
		const saved = await handler.save([undone, second]);
		const sp = await savedLayoutShape(saved, layoutPath);
		expect(sp).toContain('<a:schemeClr val="accent6"');
		expect(sp).not.toContain('<a:srgbClr val="FF0000"');
	});
});
