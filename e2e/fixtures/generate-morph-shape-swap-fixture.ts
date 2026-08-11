/**
 * Generates `morph-shape-swap.pptx` - two slides holding one shape that both
 * MOVES and changes its preset, for `e2e/morph-shape-swap.spec.ts`.
 *
 * A morph pair whose outline changes is driven by two animations at once: the
 * pair's own `transform` journey and a baked `clip-path` tween of the resolved
 * outline. Both are keyed on the incoming element's id, and while the plan
 * stored them in a map that overwrote rather than composed, the tween replaced
 * the journey: the arriving shape sat at its destination re-cutting its own
 * outline for the whole transition while its ghost flew the path alone.
 *
 * Nothing in the repo's real-deck fixtures exercises that. `solution-explorer`
 * holds the same freeform on both of its topic slides, so its pairs never ask
 * for a geometry morph at all, which is why the defect survived every existing
 * morph spec.
 *
 * The two shapes are 280 slide-pixels apart, inside the matcher's 300px
 * proximity threshold, so they pair on position alone and the spec does not
 * depend on how the SDK numbers `p:cNvPr/@id` across slides.
 *
 * Re-runnable; `global-setup.ts` invokes it on every Playwright run.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Where the morphing shape sits on each slide, in slide pixels. */
export const MORPH_SHAPE_FROM_X = 120;
export const MORPH_SHAPE_TO_X = 400;
export const MORPH_SHAPE_Y = 180;
export const MORPH_SHAPE_SIZE = 200;

/** The two presets, both of which `resolveElementOutline` can resolve. */
export const MORPH_SHAPE_FROM_TYPE = 'triangle';
export const MORPH_SHAPE_TO_TYPE = 'hexagon';

/** Duration authored on the incoming slide; the spec scrubs, so it only has to be sane. */
export const MORPH_DURATION_MS = 1000;

/** Geometry and fill shared by both slides' copy of the morphing shape. */
function badgeOptions(x: number) {
	return {
		x,
		y: MORPH_SHAPE_Y,
		width: MORPH_SHAPE_SIZE,
		height: MORPH_SHAPE_SIZE,
		fill: { type: 'solid', color: '#C0392B' },
	} as const;
}

export async function generateMorphShapeSwapFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Morph Shape Swap Fixture',
		initialSlideCount: 0,
	});

	// The morphing shape is added FIRST on both slides, so it is `-shape-0` and
	// the spec can address it without guessing at element numbering.
	data.slides.push(
		createSlide('Blank')
			.addShape(MORPH_SHAPE_FROM_TYPE, badgeOptions(MORPH_SHAPE_FROM_X))
			.addText('Morph Start', { x: 60, y: 40, width: 600, height: 60, fontSize: 28, bold: true })
			.build(),
	);

	data.slides.push(
		createSlide('Blank')
			.addShape(MORPH_SHAPE_TO_TYPE, badgeOptions(MORPH_SHAPE_TO_X))
			.addText('Morph End', { x: 60, y: 40, width: 600, height: 60, fontSize: 28, bold: true })
			.setTransition({ type: 'morph', duration: MORPH_DURATION_MS })
			.build(),
	);

	const bytes = await handler.save(data.slides);

	const outPath = resolve(__dirname, 'morph-shape-swap.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

// Allow running directly (basename comparison; see the format-painter generator).
const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-morph-shape-swap-fixture.ts');
if (invokedDirectly) {
	generateMorphShapeSwapFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
