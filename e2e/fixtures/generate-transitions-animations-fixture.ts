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
 * KNOWN CORE BUG worked around here (discovered while building this fixture):
 * `PptxAnimationWriteService` writes `p:spTgt/@spid` (and the app's own
 * `pptx:editorMeta` extension) using the animation's `elementId` VERBATIM
 * (`animation-write-node-builders.ts`), and `PptxNativeAnimationService` /
 * the editor-animation parser read that `@spid` back verbatim too
 * (`extractAnimationTargetId`) - neither side ever resolves it against a
 * shape's real OOXML `p:cNvPr/@id`. Meanwhile every *element*'s own `.id` is
 * reassigned on load to a purely positional id, `${slidePath}-shape-${index
 * among sibling <p:sp> nodes}` (`PptxHandlerRuntimeSpTreeParsing.ts`). The two
 * never reconcile: on ANY save-then-reload round trip (not just via this
 * SDK - this affects every animated .pptx this app loads), the animation's
 * target id and the shape's loaded element id are different strings, so the
 * animation never applies to anything. This is a real, load-bearing defect
 * beyond this fixture's scope to fix (it touches the write-side `spid`
 * resolution, the read-side target resolution, and the sp-tree parser's id
 * assignment together); it's called out in the e2e spec's module doc too.
 * Rather than ship a fixture that can never pass, this generator
 * POST-PROCESSES the saved slide 3 XML to rewrite the animation's target id
 * to the exact id the loader will assign to that shape - `ppt/slides/slide3.xml-shape-1`
 * (index 1: the title textbox is sibling `<p:sp>` index 0, the animated
 * rectangle is index 1) - so the fixture exercises real playback once loaded,
 * the same way a fixed loader/writer eventually should for every animated deck.
 *
 * Re-runnable; the spec invokes it from globalSetup.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// JSZip is a dependency of `pptx-viewer-core` (bundled, not re-exported); see
// `generate-chart-fixture.ts` for why it's resolved via the core package's own
// resolution scope rather than added as a direct e2e dependency.
import type JSZipType from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip') as {
	loadAsync: (typeof JSZipType)['loadAsync'];
} & (new () => JSZipType);

/** The deterministic post-load id of slide 3's animated shape (see the
 * KNOWN CORE BUG note above): the 2nd sibling `<p:sp>` (index 1) on slide 3. */
const ANIMATED_SHAPE_LOAD_ID = 'ppt/slides/slide3.xml-shape-1';

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

	const baseBytes = await handler.save(data.slides);

	// Post-process: rewrite the animation's target id from the SDK's internal
	// element id to the id the loader will actually assign that shape (see the
	// KNOWN CORE BUG note above). Every occurrence of the SDK id on slide 3 is
	// an animation-target reference (`p:spTgt/@spid` x2, plus the app's own
	// `pptx:editorMeta` extension), so a global string replace is safe and
	// exact - it never appears anywhere else in the file.
	const zip = await JSZip.loadAsync(baseBytes);
	const slide3Path = 'ppt/slides/slide3.xml';
	const slide3Xml = await zip.file(slide3Path)!.async('string');
	const patched = slide3Xml.split(animatedShape.id).join(ANIMATED_SHAPE_LOAD_ID);
	if (patched === slide3Xml) {
		throw new Error(
			`expected to find the animated shape's id ("${animatedShape.id}") in ${slide3Path}`,
		);
	}
	zip.file(slide3Path, patched);
	const bytes = await zip.generateAsync({ type: 'uint8array' });

	const outPath = resolve(__dirname, 'transitions-animations.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, bytes);
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
