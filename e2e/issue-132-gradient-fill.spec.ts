/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Regression coverage for issue #132, run identically against every framework
 * demo.
 *
 * The reporter filed "gradient fill (a:gradFill) renders as solid color, losing
 * transparency" and quoted one element:
 *
 *   data-element-id="...-shape-4"  aria-label="Shape: parallelogram"
 *   left: 59px; top: 0px; width: 521px; height: 720px;
 *   background-color: rgb(210, 248, 244);
 *
 * That is `ppt/slides/slide2.xml-shape-4` in their deck
 * (`e2e/fixtures/issue-132-gradient-fill.pptx`, a media-slimmed copy of the
 * attachment). Reading the deck settled what was actually broken:
 *
 *  1. The quoted shape has no gradient at all - it is a solid
 *     `accent2 lumMod 20% lumOff 80%`, which resolves to exactly
 *     `rgb(210,248,244)`. Its defect is the OUTLINE: a `parallelogram` authored
 *     at `adj="84929"` is a thin diagonal band, and the clip-path cascade served
 *     the preset's DEFAULT `adj="25000"` polygon (80% of the box). The slab
 *     occluded the slide's text, which is what the report describes as the
 *     shape "visually overlapping / occluding content beneath it". Every preset
 *     with an authored `a:avLst` outside the 14 dynamically-modelled shapes was
 *     affected the same way.
 *  2. Real gradients elsewhere in the deck exposed two genuine fidelity gaps:
 *     the tile offset of PowerPoint's stock corner-radial preset
 *     (`a:tileRect l="-100000" t="-100000"`) was dropped, and React alone never
 *     applied `a:tileRect` / `@flip` at all.
 *
 * The freeform-gradient half of (2) - a `a:custGeom` shape painted as an SVG
 * `<path>` that cannot take a CSS gradient - is React-only and covered by
 * `packages/react/src/viewer/utils/vector-shape-renderer.gradient.test.tsx`.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/issue-132-gradient-fill.pptx', import.meta.url)),
);

/** 1-based slide numbers, named for what they demonstrate. */
const SLIDE = {
	/** The reporter's parallelogram, full-bleed over the slide's body text. */
	parallelogram: 2,
	/** Panels with linear `a:gradFill` fills. */
	linearGradients: 3,
	/** Circle-path radial gradient with an oversized `a:tileRect`. */
	cornerRadial: 4,
} as const;

const LOAD_TIMEOUT_MS = 60_000;

async function loadDeck(page: Page): Promise<void> {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[aria-label="Go to slide 29"]').first().waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
}

async function gotoSlide(page: Page, slideNumber: number): Promise<void> {
	await page.locator(`[aria-label="Go to slide ${slideNumber}"]`).first().click();
	await page.waitForTimeout(900);
}

/**
 * Computed geometry + paint for one element id, measured on the largest rendered
 * copy so a slide-rail thumbnail can never win.
 */
async function paintOf(
	page: Page,
	elementIdSuffix: string,
): Promise<{
	width: number;
	height: number;
	clipPath: string;
	backgroundColor: string;
	backgroundImage: string;
	backgroundSize: string;
	backgroundPosition: string;
} | null> {
	return page.evaluate((suffix) => {
		let best: HTMLElement | undefined;
		let bestArea = 0;
		for (const node of document.querySelectorAll<HTMLElement>('[data-element-id]')) {
			if (!(node.dataset.elementId ?? '').endsWith(suffix)) {
				continue;
			}
			const box = node.getBoundingClientRect();
			if (box.width * box.height > bestArea) {
				bestArea = box.width * box.height;
				best = node;
			}
		}
		if (!best) {
			return null;
		}
		const box = best.getBoundingClientRect();
		const style = getComputedStyle(best);
		return {
			width: box.width,
			height: box.height,
			clipPath: style.clipPath,
			backgroundColor: style.backgroundColor,
			backgroundImage: style.backgroundImage,
			backgroundSize: style.backgroundSize,
			backgroundPosition: style.backgroundPosition,
		};
	}, elementIdSuffix);
}

