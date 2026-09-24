/**
 * SmartArt 3D parity ground truth: `e2e/fixtures/three-d-parity/three-d-smartart.pptx`
 * (112 slides: 8 layouts x 14 quick styles; slide n = layout floor((n-1)/14),
 * style ((n-1)%14)+1). Asserts the parsed `scene3d`/`shape3d`/`text3d` fields
 * against the values measured from PowerPoint's own saved XML (see the 3D
 * parity programme brief), for the "Basic Block List" layout (layout 0):
 *
 * - slide 6  = Polished (bevel style): per-shape `scene3d` (orthographicFront,
 *   flat/t) + `shape3d` (plastic, bevelT w=120900 h=88900).
 * - slide 10 = Brick Scene (scene style): whole-diagram `quickStyle.scene3d`
 *   (isometricOffAxis2Left, zoom=95000, flat/t), no per-shape scene3d, and a
 *   per-shape `shape3d` (extrusionH=381000, contourW=38100, matte, contour lt1
 *   -> white).
 * - slide 14 = Bird's Eye Scene: whole-diagram `quickStyle.scene3d`
 *   (perspectiveRelaxed, rot lat/lon/rev, soft light, backdrop), a per-shape
 *   `shape3d` (extrusionH=152250, matte, bevelT coolSlant), and a text-body
 *   `text3d` (extrusionH=28000, matte) extruding the label text itself.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { PptxSmartArtData, SmartArtPptxElement } from '../../types';

const fixture = fileURLToPath(
	new URL('../../../../../../e2e/fixtures/three-d-parity/three-d-smartart.pptx', import.meta.url),
);

async function loadSmartArt(slideIndex: number): Promise<PptxSmartArtData> {
	const bytes = readFileSync(fixture);
	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	const element = data.slides[slideIndex].elements.find(
		(el): el is SmartArtPptxElement => el.type === 'smartArt',
	);
	if (!element) {
		throw new Error(`slide ${slideIndex + 1} has no smartArt element`);
	}
	return element.smartArtData;
}

describe('smartArt 3D parsing (scene3d/sp3d) against ground truth', () => {
	it('polished (slide 6): per-shape scene3d + bevel shape3d, no whole-diagram scene', async () => {
		const smartArtData = await loadSmartArt(5);
		const shape = smartArtData.drawingShapes?.[0];
		expect(shape?.scene3d?.cameraPreset).toBe('orthographicFront');
		expect(shape?.scene3d?.lightRigType).toBe('flat');
		expect(shape?.scene3d?.lightRigDirection).toBe('t');
		expect(shape?.shape3d?.presetMaterial).toBe('plastic');
		expect(shape?.shape3d?.bevelTopWidth).toBe(120900);
		expect(shape?.shape3d?.bevelTopHeight).toBe(88900);
		expect(shape?.text3d).toBeUndefined();
	});

	it('brick scene (slide 10): whole-diagram camera, per-shape extrusion, no per-shape scene3d', async () => {
		const smartArtData = await loadSmartArt(9);
		expect(smartArtData.quickStyle?.scene3d?.cameraPreset).toBe('isometricOffAxis2Left');
		expect(smartArtData.quickStyle?.scene3d?.cameraZoom).toBe(95000);
		expect(smartArtData.quickStyle?.scene3d?.lightRigType).toBe('flat');

		const shape = smartArtData.drawingShapes?.[0];
		expect(shape?.scene3d).toBeUndefined();
		expect(shape?.shape3d?.extrusionHeight).toBe(381000);
		expect(shape?.shape3d?.contourWidth).toBe(38100);
		expect(shape?.shape3d?.presetMaterial).toBe('matte');
		expect(shape?.shape3d?.contourColor).toBe('#FFFFFF');
	});

	it("bird's eye scene (slide 14): whole-diagram camera with rotation/backdrop, extruded text", async () => {
		const smartArtData = await loadSmartArt(13);
		const scene = smartArtData.quickStyle?.scene3d;
		expect(scene?.cameraPreset).toBe('perspectiveRelaxed');
		expect(scene?.cameraRotX).toBe(19149996);
		expect(scene?.cameraRotY).toBe(20104178);
		expect(scene?.cameraRotZ).toBe(1577324);
		expect(scene?.lightRigType).toBe('soft');
		expect(scene?.hasBackdrop).toBeTruthy();
		expect(scene?.backdropAnchorZ).toBe(-210000);

		const shape = smartArtData.drawingShapes?.[0];
		expect(shape?.shape3d?.extrusionHeight).toBe(152250);
		expect(shape?.shape3d?.bevelTopType).toBe('coolSlant');
		expect(shape?.text3d?.extrusionHeight).toBe(28000);
		expect(shape?.text3d?.presetMaterial).toBe('matte');
	});

	it('simple fill (slide 1, flat style): shapes carry no scene3d/shape3d/text3d', async () => {
		const smartArtData = await loadSmartArt(0);
		const shape = smartArtData.drawingShapes?.[0];
		expect(shape?.scene3d).toBeUndefined();
		expect(shape?.shape3d).toBeUndefined();
		expect(shape?.text3d).toBeUndefined();
	});
});
