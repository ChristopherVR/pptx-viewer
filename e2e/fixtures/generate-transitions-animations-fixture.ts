/**
 * Generates `transitions-animations.pptx` - a four-slide deck exercising both
 * slide transitions and element animations, for
 * `e2e/animations-transitions.spec.ts`.
 *
 * Slide layout (order is the contract the spec relies on):
 *   1. "Slide One"        - plain, no transition, no animation.
 *   2. "Transition Target" - carries a real `p:transition` (`fade`, 600ms),
 *      which PowerPoint (and this app) plays when navigating *into* this
 *      slide from slide 1.
 *   3. "Animated Slide"    - transition `none` (so nothing masks the
 *      animation assertions), plus one shape ("ANIMATE ME") with a real
 *      `p:timing` entrance animation (`fadeIn`, `onClick`, 500ms).
 *   4. "End Slide"          - plain landing slide, reached only once the
 *      animation's click-group on slide 3 has been consumed.
 *
 * Built via the SDK's `SlideBuilder.setTransition` / `addAnimation`, which
 * round-trip through `handler.save()` into real `p:transition` / `p:timing`
 * OOXML. Loading this file fresh (via `#file-input`, not live-authoring the
 * effect in the same editing session) is what makes both effects observable
 * in every binding - see the module doc in the spec file for why.
 *
 * The animation-to-shape linkage survives the save now that core writes
 * `p:spTgt/@spid` (and the `pptx:editorMeta` extension) using the target
 * shape's native OOXML `p:cNvPr/@id` and reconciles it back to the loaded
 * element on the next load (see `animation-shape-id-assign` /
 * `animation-target-reconcile` in core). No post-processing of the saved XML
 * is needed: the SDK-authored deck plays back its animation once reloaded, the
 * same as any real animated `.pptx`.
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
export const TRANSITIONS_ANIMATIONS_SLIDES = {
	first: 'Slide One',
	transitionTarget: 'Transition Target',
	animated: 'Animated Slide',
	end: 'End Slide',
} as const;

/** The animated shape's own text, distinct from any slide title. */
export const ANIMATED_SHAPE_TEXT = 'ANIMATE ME';

/** Transition + animation timing baked into the fixture; specs read these. */
export const TRANSITION_DURATION_MS = 600;
export const ANIMATION_DURATION_MS = 500;

export async function generateFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Transitions & Animations Fixture',
		initialSlideCount: 0,
	});

	// Slide 1: plain.
	data.slides.push(
		createSlide('Blank')
			.addText(TRANSITIONS_ANIMATIONS_SLIDES.first, {
				x: 60,
				y: 60,
				width: 600,
				height: 80,
				fontSize: 32,
				bold: true,
			})
			.build(),
	);

	// Slide 2: real p:transition, played when navigating in from slide 1.
	data.slides.push(
		createSlide('Blank')
			.addText(TRANSITIONS_ANIMATIONS_SLIDES.transitionTarget, {
				x: 60,
				y: 60,
				width: 600,
				height: 80,
				fontSize: 32,
				bold: true,
			})
			.setTransition({ type: 'fade', duration: TRANSITION_DURATION_MS })
			.build(),
	);

	// Slide 3: transition 'none' (explicit, so it can't mask the animation
	// assertions), plus one shape with a real p:timing entrance animation.
	const slide3 = createSlide('Blank')
		.addText(TRANSITIONS_ANIMATIONS_SLIDES.animated, {
			x: 60,
			y: 60,
			width: 600,
			height: 80,
			fontSize: 32,
			bold: true,
		})
		.setTransition({ type: 'none' })
		.addShape('rect', {
			x: 120,
			y: 220,
			width: 300,
			height: 150,
			fill: { type: 'solid', color: '#4472C4' },
			text: ANIMATED_SHAPE_TEXT,
			textStyle: { bold: true, color: '#FFFFFF', fontSize: 24 },
		});
	const animatedShape = slide3.getLastElement();
	if (!animatedShape) {
		throw new Error('expected the just-added shape to be present');
	}
	slide3.addAnimation(animatedShape.id, {
		preset: 'fadeIn',
		trigger: 'onClick',
		duration: ANIMATION_DURATION_MS,
	});
	data.slides.push(slide3.build());

	// Slide 4: landing slide after the animation's click-group is consumed.
	data.slides.push(
		createSlide('Blank')
			.addText(TRANSITIONS_ANIMATIONS_SLIDES.end, {
				x: 60,
				y: 60,
				width: 600,
				height: 80,
				fontSize: 32,
				bold: true,
			})
			.build(),
	);

	const bytes = await handler.save(data.slides);

	const outPath = resolve(__dirname, 'transitions-animations.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

// Allow running directly (basename comparison; see the format-painter generator).
const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-transitions-animations-fixture.ts');
if (invokedDirectly) {
	generateFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