/** Shoelace area of the polygon described by a `path('M … Z')` clip-path. */
function pathAreaFraction(clipPath: string, width: number, height: number): number {
	const points = [...clipPath.matchAll(/(-?[\d.]+)[ ,]+(-?[\d.]+)/gu)].map(([, x, y]) => [
		Number(x),
		Number(y),
	]);
	let twiceArea = 0;
	for (let index = 0; index < points.length; index += 1) {
		const [x1, y1] = points[index];
		const [x2, y2] = points[(index + 1) % points.length];
		twiceArea += x1 * y2 - x2 * y1;
	}
	return Math.abs(twiceArea / 2) / (width * height);
}

test.describe('issue #132 - gradient fill / preset adjustment fidelity', () => {
	test('the parallelogram is clipped to its authored adj, not the preset default', async ({
		page,
	}) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.parallelogram);

		const paint = await paintOf(page, 'slide2.xml-shape-4');
		expect(paint, 'found the reporter’s parallelogram').not.toBeNull();

		// The fill was never wrong: accent2 lumMod 20% / lumOff 80%.
		expect(paint?.backgroundColor).toBe('rgb(210, 248, 244)');

		// The default `polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)` is what made
		// the band read as a slab. Every binding resolves the preset through the
		// shared clip-path cascade, so all five must emit an evaluated path.
		expect(paint?.clipPath, 'preset geometry is evaluated, not table-defaulted').toContain('path(');
	});

	test('the parallelogram covers a band, not most of its box', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.parallelogram);

		const paint = await paintOf(page, 'slide2.xml-shape-4');
		expect(paint).not.toBeNull();

		// `adj="84929"` leaves 1 - 0.84929 of the box painted. The default
		// adjustment painted 0.8 of it, burying the slide's body text.
		const fraction = pathAreaFraction(paint!.clipPath, paint!.width, paint!.height);
		expect(fraction, 'painted area matches the authored skew').toBeCloseTo(1 - 0.84929, 2);
	});

	test('a gradFill shape paints a CSS gradient, not its representative solid', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.linearGradients);

		// `<a:gradFill><a:gs pos="0"><a:srgbClr val="CDAE71"/>…` top-to-bottom.
		const paint = await paintOf(page, 'slide3.xml-shape-4');
		expect(paint, 'found the gradient panel').not.toBeNull();
		expect(paint?.backgroundImage).toContain('linear-gradient');
		expect(paint?.backgroundImage).toContain('205, 174, 113');
		expect(paint?.backgroundImage).toContain('148, 113, 74');
	});

	test('an oversized tileRect offsets the gradient tile off the shape', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.cornerRadial);

		// `<a:path path="circle"><a:fillToRect r="100000" b="100000"/>` with
		// `<a:tileRect l="-100000" t="-100000"/>`: a tile twice the shape, hung off
		// its top-left, so the focal corner sits outside the box.
		const paint = await paintOf(page, 'slide4.xml-shape-3');
		expect(paint, 'found the corner radial gradient').not.toBeNull();

		// A `circle` sized with a PERCENTAGE is invalid CSS (only a length is
		// legal), so the browser discarded the whole declaration and the shape
		// rendered with no fill at all. `getComputedStyle` reporting anything
		// other than `none` is the regression guard.
		expect(paint?.backgroundImage, 'the gradient is parseable CSS').toContain('radial-gradient');
		expect(paint?.backgroundImage).not.toMatch(/circle\s+[\d.]+%/u);

		// The tile is twice the shape and hangs off its top-left, so the tile's
		// far edges pin to the shape's: `200%` size at `100%` position. Dropping
		// the position (the bug) left the tile at `0 0` and dragged the focal blob
		// onto the shape's own corner.
		expect(paint?.backgroundSize).toBe('200% 200%');
		expect(paint?.backgroundPosition).toBe('100% 100%');
	});
});
