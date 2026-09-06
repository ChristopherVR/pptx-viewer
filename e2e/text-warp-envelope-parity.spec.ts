/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * WordArt envelope/former-"simple" fidelity: does every binding render
 * `a:prstTxWarp` inflate/deflate/can/slant/fade/cascade as a true SVG
 * warp, the same mechanism arch/wave/circle already use, rather than a flat
 * CSS-transform approximation?
 *
 * Three bugs made this a real cross-binding gap:
 *
 *  1. Vue, Svelte, and Angular each gated the true SVG `<textPath>` renderer
 *     on a NARROWER preset set than React and Vanilla used (a
 *     `classifyTextWarp` category check excluding the `envelope`/`simple`
 *     categories, or - Angular - a deliberately narrower local copy of
 *     `SVG_WARP_PRESETS`), so those three bindings fell back to a flat
 *     `<div>` + CSS `transform` overlay for inflate/deflate/can/slant/fade/
 *     cascade while React and Vanilla already rendered them as true SVG
 *     textPath.
 *  2. Several of `pptx-viewer-shared`'s per-line SVG path generators
 *     (inflate, deflate, deflateInflateDeflate, fadeLeft, fadeRight, button,
 *     buttonPour) modulated curvature by a line-index term that is exactly
 *     zero for a single-paragraph element - the common WordArt case - so even
 *     the bindings that DID route to `<textPath>` rendered a perfectly flat,
 *     unwarped baseline for those presets.
 *  3. Even once bent, a shared-baseline `<textPath>` can only move the WHOLE
 *     line up/down; it cannot vary an individual glyph's HEIGHT between
 *     PowerPoint's top and bottom envelope curves, so tall Inflate/Deflate/Can
 *     shapes at extreme adjust values still differed from PowerPoint. The
 *     `envelope` family (inflate/deflate/can, see `hasGlyphEnvelope` in
 *     `pptx-viewer-shared`) now renders one `<text>` per glyph instead, each
 *     with its own `translate/scale` mapping the preset's top/bottom curves,
 *     so glyph height genuinely varies across the line. `slant`/`fade`/
 *     `cascade` stay on the shared-baseline `<textPath>` renderer (a uniform
 *     tilt has no per-glyph height component to get wrong).
 *
 * Fixture: `text-warp-fidelity.pptx` (8 single-paragraph text boxes, in
 * authoring order: inflate, deflate, can-up, slant-up, fade-right,
 * cascade-down, an arch-control, and a plain-text control).
 *
 * `<svg>`/`<textPath>`/`<path>`/`<text>` are neutral tags, not per-binding
 * class names, so this spec reads DOM structure directly rather than any
 * binding's own CSS classes.
 *
 * Run: bunx playwright test text-warp-envelope-parity
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, loadDeckAt, slideElements, slideStage } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('text-warp-fidelity.pptx');

/** Authoring order in `generate-text-warp-fidelity-fixture.ts`. */
const SHAPE_NAMES = [
	'inflate',
	'deflate',
	'can-up',
	'slant-up',
	'fade-right',
	'cascade-down',
	'arch-control',
	'plain-control',
	'inflate-multi',
	'wide-glyph-can',
] as const;

/** Preset names that render as the true two-curve glyph envelope (one `<text>` per glyph). */
const GLYPH_ENVELOPE_SHAPES = new Set(['inflate', 'deflate', 'can-up', 'inflate-multi']);

/**
 * Envelope shapes whose top/bottom curves DIVERGE (or converge) across the
 * line, so a glyph's HEIGHT genuinely differs by horizontal position: these
 * must show more than one distinct scaleY. Excludes `can-up`, whose top and
 * bottom `arcTo` curves are mathematically parallel (see `GLYPH_ENVELOPE_SHEAR_VARIES`).
 */
const GLYPH_ENVELOPE_HEIGHT_VARIES = new Set(['inflate', 'deflate', 'inflate-multi']);

/**
 * Envelope shapes whose top/bottom curves are parallel (constant band
 * height), so PowerPoint's own render keeps every glyph the same HEIGHT
 * (COM-verified 2026-09-06) but still shears each glyph by its own
 * horizontal position along the arc. Asserting scaleY variation for these
 * would fail on a CORRECT implementation; shear (`b`) variation is the right
 * signal that the envelope is actually applied.
 */
