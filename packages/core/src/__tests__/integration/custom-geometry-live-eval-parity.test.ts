import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { evaluateCustomGeometryPathData } from '../../core/geometry/custom-geometry-live-eval';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSlide, ShapePptxElement } from '../../core/types';

/**
 * End-to-end proof that a real parsed `a:custGeom` (via `PptxHandler.load`,
 * not a hand-built fixture) preserves enough raw XML
 * (`customGeometryRawData.pathLstXml`, added alongside the existing
 * `avLstXml`/`gdLstXml`) for `evaluateCustomGeometryPathData` to re-derive the
 * outline at a DIFFERENT `adj1` than the one baked into `pathData` at parse
 * time - the on-canvas counterpart to a drag that hasn't committed yet.
 */

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function shapeFrom(slide: PptxSlide): ShapePptxElement {
	const shape = slide.elements.find((element) => element.type === 'shape');
	if (!shape || shape.type !== 'shape') {
		throw new Error('Expected a shape element');
	}
	return shape as ShapePptxElement;
}

// A freeform whose right edge is driven by `adj1` via a `a:gdLst` guide,
// exactly the shape of a hand-authored "convert to freeform then add a
// handle" geometry: `x1 = w * adj1 / 100000`, at the ECMA-376 20000ths-of-a-
// percent `adj1` convention (`val 25000` == 25%).
const CUSTOM_GEOMETRY = [
	'<a:custGeom>',
	'<a:avLst><a:gd name="adj1" fmla="val 25000"/></a:avLst>',
	'<a:gdLst><a:gd name="x1" fmla="*/ w adj1 100000"/></a:gdLst>',
	'<a:ahLst><a:ahXY gdRefX="adj1" minX="0" maxX="w"><a:pos x="x1" y="hd2"/></a:ahXY></a:ahLst>',
	'<a:cxnLst/><a:rect l="l" t="t" r="r" b="b"/>',
	'<a:pathLst><a:path w="200" h="100">',
	'<a:moveTo><a:pt x="0" y="0"/></a:moveTo>',
	'<a:lnTo><a:pt x="x1" y="0"/></a:lnTo>',
	'<a:lnTo><a:pt x="x1" y="100"/></a:lnTo>',
	'<a:close/>',
	'</a:path></a:pathLst>',
	'</a:custGeom>',
].join('');

async function buildShapeDeckWithCustomGeometry(): Promise<Uint8Array> {
	const created = await PresentationBuilder.create();
	const slide = created
		.createSlide('Blank')
		.addShape('rect', { x: 40, y: 40, width: 200, height: 100 })
		.build();
	const saved = await created.handler.save([slide]);

	const zip = await JSZip.loadAsync(saved);
	const originalXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
	const injectedXml = originalXml.replace(
		/<a:prstGeom\b[^>]*>(?:[\s\S]*?)<\/a:prstGeom>|<a:prstGeom\b[^>]*\/>/u,
		CUSTOM_GEOMETRY,
	);
	expect(injectedXml).not.toBe(originalXml);
	zip.file('ppt/slides/slide1.xml', injectedXml);
	return zip.generateAsync({ type: 'uint8array' });
}

describe('custom geometry live re-evaluation parity with a real parse', () => {
	it('preserves a:pathLst raw XML on customGeometryRawData alongside avLst/gdLst', async () => {
		const source = await buildShapeDeckWithCustomGeometry();
		const handler = new PptxHandler();
		const data = await handler.load(asArrayBuffer(source));
		const shape = shapeFrom(data.slides[0]);

		expect(shape.customGeometryRawData?.pathLstXml).toBeDefined();
		expect(shape.customGeometryRawData?.avLstXml).toBeDefined();
		expect(shape.customGeometryRawData?.gdLstXml).toBeDefined();
	});

	it('re-derives the outline at a live adj1 override the parsed pathData never saw', async () => {
		const source = await buildShapeDeckWithCustomGeometry();
		const handler = new PptxHandler();
		const data = await handler.load(asArrayBuffer(source));
		const shape = shapeFrom(data.slides[0]);

		// Parsed at the authored default (adj1 = 25000 -> x1 = 50).
		expect(shape.pathData).toBe('M 0 0 L 50 0 L 50 100 Z');

		// A drag in progress (not yet committed to shapeAdjustments/gdLst on
		// save) re-evaluates the SAME raw geometry at adj1 = 75000 -> x1 = 150,
		// with no save/reload round trip.
		const live = evaluateCustomGeometryPathData(
			shape.customGeometryRawData,
			shape.pathWidth ?? 0,
			shape.pathHeight ?? 0,
			{ adj1: 75000 },
		);
		expect(live?.pathData).toBe('M 0 0 L 150 0 L 150 100 Z');
	});

	it('saves a:pathLst coordinates that match the a:avLst it commits (single source of truth)', async () => {
		const source = await buildShapeDeckWithCustomGeometry();
		const handler = new PptxHandler();
		const data = await handler.load(asArrayBuffer(source));
		const slide = data.slides[0];
		const shape = shapeFrom(slide);

		// Simulate a committed handle drag: adj1 = 25000 -> 75000.
		shape.shapeAdjustments = { adj1: 75000 };
		slide.isDirty = true;

		const saved = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(saved);
		const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');

		// The new adj1 default is committed into a:avLst...
		expect(xml).toContain('<a:gd name="adj1" fmla="val 75000">');
		// ...and a:pathLst's x1-driven vertices are RE-EVALUATED to match it
		// (150, not the stale 50 baked in at parse time against the OLD
		// default), so the saved file does not contradict itself.
		expect(xml).not.toContain('x="50"');
		expect(xml).toContain('<a:pt x="150" y="0">');
		expect(xml).toContain('<a:pt x="150" y="100">');
	});
});
