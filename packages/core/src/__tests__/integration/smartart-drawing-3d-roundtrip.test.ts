/**
 * An EDITED 3D-styled SmartArt keeps its cached drawing-shape 3D on save.
 *
 * Ground truth: `e2e/fixtures/three-d-parity/three-d-smartart.pptx` (slide n
 * = layout floor((n-1)/14), quick style ((n-1)%14)+1; see
 * `smartart-drawing-shape-3d.test.ts` for the measured values). An unedited
 * diagram keeps its original parts verbatim; a node-text edit sets
 * `drawingDirty`, which makes the save pipeline regenerate
 * `ppt/diagrams/drawingN.xml` from the typed `drawingShapes`. That fabricated
 * part used to drop every `a:scene3d` / `a:sp3d` / text-body `a:sp3d`, so a
 * bevel or scene quick style reopened flat.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSlide, SmartArtPptxElement } from '../../core/types';
import { updateSmartArtNodeText } from '../../core/utils';

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/three-d-parity/three-d-smartart.pptx', import.meta.url),
);

function readFixture(): ArrayBuffer {
	const bytes = readFileSync(fixture);
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function smartArtOn(slides: PptxSlide[], slideIndex: number): SmartArtPptxElement {
	const element = slides[slideIndex].elements.find(
		(el): el is SmartArtPptxElement => el.type === 'smartArt',
	);
	if (!element?.smartArtData) {
		throw new Error(`slide ${slideIndex + 1} has no smartArt element`);
	}
	return element;
}

interface EditedRoundTrip {
	before: SmartArtPptxElement;
	after: SmartArtPptxElement;
	drawingXml: string;
	styleXml: string;
}

/** Load, edit the first node's text (forcing a drawing regenerate), save, reload. */
async function editAndRoundTrip(slideIndex: number): Promise<EditedRoundTrip> {
	const handler = new PptxHandler();
	const loaded = await handler.load(readFixture());
	const element = smartArtOn(loaded.slides, slideIndex);
	const before = structuredClone(element);
	const data = element.smartArtData!;
	const node = data.nodes.find((candidate) => candidate.text);
	expect(node).toBeDefined();
	element.smartArtData = {
		...updateSmartArtNodeText(data, node!.id, 'Edited'),
		quickStyleDirty: true,
	};
	expect(element.smartArtData.drawingDirty).toBeTruthy();

	const saved = await handler.save(loaded.slides);
	const zip = await JSZip.loadAsync(saved);
	const drawingXml = await zip.file(`ppt/diagrams/drawing${slideIndex + 1}.xml`)!.async('string');
	const styleXml = await zip.file(`ppt/diagrams/quickStyle${slideIndex + 1}.xml`)!.async('string');
	// The drawing part really was regenerated from the typed model.
	expect(drawingXml).toContain('<a:t>Edited</a:t>');

	const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
	return { before, after: smartArtOn(reloaded.slides, slideIndex), drawingXml, styleXml };
}

function shape3dFields(element: SmartArtPptxElement) {
	return (element.smartArtData?.drawingShapes ?? []).map((shape) => ({
		scene3d: shape.scene3d,
		shape3d: shape.shape3d,
		text3d: shape.text3d,
	}));
}

describe('edited SmartArt drawing keeps its 3D properties on save', () => {
	it('polished (slide 6): per-shape scene3d + plastic bevel survive a drawing regenerate', async () => {
		const { before, after, drawingXml } = await editAndRoundTrip(5);
		expect(shape3dFields(before)[0]?.shape3d?.bevelTopWidth).toBe(120900);
		expect(shape3dFields(after)).toStrictEqual(shape3dFields(before));

		expect(drawingXml).toContain(
			'<a:scene3d><a:camera prst="orthographicFront"/><a:lightRig rig="flat" dir="t"/></a:scene3d>',
		);
		expect(drawingXml).toMatch(
			/<a:sp3d prstMaterial="plastic"><a:bevelT prst="circle" w="120900" h="88900"\/><a:bevelB prst="angle" w="88900" h="31750"\/><\/a:sp3d><\/dsp:spPr>/u,
		);
	});

	it('brick scene (slide 10): extrusion + contour survive, no per-shape scene3d is invented', async () => {
		const { before, after, drawingXml, styleXml } = await editAndRoundTrip(9);
		expect(shape3dFields(after)).toStrictEqual(shape3dFields(before));
		expect(drawingXml).not.toContain('<a:scene3d>');
		expect(drawingXml).toContain('extrusionH="381000"');
		expect(drawingXml).toContain('contourW="38100"');
		expect(drawingXml).toContain('<a:contourClr><a:srgbClr val="FFFFFF"/></a:contourClr>');

		// The whole-diagram camera lives in the quick-style part, which is
		// merged surgically (never re-fabricated), so it survives untouched.
		expect(styleXml).toContain('isometricOffAxis2Left');
		expect(after.smartArtData?.quickStyle?.scene3d).toStrictEqual(
			before.smartArtData?.quickStyle?.scene3d,
		);
	});

	it("bird's eye scene (slide 14): coolSlant bevel and extruded label text survive", async () => {
		const { before, after, drawingXml } = await editAndRoundTrip(13);
		expect(shape3dFields(before)[0]?.text3d?.extrusionHeight).toBe(28000);
		expect(shape3dFields(after)).toStrictEqual(shape3dFields(before));
		expect(drawingXml).toContain(
			'<a:sp3d extrusionH="152250" prstMaterial="matte"><a:bevelT prst="coolSlant" w="165100"/></a:sp3d>',
		);
		expect(drawingXml).toContain(
			'<a:bodyPr anchor="ctr"><a:sp3d extrusionH="28000" prstMaterial="matte"/></a:bodyPr>',
		);
		expect(after.smartArtData?.quickStyle?.scene3d).toStrictEqual(
			before.smartArtData?.quickStyle?.scene3d,
		);
	});

	it('simple fill (slide 1): a flat style gains no 3D on regenerate', async () => {
		const { after, drawingXml } = await editAndRoundTrip(0);
		expect(drawingXml).not.toContain('<a:scene3d>');
		expect(drawingXml).not.toContain('<a:sp3d');
		expect(shape3dFields(after).every((f) => !f.scene3d && !f.shape3d && !f.text3d)).toBeTruthy();
	});
});