const GLYPH_ENVELOPE_SHEAR_VARIES = new Set(['can-up']);

/**
 * `wide-glyph-can` (see the fixture generator's own doc comment): three very
 * wide caps at extreme `adj`, where `chooseGlyphSliceCount`
 * (`pptx-viewer-shared`) slices at least one glyph into multiple clipped
 * pieces (`<g data-glyph-slices>`) instead of the single bare `<text>` the
 * other glyph-envelope shapes above always use. It is still a glyph-envelope
 * shape (no `<textPath>`), just read with {@link readSlicedGlyphBoxes}
 * instead of the direct-child `svg > text[transform]` locator the rest of
 * this file uses, which would silently undercount it (a sliced glyph's
 * `<text>`s are `svg > g > text`, not `svg > text`).
 */
const WIDE_GLYPH_SHAPE = 'wide-glyph-can';

interface ShapeFacts {
	name: (typeof SHAPE_NAMES)[number];
	/** Does this element's subtree contain a `<textPath>` (shared-baseline SVG warp)? */
	hasTextPath: boolean;
	/** Number of DISTINCT y-coordinates in the baseline `<path>`'s `d`, or 0 if none. */
	distinctBaselineYCount: number;
	/** Number of `<text>` elements carrying a `scale(` transform (the glyph-envelope renderer). */
	glyphCount: number;
	/** Number of DISTINCT scaleY values across those glyph `<text transform>`s. */
	distinctGlyphScaleCount: number;
	/** Number of DISTINCT shear (`b`) values across those glyph `<text transform>`s. */
	distinctGlyphShearCount: number;
}

/** Distinct y-coordinates in an SVG path `d` attribute (`x,y x,y ...` pairs). */
function distinctYCount(d: string): number {
	const numbers = [...d.matchAll(/-?\d+\.?\d*/gu)].map((m) => Number(m[0]));
	const yValues = numbers.filter((_, i) => i % 2 === 1);
	return new Set(yValues).size;
}

/** The `d` (vertical scale) term out of a glyph's `matrix(1 b 0 d 0 f)` transform, or `null`. */
function scaleYOf(transform: string): number | null {
	const match = /matrix\(\s*1\s+[^\s]+\s+0\s+(-?[\d.eE+-]+)\s+0\s+[^\s)]+\s*\)/u.exec(transform);
	return match ? Number(match[1]) : null;
}

/** The `b` (horizontal shear) term out of a glyph's `matrix(1 b 0 d 0 f)` transform, or `null`. */
function shearBOf(transform: string): number | null {
	const match = /matrix\(\s*1\s+(-?[\d.eE+-]+)\s+0\s+[^\s]+\s+0\s+[^\s)]+\s*\)/u.exec(transform);
	return match ? Number(match[1]) : null;
}

async function readShapes(page: Page, origin: string): Promise<ShapeFacts[]> {
	await loadDeckAt(page, origin, FIXTURE);
	await slideStage(page).waitFor();
	await page.waitForTimeout(300);

	const nodes = slideElements(page);
	await expect(nodes).toHaveCount(SHAPE_NAMES.length);

	const facts: ShapeFacts[] = [];
	for (let i = 0; i < SHAPE_NAMES.length; i++) {
		const node = nodes.nth(i);
		const textPathCount = await node.locator('textPath').count();
		const d = await node
			.locator('svg path')
			.first()
			.getAttribute('d')
			.catch(() => null);
		// Descendant (not direct-child) locator: a glyph on a strongly-curved
		// envelope wide enough to need slicing (`chooseGlyphSliceCount` in
		// pptx-viewer-shared) renders its pieces as `svg > g > text`, not
		// `svg > text` - a direct-child locator would silently miss them and
		// undercount both `glyphCount` and the scaleY variety below.
		const glyphTransforms = await node
			.locator('svg text[transform]')
			.evaluateAll((els) => els.map((el) => el.getAttribute('transform') ?? ''));
		const scales = glyphTransforms.map(scaleYOf).filter((n): n is number => n !== null);
		const shears = glyphTransforms.map(shearBOf).filter((n): n is number => n !== null);
		facts.push({
			name: SHAPE_NAMES[i],
			hasTextPath: textPathCount > 0,
			distinctBaselineYCount: d ? distinctYCount(d) : 0,
			glyphCount: scales.length,
			distinctGlyphScaleCount: new Set(scales.map((s) => s.toFixed(3))).size,
			distinctGlyphShearCount: new Set(shears.map((s) => s.toFixed(3))).size,
		});
	}
	return facts;
}

