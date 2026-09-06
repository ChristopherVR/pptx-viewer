/**
 * Generates `effect-sound-gallery.pptx` - a single-slide deck carrying one
 * shape with a real `p:timing` entrance animation, for
 * `e2e/effect-sound-gallery.spec.ts`.
 *
 * Deliberately a SINGLE slide (unlike `transitions-animations.pptx`): the
 * spec picks a stock sound for both the shape's effect and the slide's own
 * transition, neither of which needs slide navigation to author, and putting
 * the animated shape on slide 1 avoids depending on thumbnail-navigation
 * timing before a canvas click, which is a separate (pre-existing, unrelated)
 * concern in some bindings.
 *
 * Built via the SDK's `SlideBuilder.setTransition` / `addAnimation`, which
 * round-trip through `handler.save()` into real `p:transition` / `p:timing`
 * OOXML, exactly like `transitions-animations.pptx`.
 *
 * Re-runnable; the spec invokes it from globalSetup.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** The animated shape's own text. */
export const EFFECT_SOUND_SHAPE_TEXT = 'ANIMATE ME TOO';

export async function generateFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Effect Sound Gallery Fixture',
		initialSlideCount: 0,
	});

	const slide = createSlide('Blank')
		.addShape('rect', {
			x: 120,
			y: 220,
			width: 300,
			height: 150,
			fill: { type: 'solid', color: '#4472C4' },
			text: EFFECT_SOUND_SHAPE_TEXT,
			textStyle: { bold: true, color: '#FFFFFF', fontSize: 24 },
		})
		.setTransition({ type: 'fade', duration: 600 });
	const animatedShape = slide.getLastElement();
	if (!animatedShape) {
		throw new Error('expected the just-added shape to be present');
	}
	slide.addAnimation(animatedShape.id, { preset: 'fadeIn', trigger: 'onClick', duration: 500 });
	data.slides.push(slide.build());

	const bytes = await handler.save(data.slides);

	const outPath = resolve(__dirname, 'effect-sound-gallery.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

// Allow running directly (basename comparison; see the format-painter generator).
const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-effect-sound-gallery-fixture.ts');
if (invokedDirectly) {
	generateFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
