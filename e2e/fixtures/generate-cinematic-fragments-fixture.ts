/**
 * Generates `cinematic-fragments.pptx` - an eight-slide deck exercising the
 * seven cinematic transitions COM `CreateVideo` measurement showed rendering
 * as many independent fragments/tiles/particles in real PowerPoint rather
 * than a single animated layer: `vortex`, `honeycomb`, `glitter`, `shred`,
 * `fracture`, `curtains`, `airplane`. See
 * `packages/shared/src/render/slide-transition-fragments.ts` for the
 * measurement writeup and the descriptor engine this fixture exercises via
 * `e2e/cinematic-fragments-transition-parity.spec.ts`.
 *
 * Slide layout (order is the contract the spec relies on):
 *   1. "Base Slide"       - plain, no transition.
 *   2. "Vortex Slide"     - `vortex`, direction `l`.
 *   3. "Honeycomb Slide"  - `honeycomb`.
 *   4. "Glitter Slide"    - `glitter`.
 *   5. "Shred Slide"      - `shred`, direction `in` (its `dir` is
 *      `ST_TransitionInOutDirectionType`, not a cardinal direction - a
 *      cardinal `dir` on `p14:shred` produces a file real PowerPoint refuses
 *      to open at all, confirmed via COM `pptx-com-open.ps1` while building
 *      the measurement fixture).
 *   6. "Fracture Slide"   - `fracture`, direction `l`.
 *   7. "Curtains Slide"   - `curtains`, direction `l`.
 *   8. "Airplane Slide"   - `airplane`, direction `l`.
 *
 * Built via the SDK's `SlideBuilder.setTransition`, which round-trips through
 * `handler.save()` into real `p:transition` OOXML, exactly like
 * `generate-box-cube-transition-fixture.ts`.
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
export const CINEMATIC_FRAGMENTS_SLIDES = {
	base: 'Base Slide',
	vortex: 'Vortex Slide',
	honeycomb: 'Honeycomb Slide',
	glitter: 'Glitter Slide',
	shred: 'Shred Slide',
	fracture: 'Fracture Slide',
	curtains: 'Curtains Slide',
	airplane: 'Airplane Slide',
} as const;

/** Transition duration baked into the fixture; the spec reads this. */
export const CINEMATIC_FRAGMENTS_DURATION_MS = 1800;

const PRESETS = [
	{ title: CINEMATIC_FRAGMENTS_SLIDES.vortex, type: 'vortex', direction: 'l' },
	{ title: CINEMATIC_FRAGMENTS_SLIDES.honeycomb, type: 'honeycomb', direction: undefined },
	{ title: CINEMATIC_FRAGMENTS_SLIDES.glitter, type: 'glitter', direction: undefined },
	// shred's `dir` is in/out, never a cardinal direction - see the module doc.
	{ title: CINEMATIC_FRAGMENTS_SLIDES.shred, type: 'shred', direction: 'in' },
	{ title: CINEMATIC_FRAGMENTS_SLIDES.fracture, type: 'fracture', direction: 'l' },
	{ title: CINEMATIC_FRAGMENTS_SLIDES.curtains, type: 'curtains', direction: 'l' },
	{ title: CINEMATIC_FRAGMENTS_SLIDES.airplane, type: 'airplane', direction: 'l' },
] as const;

export async function generateFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Cinematic Fragment Transitions Fixture',
		initialSlideCount: 0,
	});

	data.slides.push(
		createSlide('Blank')
			.addText(CINEMATIC_FRAGMENTS_SLIDES.base, {
				x: 60,
				y: 60,
				width: 600,
				height: 80,
				fontSize: 32,
				bold: true,
			})
			.build(),
	);

	for (const preset of PRESETS) {
		data.slides.push(
			createSlide('Blank')
				.addText(preset.title, { x: 60, y: 60, width: 600, height: 80, fontSize: 32, bold: true })
				.setTransition({
					type: preset.type,
					direction: preset.direction,
					duration: CINEMATIC_FRAGMENTS_DURATION_MS,
				})
				.build(),
		);
	}

	const bytes = await handler.save(data.slides);

	const outPath = resolve(__dirname, 'cinematic-fragments.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

// Allow running directly (basename comparison; see the format-painter generator).
const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-cinematic-fragments-fixture.ts');
if (invokedDirectly) {
	generateFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