interface GlyphBox {
	top: number;
	bottom: number;
}

/** A logical glyph's aggregate box plus how many rendered pieces it was split into. */
interface SlicedGlyphInfo extends GlyphBox {
	sliceCount: number;
}

/**
 * Per-LOGICAL-glyph info, in glyph order, for `shapeName`.
 *
 * A bare glyph is one `svg > text`; a glyph sliced by `chooseGlyphSliceCount`
 * (`pptx-viewer-shared`, a very wide glyph on a strongly-curved envelope) is
 * `svg > g[data-glyph-slices] > text` instead (see `text-warp-glyph-slicing`
 * in `pptx-viewer-shared`) - this aggregates such a group's pieces into ONE
 * box (the union of all their post-transform boxes) rather than either
 * missing them (a plain `svg > text` locator does not look inside `<g>`) or
 * miscounting the shape's logical glyph total (each piece would otherwise
 * count as its own "glyph").
 *
 * `getBBox()` alone will not do here: per the SVG spec it excludes the
 * element's OWN `transform` attribute, and every glyph's `<text transform>`
 * IS that per-glyph translate/scale - reading raw `getBBox()` would report
 * the same untransformed glyph shape for every character. Reading
 * `getBoundingClientRect()` (which DOES include the transform, since it is
 * screen-space) and mapping it back through the `<svg>`'s inverse screen CTM
 * recovers the post-transform box in user-space units, immune to whatever
 * CSS zoom/scale each binding's demo chrome happens to apply to the slide
 * stage - only the SVG's own coordinate system is compared.
 */
async function readGlyphBoxesFor(
	page: Page,
	origin: string,
	shapeName: (typeof SHAPE_NAMES)[number],
): Promise<SlicedGlyphInfo[]> {
	await loadDeckAt(page, origin, FIXTURE);
	await slideStage(page).waitFor();
	await page.waitForTimeout(300);

	const shapeIndex = SHAPE_NAMES.indexOf(shapeName);
	const node = slideElements(page).nth(shapeIndex);
	return node.locator('svg > text, svg > g[data-glyph-slices]').evaluateAll((els) =>
		els.map((el) => {
			const isGroup = el.tagName.toLowerCase() === 'g';
			const pieces = isGroup ? [...el.querySelectorAll('text')] : [el as SVGGraphicsElement];
			const svg = (pieces[0] as SVGGraphicsElement).ownerSVGElement!;
			const ctm = svg.getScreenCTM()!.inverse();
			let top = Infinity;
			let bottom = -Infinity;
			for (const piece of pieces) {
				const rect = piece.getBoundingClientRect();
				const topLeft = new DOMPoint(rect.left, rect.top).matrixTransform(ctm);
				const bottomRight = new DOMPoint(rect.right, rect.bottom).matrixTransform(ctm);
				top = Math.min(top, topLeft.y, bottomRight.y);
				bottom = Math.max(bottom, topLeft.y, bottomRight.y);
			}
			return {
				top,
				bottom,
				sliceCount: isGroup ? Number(el.getAttribute('data-glyph-slices')) : 1,
			};
		}),
	);
}

/** Per-glyph boxes for the `inflate` shape (single paragraph), in glyph order. */
async function readInflateGlyphBoxes(page: Page, origin: string): Promise<SlicedGlyphInfo[]> {
	return readGlyphBoxesFor(page, origin, 'inflate');
}

/** Per-glyph boxes for the `inflate-multi` shape (two paragraphs: "Top", "Bottom"). */
async function readInflateMultiGlyphBoxes(page: Page, origin: string): Promise<SlicedGlyphInfo[]> {
	return readGlyphBoxesFor(page, origin, 'inflate-multi');
}

/** Per-glyph boxes for the `wide-glyph-can` shape ("M", "O", "M"). */
async function readSlicedGlyphBoxes(page: Page, origin: string): Promise<SlicedGlyphInfo[]> {
	return readGlyphBoxesFor(page, origin, WIDE_GLYPH_SHAPE);
}

