/**
 * `image-fill-rot-with-shape.pptx` has two `<p:sp>` trapezoids whose fill is
 * `<a:blipFill>` (a shape filled by a picture, not a `<p:pic>`), parsed by
 * `parseShapeWithImageFill` as `type: 'picture'`. Two round-trip regressions
 * on this construct, both found by the core round-trip audit harness
 * (`rt.ts`, SIGMODE=elem/full):
 *
 * 1. `extractShapeStyle` marks this fill as `fillMode: 'image'` with a
 *    placeholder `fillColor: 'transparent'` (there is no single colour for an
 *    image fill). `writeShapeFill`'s `fillColor === 'transparent'` check
 *    misread that placeholder as an authored no-fill and replaced the
 *    `<a:blipFill>` with `<a:noFill/>` on every save, permanently losing the
 *    picture.
 * 2. `parseShapeWithImageFill` never captured `xEmu`/`yEmu`/`widthEmu`/
 *    `heightEmu` (the exact source EMU `resolveXfrmEmu` needs to re-emit a
 *    byte-identical `a:off`/`a:ext`), so EVERY shape-with-image-fill
 *    re-quantized its geometry from CSS pixels on every save, drifting by up
 *    to +/-4762 EMU (half a pixel) even when the shape itself was never
 *    touched, purely because a SIBLING element moved elsewhere on the slide.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';

const FIXTURE = fileURLToPath(
	new URL('../../../../../e2e/fixtures/image-fill-rot-with-shape.pptx', import.meta.url),
);

function fixtureBytes(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe('shape-with-image-fill save round-trip', () => {
	it('re-emits a:blipFill (not a:noFill) for an untouched picture-filled shape', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		const pictures = data.slides[0]!.elements.filter((element) => element.type === 'picture');
		expect(pictures).toHaveLength(2);

		// A slide only runs every element through the per-element save rewrite
		// (`processSlideElement`) once something on it is marked dirty; an
		// entirely untouched slide short-circuits to a byte-for-byte part copy,
		// which would hide this regression. `isDirty` is exactly how the editor
		// marks "this slide has an edit" after any change.
		data.slides[0]!.isDirty = true;
		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const slideXml = await zip.file('ppt/slides/slide1.xml')!.async('string');

		expect(slideXml.match(/<a:blipFill/g)).toHaveLength(2);
		expect(slideXml.match(/<a:blip r:embed="rId2"/g)).toHaveLength(2);
		// Each shape's fill (the `p:spPr` child right after its geometry) must
		// still be the blipFill, not `<a:noFill/>`. The fixture's own
		// `<a:ln><a:noFill/></a:ln>` (no outline) is untouched and legitimate;
		// the bug replaced the FILL itself, not the line.
		expect(slideXml.match(/<\/a:custGeom><a:blipFill/g)).toHaveLength(2);
	});

	it('does not re-quantize an untouched picture-filled shape geometry when a sibling moves', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBytes());
		const slide = data.slides[0]!;
		const pictures = slide.elements.filter(
			(element): element is Extract<(typeof slide.elements)[number], { type: 'picture' }> =>
				element.type === 'picture',
		);
		expect(pictures).toHaveLength(2);

		// Original authored EMU (see generate-image-fill-rot-with-shape-fixture.ts):
		// 40pt off, 280x140pt ext, both at 12700 EMU/pt.
		const untouched = pictures[0]!;
		expect(untouched.xEmu).toBe(508000);
		expect(untouched.yEmu).toBe(508000);
		expect(untouched.widthEmu).toBe(3556000);
		expect(untouched.heightEmu).toBe(1778000);

		// Move the OTHER shape only; the first must not be touched at all.
		const moved = pictures[1]!;
		moved.x += 7;

		const saved = await handler.save(data.slides);

		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const reloadedPictures = reloaded.slides[0]!.elements.filter(
			(element) => element.type === 'picture',
		) as typeof pictures;
		expect(reloadedPictures).toHaveLength(2);
		const reloadedUntouched = reloadedPictures[0]!;

		// The exact source EMU must survive byte-for-byte: no re-quantization
		// through CSS pixels for the shape that was never touched.
		expect(reloadedUntouched.xEmu).toBe(508000);
		expect(reloadedUntouched.yEmu).toBe(508000);
		expect(reloadedUntouched.widthEmu).toBe(3556000);
		expect(reloadedUntouched.heightEmu).toBe(1778000);
	});
});
