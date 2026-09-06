/**
 * Generates `box-cube-transition.pptx` - a three-slide deck exercising the
 * Cube and Box cinematic transitions (`p14:prism`, no flags vs
 * `isInverted="1"`), for `e2e/box-cube-transition-parity.spec.ts`.
 *
 * Box used to reuse Cube's CSS keyframes verbatim (see
 * `packages/shared/src/render/slide-transition-box.ts` for the COM
 * `CreateVideo`-measured fix): the two are visually distinct in real
 * PowerPoint, so this fixture pins that they resolve to different
 * `animation`/`transform` values at runtime in every binding, not just that
 * each one animates at all.
 *
 * Slide layout (order is the contract the spec relies on):
 *   1. "Slide One"  - plain, no transition.
 *   2. "Cube Slide" - `p:transition` type `cube`, direction `l`.
 *   3. "Box Slide"  - `p:transition` type `box`, direction `l`.
 *
 * Built via the SDK's `SlideBuilder.setTransition`, which round-trips through
 * `handler.save()` into real `p:transition` OOXML (`mc:AlternateContent` /
 * `p14:prism`), exactly like `generate-transitions-animations-fixture.ts`.
 *
 * Re-runnable; the spec invokes it from globalSetup.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Slide titles, in order - the contract the spec navigates by. */
export const BOX_CUBE_TRANSITION_SLIDES = {
	first: 'Slide One',
	cube: 'Cube Slide',
	box: 'Box Slide',
} as const;

/** Transition duration baked into the fixture; the spec reads this. */
export const BOX_CUBE_TRANSITION_DURATION_MS = 1600;

export async function generateFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Box vs Cube Transition Fixture',
		initialSlideCount: 0,
	});

	data.slides.push(
		createSlide('Blank')
			.addText(BOX_CUBE_TRANSITION_SLIDES.first, {
				x: 60,
				y: 60,
				width: 600,
				height: 80,
				fontSize: 32,
				bold: true,
			})
			.build(),
	);

	data.slides.push(
		createSlide('Blank')
			.addText(BOX_CUBE_TRANSITION_SLIDES.cube, {
				x: 60,
				y: 60,
				width: 600,
				height: 80,
				fontSize: 32,
				bold: true,
			})
			.setTransition({ type: 'cube', direction: 'l', duration: BOX_CUBE_TRANSITION_DURATION_MS })
			.build(),
	);

	data.slides.push(
		createSlide('Blank')
			.addText(BOX_CUBE_TRANSITION_SLIDES.box, {
				x: 60,
				y: 60,
				width: 600,
				height: 80,
				fontSize: 32,
				bold: true,
			})
			.setTransition({ type: 'box', direction: 'l', duration: BOX_CUBE_TRANSITION_DURATION_MS })
			.build(),
	);

	const bytes = await handler.save(data.slides);

	const outPath = resolve(__dirname, 'box-cube-transition.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

// Allow running directly (basename comparison; see the format-painter generator).
const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-box-cube-transition-fixture.ts');
if (invokedDirectly) {
	generateFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