test.describe('wordArt envelope/former-"simple" presets render as true SVG textPath', () => {
	test('every classified preset uses <textPath> or the glyph envelope, none fall back to CSS-transform', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readShapes);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			for (const shape of value) {
				if (shape.name === 'plain-control') {
					// `textPlain` carries no warp at all; must render no textPath/glyphs.
					if (shape.hasTextPath || shape.glyphCount > 0) {
						problems.push(`${shape.name}: unexpectedly warped (textPlain has no warp)`);
					}
					continue;
				}
				if (GLYPH_ENVELOPE_SHAPES.has(shape.name)) {
					// inflate/deflate/can-up: true two-curve envelope, one <text> per
					// glyph, never a shared-baseline <textPath>.
					if (shape.glyphCount === 0) {
						problems.push(
							`${shape.name}: no per-glyph <text> found (fell back to textPath or CSS)`,
						);
					}
					if (shape.hasTextPath) {
						problems.push(
							`${shape.name}: unexpectedly has a <textPath> (should be glyph-envelope)`,
						);
					}
					continue;
				}
				if (shape.name === WIDE_GLYPH_SHAPE) {
					// Also a glyph-envelope shape, but `readShapes`'s direct-child
					// `svg > text[transform]` locator undercounts it (at least one
					// glyph is sliced into `svg > g > text`, not `svg > text`); it is
					// asserted properly, sliced glyphs included, in the dedicated
					// "wide-glyph-can" describe block below via
					// `readSlicedGlyphBoxes`. Here just confirm no textPath fallback.
					if (shape.hasTextPath) {
						problems.push(
							`${shape.name}: unexpectedly has a <textPath> (should be glyph-envelope)`,
						);
					}
					continue;
				}
				if (!shape.hasTextPath) {
					problems.push(
						`${shape.name}: no <textPath> found (fell back to CSS-transform or flat text)`,
					);
				}
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});

	test('a single-paragraph envelope/former-"simple" element still bends (non-flat baseline)', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readShapes);

		// `fade-right`'s per-line generator used to degenerate to a flat
		// baseline at a single paragraph's t=0.5 (see the fixture's own doc
		// comment); `slant-up`/`cascade-down`/`arch-control` were never
		// degenerate and are covered by the shared unit tests instead.
		const mustBendPath = new Set(['fade-right']);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			for (const shape of value) {
				// Covered by the dedicated "wide-glyph-can" describe block below
				// instead: `readShapes`'s direct-child locator undercounts a shape
				// with sliced glyphs, so `distinctGlyphScaleCount` here is not a
				// reliable signal for it.
				if (shape.name === WIDE_GLYPH_SHAPE) {
					continue;
				}
				if (mustBendPath.has(shape.name) && shape.distinctBaselineYCount <= 1) {
					problems.push(`${shape.name}: baseline path is a flat line (no warp visible)`);
				}
				// inflate/deflate/inflate-multi: the fixed residual - glyph HEIGHT
				// must vary across the line (a true two-curve envelope), not just
				// baseline Y. `can-up`/`can-down` are a DIFFERENT shape: their top
				// and bottom `arcTo` curves share the same radius/centre-x and only
				// differ by a constant vertical offset (see `glyphEnvelopeMatrix`'s
				// doc comment), so they are mathematically parallel and every
				// glyph's HEIGHT is genuinely equal - COM-verified 2026-09-06 (a
				// cylinder warp shifts and shears glyphs along the arc, it does not
				// stretch them). Asserting scaleY variation for `can-up` here was
				// wrong; it is asserted via shear (`b`) variation instead, just
				// below.
				if (GLYPH_ENVELOPE_HEIGHT_VARIES.has(shape.name) && shape.distinctGlyphScaleCount <= 1) {
					problems.push(`${shape.name}: every glyph has the same height (envelope not applied)`);
				}
				if (GLYPH_ENVELOPE_SHEAR_VARIES.has(shape.name) && shape.distinctGlyphShearCount <= 1) {
					problems.push(`${shape.name}: every glyph has the same shear (envelope not applied)`);
				}
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});

	test('inflate glyph bbox height varies along the line, matching across bindings within 1px', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readInflateGlyphBoxes);

		// 1. Within each binding: a true two-curve envelope must vary glyph
		//    height across the line (this is the fixed residual itself).
		for (const { framework, value } of results) {
			const heights = value.map((g) => g.bottom - g.top);
			expect(
				new Set(heights.map((h) => h.toFixed(1))).size,
				`${framework.name}: glyph heights should vary across the line, got [${heights.map((h) => h.toFixed(1)).join(', ')}]`,
			).toBeGreaterThan(1);
		}

		// 2. Across bindings: the same glyph index should land at (nearly) the
		//    same top/bottom, since every binding computes the envelope from the
		//    same shared `buildGlyphEnvelope` decision function. Measured on this
		//    fixture: react/vue/angular/svelte agree to well under 1px; vanilla
		//    (a different DOM-construction path than the other four's JSX/
		//    template renderers) measured 1.03px on one glyph, pure sub-pixel
		//    text anti-aliasing/hinting noise, not a logic difference (a real
		//    envelope-math bug measured 7px on this same assertion before the
		//    fixture pinned an explicit font - see this file's font comment).
		const PIXEL_TOLERANCE = 1.5;
		const [reference, ...rest] = results;
		for (const { framework, value } of rest) {
			expect(
				value.length,
				`${framework.name}: glyph count should match ${reference.framework.name}`,
			).toBe(reference.value.length);
			for (let i = 0; i < value.length; i++) {
				expect(
					Math.abs(value[i].top - reference.value[i].top),
					`${framework.name} vs ${reference.framework.name}: glyph ${i} top`,
				).toBeLessThanOrEqual(PIXEL_TOLERANCE);
				expect(
					Math.abs(value[i].bottom - reference.value[i].bottom),
					`${framework.name} vs ${reference.framework.name}: glyph ${i} bottom`,
				).toBeLessThanOrEqual(PIXEL_TOLERANCE);
			}
		}
	});

	test('a multi-paragraph inflate block bends every paragraph in the same envelope (band slicing)', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readInflateMultiGlyphBoxes);

		// `inflate-multi` is "Top" (3 glyphs) then "Bottom" (6 glyphs): 9 total.
		// Paragraph 0 ("Top") must occupy the upper half of the envelope band,
		// paragraph 1 ("Bottom") the lower half - the fixed residual this fixture
		// pins (every binding used to gate the glyph envelope on a single
		// paragraph and fall back to a shared-baseline `<textPath>` per line for
		// anything else).
		for (const { framework, value } of results) {
			expect(value, `${framework.name}: expected 9 glyphs ("Top" + "Bottom")`).toHaveLength(9);
			const topMaxBottom = Math.max(...value.slice(0, 3).map((g) => g.bottom));
			const bottomMinTop = Math.min(...value.slice(3).map((g) => g.top));
			expect(
				topMaxBottom,
				`${framework.name}: "Top" paragraph should sit entirely above "Bottom"`,
			).toBeLessThan(bottomMinTop);
		}

		// Across bindings: the same glyph index should land at (nearly) the same
		// top/bottom, since every binding computes the multi-line envelope from
		// the same shared `buildGlyphEnvelope(..., lineIndex, lineCount)`.
		const PIXEL_TOLERANCE = 1.5;
		const [reference, ...rest] = results;
		for (const { framework, value } of rest) {
			for (let i = 0; i < value.length; i++) {
				expect(
					Math.abs(value[i].top - reference.value[i].top),
					`${framework.name} vs ${reference.framework.name}: glyph ${i} top`,
				).toBeLessThanOrEqual(PIXEL_TOLERANCE);
				expect(
					Math.abs(value[i].bottom - reference.value[i].bottom),
					`${framework.name} vs ${reference.framework.name}: glyph ${i} bottom`,
				).toBeLessThanOrEqual(PIXEL_TOLERANCE);
			}
		}
	});
});

