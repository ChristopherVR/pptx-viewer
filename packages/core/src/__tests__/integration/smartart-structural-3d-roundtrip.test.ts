/**
 * A STRUCTURALLY edited 3D-styled SmartArt keeps its quick-style 3D on save.
 *
 * Companion to `smartart-drawing-3d-roundtrip.test.ts` (text edits, which keep
 * the cached drawing shapes). Adding or removing a node throws the cached
 * `drawingShapes` away; the save then rebuilds them from the layout engine,
 * which carries no 3D, so a bevel / scene quick style used to reopen flat.
 * The regenerated shapes now re-resolve the quick style's per-label 3D
 * (`dgm:styleLbl/dgm:scene3d|dgm:sp3d|dgm:txPr`), keyed by each node's style
 * label, the way PowerPoint does when it re-lays out a diagram.
 *
 * Ground truth: `e2e/fixtures/three-d-parity/three-d-smartart.pptx` (slides
 * 1-14 are the Basic Block List layout, every node on `node1`; slide n uses
 * quick style n). The expected 3D is what PowerPoint itself cached on the
 * ORIGINAL shapes, so a regenerated shape must match it exactly.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSlide, SmartArtPptxElement } from '../../core/types';
import { addSmartArtNode, removeSmartArtNode } from '../../core/utils';

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

type StructuralEdit = 'add' | 'remove';

interface StructuralRoundTrip {
	before: SmartArtPptxElement;
	after: SmartArtPptxElement;
	drawingXml: string;
	nodeCount: number;
}

/** Load, add or remove a node (dropping the cached drawing), save, reload. */
async function structuralRoundTrip(
	slideIndex: number,
	edit: StructuralEdit,
): Promise<StructuralRoundTrip> {
	const handler = new PptxHandler();
	const loaded = await handler.load(readFixture());
	const element = smartArtOn(loaded.slides, slideIndex);
	const before = structuredClone(element);
	const data = element.smartArtData!;
	element.smartArtData =
		edit === 'add'
			? addSmartArtNode(data, 'Added', data.nodes[1].id)
			: removeSmartArtNode(data, data.nodes[1].id);
	// The cached drawing really is gone: the save must regenerate it.
	expect(element.smartArtData.drawingDirty).toBeTruthy();
	expect(element.smartArtData.drawingShapes).toStrictEqual([]);
	const nodeCount = element.smartArtData.nodes.length;

	const saved = await handler.save(loaded.slides);
	const zip = await JSZip.loadAsync(saved);
	const drawingXml = await zip.file(`ppt/diagrams/drawing${slideIndex + 1}.xml`)!.async('string');
	if (edit === 'add') {
		expect(drawingXml).toContain('<a:t>Added</a:t>');
	}

	const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
	return { before, after: smartArtOn(reloaded.slides, slideIndex), drawingXml, nodeCount };
}

function shape3dFields(element: SmartArtPptxElement) {
	return (element.smartArtData?.drawingShapes ?? []).map((shape) => ({
		scene3d: shape.scene3d,
		shape3d: shape.shape3d,
		text3d: shape.text3d,
	}));
}

/**
 * Every reloaded shape (one per node, including an added one) carries exactly
 * the 3D PowerPoint cached on the original shapes (all `node1`, so identical).
 */
function expectEveryShapeMatchesPowerPoint(result: StructuralRoundTrip): void {
	const original = shape3dFields(result.before);
	expect(new Set(original.map((f) => JSON.stringify(f))).size).toBe(1);
	const after = shape3dFields(result.after);
	expect(after).toHaveLength(result.nodeCount);
	for (const fields of after) {
		expect(fields).toStrictEqual(original[0]);
	}
}

describe('structurally edited SmartArt keeps its quick-style 3D on save', () => {
	for (const edit of ['add', 'remove'] as const) {
		describe(`${edit} a node`, () => {
			it('polished bevel (slide 6): every shape gets the label scene3d + plastic bevel', async () => {
				const result = await structuralRoundTrip(5, edit);
				expectEveryShapeMatchesPowerPoint(result);
				expect(shape3dFields(result.after)[0]?.shape3d?.bevelTopWidth).toBe(120900);

				const scenes = result.drawingXml.match(
					/<a:scene3d><a:camera prst="orthographicFront"\/><a:lightRig rig="flat" dir="t"\/><\/a:scene3d>/gu,
				);
				expect(scenes).toHaveLength(result.nodeCount);
				const bevels = result.drawingXml.match(
					/<a:sp3d prstMaterial="plastic"><a:bevelT prst="circle" w="120900" h="88900"\/><a:bevelB prst="angle" w="88900" h="31750"\/><\/a:sp3d><\/dsp:spPr>/gu,
				);
				expect(bevels).toHaveLength(result.nodeCount);
			});

			it('brick scene (slide 10): every shape gets the extrusion + contour, no per-shape scene3d', async () => {
				const result = await structuralRoundTrip(9, edit);
				expectEveryShapeMatchesPowerPoint(result);
				expect(result.drawingXml).not.toContain('<a:scene3d>');
				expect(result.drawingXml.match(/extrusionH="381000"/gu)).toHaveLength(result.nodeCount);
				expect(
					result.drawingXml.match(/<a:contourClr><a:srgbClr val="FFFFFF"\/><\/a:contourClr>/gu),
				).toHaveLength(result.nodeCount);
				expect(result.after.smartArtData?.quickStyle?.scene3d?.cameraPreset).toBe(
					'isometricOffAxis2Left',
				);
			});

			it("bird's eye scene (slide 14): coolSlant bevel and label-text extrusion", async () => {
				const result = await structuralRoundTrip(13, edit);
				expectEveryShapeMatchesPowerPoint(result);
				expect(shape3dFields(result.after)[0]?.text3d?.extrusionHeight).toBe(28000);
				expect(
					result.drawingXml.match(
						/<a:sp3d extrusionH="152250" prstMaterial="matte"><a:bevelT prst="coolSlant" w="165100"\/><\/a:sp3d>/gu,
					),
				).toHaveLength(result.nodeCount);
			});

			it('simple fill (slide 1): a flat style stays flat', async () => {
				const result = await structuralRoundTrip(0, edit);
				expect(result.drawingXml).not.toContain('<a:scene3d>');
				expect(result.drawingXml).not.toContain('<a:sp3d');
				const after = shape3dFields(result.after);
				expect(after).toHaveLength(result.nodeCount);
				expect(after.every((f) => !f.scene3d && !f.shape3d && !f.text3d)).toBeTruthy();
			});
		});
	}
});
