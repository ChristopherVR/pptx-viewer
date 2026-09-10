/**
 * Generates `fidelity-showcase.pptx` - a one-slide deck carrying a real OOXML
 * `a:scene3d`/`a:sp3d` perspective camera + bevel/extrusion on one shape, for
 * `e2e/export-raster-fidelity.spec.ts`'s html2canvas-vs-foreignObject pixel
 * comparison (docs/guide/limitations.md's "Raster export" row).
 *
 * The perspective-camera shape is the one CSS-fidelity feature this deck can
 * authentically carry as authored OOXML (`visual-3d.ts` maps
 * `a:scene3d/a:camera/@prst` to a real CSS `perspective(...) rotateX/Y(...)`
 * transform on the element). `backdrop-filter` and a CSS-custom-property-
 * driven fill have no OOXML authoring path anywhere in this codebase (neither
 * maps to any `a:effectLst`/fill type any element renderer emits) - the spec
 * applies those two directly to the rendered stage via `page.evaluate`
 * instead, documented there.
 *
 * Slide layout:
 *   1. "Fidelity Showcase" title.
 *   2. A blue rounded-rectangle with `a:scene3d` (`cameraPreset:
 *      'perspectiveContrastingLeftFacing'`) and `a:sp3d` (metal bevel +
 *      extrusion) - real, round-tripping 3D properties.
 *
 * Built by mutating the SDK-built shape's `.style.scene3d`/`.style.shape3d`
 * directly: the fluent `SlideBuilder.addShape()` options do not (yet) expose
 * 3D scene/camera properties, but the built `PptxElement` is plain data, and
 * `PptxHandlerRuntimeSaveElementWriter`'s `save-shape-effects.ts` writes
 * `style.scene3d`/`style.shape3d` back to real `a:scene3d`/`a:sp3d` XML.
 *
 * Re-runnable; the spec invokes it from a no-freshness global setup (or
 * directly, `bun e2e/fixtures/generate-fidelity-showcase-fixture.ts`).
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const FIDELITY_SHOWCASE_SLIDE_TITLE = 'Fidelity Showcase';
export const FIDELITY_SHOWCASE_SHAPE_TEXT = 'PERSPECTIVE';
export const FIDELITY_SHOWCASE_CAMERA_PRESET = 'perspectiveContrastingLeftFacing';

export async function generateFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Raster Fidelity Showcase',
		initialSlideCount: 0,
	});

	const slide = createSlide('Blank')
		.addText(FIDELITY_SHOWCASE_SLIDE_TITLE, {
			x: 60,
			y: 40,
			width: 700,
			height: 70,
			fontSize: 30,
			bold: true,
		})
		.addShape('roundRect', {
			x: 180,
			y: 160,
			width: 400,
			height: 260,
			fill: { type: 'solid', color: '#4472C4' },
			text: FIDELITY_SHOWCASE_SHAPE_TEXT,
			textStyle: { bold: true, color: '#FFFFFF', fontSize: 28 },
		});

	const shape = slide.getLastElement();
	if (!shape || shape.type !== 'shape') {
		throw new Error('expected the just-added shape to be present');
	}
	shape.shapeStyle ??= {};
	// `a:scene3d`: a real perspective camera preset, round-tripped through
	// `save-shape-effects.ts` - the fixture's one authentically-authored CSS
	// 3D-transform feature (see `visual-3d.ts`'s camera-preset -> CSS
	// `perspective(...) rotate*(...)` mapping).
	shape.shapeStyle.scene3d = {
		cameraPreset: FIDELITY_SHOWCASE_CAMERA_PRESET,
		cameraFieldOfView: 2700000, // 45 degrees, in 1/60000 degree units
		lightRigType: 'threePt',
		lightRigDirection: 't',
	};
	// `a:sp3d`: metal bevel + extrusion, so the shape also carries a real
	// shadow/highlight gradient a raster diff can distinguish from a flat fill.
	shape.shapeStyle.shape3d = {
		presetMaterial: 'metal',
		extrusionHeight: 228600, // 0.25in in EMU
		extrusionColor: '#2F528F',
		bevelTopType: 'circle',
		bevelTopWidth: 190500, // ~0.208in in EMU
		bevelTopHeight: 190500,
	};

	data.slides.push(slide.build());

	const bytes = await handler.save(data.slides);

	const outPath = resolve(__dirname, 'fidelity-showcase.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

// Allow running directly (basename comparison; see the format-painter generator).
const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-fidelity-showcase-fixture.ts');
if (invokedDirectly) {
	generateFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