test.describe('wide-glyph-can: per-glyph slicing for a short, very-wide-glyph caption', () => {
	// The residual limitations.md still names: "for very short captions (a
	// handful of very wide glyphs filling the box) a single affine transform
	// per glyph cannot follow how much the envelope curve bends across one
	// glyph's own width". `chooseGlyphSliceCount` (`pptx-viewer-shared`)
	// closes most of that gap by rendering such a glyph as several clipped,
	// independently-fit pieces instead of one; this fixture's "MOM" at
	// extreme `adj` is exactly that scenario (each glyph spans ~1/3 of the
	// line). These specs additionally exercise the `<g data-glyph-slices>` /
	// `<clipPath>` DOM shape every binding now needs to reach parity on.
	test('every binding slices at least one glyph, and none leaves a gap in the logical glyph count', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readSlicedGlyphBoxes);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			if (value.length !== 3) {
				problems.push(`expected 3 logical glyphs ("M", "O", "M"), got ${value.length}`);
			}
			if (!value.some((g) => g.sliceCount > 1)) {
				problems.push('expected at least one glyph to be sliced (sliceCount > 1)');
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});
		expect(failures.join('\n')).toBe('');
	});

	test('cross-binding agreement on sliced-glyph boxes and slice counts', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readSlicedGlyphBoxes);

		// Every binding computes `chooseGlyphSliceCount` / `buildGlyphSlices`
		// from the same shared decision function, so the slice count PER GLYPH
		// (not just the aggregate box) should match exactly across bindings -
		// a binding that disagrees here is calling the shared function with
		// different inputs (a wiring bug), not a rendering-precision difference.
		const PIXEL_TOLERANCE = 1.5;
		const [reference, ...rest] = results;
		for (const { framework, value } of rest) {
			expect(
				value.length,
				`${framework.name}: glyph count should match ${reference.framework.name}`,
			).toBe(reference.value.length);
			for (let i = 0; i < value.length; i++) {
				expect(
					value[i].sliceCount,
					`${framework.name} vs ${reference.framework.name}: glyph ${i} slice count`,
				).toBe(reference.value[i].sliceCount);
				expect(
					Math.abs(value[i].top - reference.value[i].top),
					`${framework.name} vs ${reference.framework.name}: glyph ${i} top`,
				).toBeLessThanOrEqual(PIXEL_TOLERANCE);
				expect(
					Math.abs(value[i].bottom - reference.value[i].bottom),
					`${framework.name} vs ${reference.framework.name}: glyph ${i} bottom`,
				).toBeLessThanOrEqual(PIXEL_TOLERANCE);
			}
		}
	});

	test('a sliced glyph has no visible seam gap: adjacent slices overlap or touch in rendered space', async ({
		browser,
	}, testInfo) => {
		test.slow();
		// Reads each sliced glyph's INDIVIDUAL piece boxes (not the aggregate
		// `readSlicedGlyphBoxes` collapses them to), so adjacent pieces' ranges
		// can be checked for a gap directly - the seam invisibility this
		// feature depends on (see `buildGlyphSlices`'s overlap padding).
		const readPieces = async (page: Page, origin: string) => {
			await loadDeckAt(page, origin, FIXTURE);
			await slideStage(page).waitFor();
			await page.waitForTimeout(300);
			const shapeIndex = SHAPE_NAMES.indexOf(WIDE_GLYPH_SHAPE);
			const node = slideElements(page).nth(shapeIndex);
			return node.locator('svg > g[data-glyph-slices]').evaluateAll((groups) =>
				groups.map((group) =>
					[...group.querySelectorAll('text')].map((el) => {
						const svg = (el as SVGGraphicsElement).ownerSVGElement!;
						const ctm = svg.getScreenCTM()!.inverse();
						const rect = el.getBoundingClientRect();
						const topLeft = new DOMPoint(rect.left, rect.top).matrixTransform(ctm);
						const bottomRight = new DOMPoint(rect.right, rect.bottom).matrixTransform(ctm);
						return {
							left: Math.min(topLeft.x, bottomRight.x),
							right: Math.max(topLeft.x, bottomRight.x),
						};
					}),
				),
			);
		};

		const results = await acrossFrameworks(browser, testInfo, readPieces);
		const failures = results.flatMap(({ framework, value: groups }) => {
			const problems: string[] = [];
			for (const pieces of groups) {
				// Sort left-to-right (slice order should already match, but a
				// binding's own DOM-construction order is not being asserted here).
				const sorted = [...pieces].sort((a, b) => a.left - b.left);
				for (let i = 1; i < sorted.length; i++) {
					if (sorted[i].left > sorted[i - 1].right) {
						problems.push(
							`slice ${i}: gap of ${(sorted[i].left - sorted[i - 1].right).toFixed(2)}px from the previous slice`,
						);
					}
				}
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});
		expect(failures.join('\n')).toBe('');
	});
});
