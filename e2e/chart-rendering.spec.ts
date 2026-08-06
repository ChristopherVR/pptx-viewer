/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { CHART_SLIDES } from './fixtures/generate-chart-fixture';
import type { ChartSlideSpec } from './fixtures/generate-chart-fixture';

/**
 * Chart-rendering parity, run identically against every framework demo.
 *
 * `chart-gallery.pptx` holds one chart per slide (the {@link CHART_SLIDES}
 * manifest is the contract, in order). The deck is loaded, presentation mode is
 * entered (the shared `NEXT_SLIDE_KEYS` contract - `PageDown` advances), and
 * each chart slide is inspected through the neutral DOM every viewer emits
 * (`[data-pptx-element="true"]`,
 * `[aria-roledescription="slide"]`, inline `<svg>`).
 *
 * One test per chart kind (so one broken kind cannot mask the rest). Per kind:
 *   (a) PARITY - the chart renders as a real `<svg>` (never the "Chart"
 *       placeholder) and its data-bearing primitives meet a per-type profile
 *       DERIVED from the fixture data ({@link expectedPrimitives}): bars are
 *       `<rect>`s (>= series x categories), pie/doughnut/funnel/sunburst
 *       slices are `<path>`s (>= categories), line/area series are
 *       `<polyline>`s, scatter/bubble/marker points are `<circle>`s, radar
 *       series are `<polygon>`s, box-whisker whiskers are `<line>`s. Chrome
 *       (gridlines, legend swatches, plot background) sits on top of those
 *       minima, which is why the bounds are `>=`. Axis/category/legend text
 *       must render too. Both React and Vue were measured emitting identical
 *       primitive counts (same shared engine), so the profile holds for every
 *       binding or the run names the divergent kind.
 *   (b) VISUAL - screenshots the chart element to
 *       `e2e/__screenshots__/<framework>-<charttype>.png` for eyeballing.
 *
 * The load pipeline now enriches loaded chart elements with `chartData`, so SVG
 * rendering and per-type geometry are required in every binding. A fallback to
 * the former neutral "Chart" placeholder is a product-suite regression.
 */

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/chart-gallery.pptx', import.meta.url)),
);
const screenshotDir = resolve(fileURLToPath(new URL('./__screenshots__', import.meta.url)));

/**
 * Load the gallery deck and enter presentation mode.
 *
 * Presentation mode (not the editor) is the navigation vehicle because slide
 * stepping via the keyboard is the shared contract all five bindings implement
 * identically (`ArrowRight` / `PageDown` advance - `NEXT_SLIDE_KEYS`). The
 * neutral per-element hook used throughout is `data-element-id`, which every
 * binding emits on every element in both modes.
 */
async function openGalleryInPresentMode(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	// First chart slide's title anchor confirms the deck rendered.
	await titleAnchor(page, CHART_SLIDES[0]).waitFor();
	const slideShowButtons = page.getByRole('button', { name: /^slide show$/iu });
	if ((await slideShowButtons.count()) > 0) {
		await slideShowButtons.last().click();
	} else {
		await page
			.getByRole('button', { name: /present/iu })
			.first()
			.click();
	}
	await page.waitForTimeout(700);
}

/** Advance to the next slide via the shared presentation keyboard contract. */
async function nextSlide(page: Page): Promise<void> {
	await page.keyboard.press('PageDown');
	await page.waitForTimeout(500);
}

/** The title anchor shape for a slide (the `data-element-id` bearing its title). */
function titleAnchor(page: Page, slide: ChartSlideSpec): Locator {
	return page
		.locator('[data-element-id]:visible')
		.filter({ hasText: new RegExp(escapeRe(slide.title), 'u') })
		.first();
}

/**
 * The chart element on the active slide. Each chart slide carries exactly one
 * chart graphic frame plus a tiny title anchor shape. The neutral per-element
 * hook common to every binding's chart renderer is `data-element-id`, so it is
 * the portable selector. The chart element is the
 * `data-element-id` element that is NOT the title anchor (it renders an inline
 * chart `<svg>` or the "Chart" placeholder, neither carrying the title text).
 */
async function chartElement(page: Page, slide: ChartSlideSpec): Promise<Locator> {
	// Select the chart `<svg>` element by the title it paints. An enriched chart
	// renders its title (`slide.title`, unique per slide) inside its svg via the
	// shared engine, so filtering svg-bearing slide elements by that text:
	//   - picks the ACTIVE slide's chart even though presentation mode keeps
	//     adjacent slides mounted (a neighbour's chart paints a different title);
	//   - excludes the icon-bearing "Chart" placeholder, which shows only the
	//     literal word "Chart", never the title. Before chart-on-load enrichment
	//     landed every chart was that placeholder, so this finds nothing, which
	//     is the regression signal.
	// Of the matches we pick the LARGEST by area: the chart canvas, not the 1x1
	// title-anchor shape (which also carries the title text).
	const candidates = page
		.locator('[data-element-id]:visible:has(svg)')
		.filter({ hasText: slide.title });
	await candidates.first().waitFor();
	const count = await candidates.count();
	let bestIndex = 0;
	let bestArea = -1;
	for (let i = 0; i < count; i++) {
		const box = await candidates.nth(i).boundingBox();
		const area = box ? box.width * box.height : 0;
		if (area > bestArea) {
			bestArea = area;
			bestIndex = i;
		}
	}
	return candidates.nth(bestIndex);
}

/** Escape a literal string for use inside a RegExp. */
function escapeRe(s: string): string {
	return s.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** Counts of each SVG primitive kind within a chart `<svg>` (0s if no svg). */
interface PrimitiveCounts {
	hasSvg: boolean;
	rect: number;
	path: number;
	circle: number;
	polygon: number;
	polyline: number;
	line: number;
	text: number;
}

async function primitiveCounts(el: Locator): Promise<PrimitiveCounts> {
	return el.evaluate((node) => {
		const svg = node.querySelector('svg');
		return {
			hasSvg: svg !== null,
			rect: node.querySelectorAll('rect').length,
			path: node.querySelectorAll('path').length,
			circle: node.querySelectorAll('circle').length,
			polygon: node.querySelectorAll('polygon').length,
			polyline: node.querySelectorAll('polyline').length,
			line: node.querySelectorAll('line').length,
			text: node.querySelectorAll('text').length,
		};
	});
}

/** One primitive lower bound with the data-derived reason it must hold. */
interface PrimitiveExpectation {
	kind: 'rect' | 'path' | 'circle' | 'polygon' | 'polyline' | 'line';
	min: number;
	why: string;
}

/**
 * The per-type minimum data primitives, derived from the fixture manifest
 * (`seriesCount` x `categoryCount`). Bounds are `>=` because engine chrome
 * (plot background rect, legend swatches, gridlines) adds primitives of the
 * same kinds on top of the data marks.
 */
function expectedPrimitives(slide: ChartSlideSpec): PrimitiveExpectation[] {
	const { seriesCount: series, categoryCount: categories } = slide;
	const points = series * categories;
	switch (slide.chartType) {
		case 'bar':
			return [{ kind: 'rect', min: points, why: `one bar per series x category (${points})` }];
		case 'line':
			return [
				{ kind: 'polyline', min: series, why: `one line per series (${series})` },
				{ kind: 'circle', min: points, why: `one marker per point (${points})` },
				{ kind: 'path', min: 1, why: 'the fixture line chart carries a trendline' },
			];
		case 'area':
			return [{ kind: 'polyline', min: series, why: `one area band per series (${series})` }];
		case 'pie':
		case 'doughnut':
			return [{ kind: 'path', min: categories, why: `one slice per category (${categories})` }];
		case 'radar':
			return [
				{ kind: 'polygon', min: series, why: `one radar ring per series (${series})` },
				{ kind: 'circle', min: points, why: `one vertex marker per point (${points})` },
			];
		case 'scatter':
		case 'bubble':
			return [{ kind: 'circle', min: points, why: `one point per series x category (${points})` }];
		case 'funnel':
			return [{ kind: 'path', min: categories, why: `one trapezoid per category (${categories})` }];
		case 'sunburst':
			return [{ kind: 'path', min: categories, why: `one arc per leaf category (${categories})` }];
		case 'histogram':
			return [{ kind: 'rect', min: categories, why: `one bin bar per category (${categories})` }];
		case 'boxWhisker':
			return [
				// Measured on the shared engine: 9 rects (boxes + plot chrome). The
				// box count does not decompose cleanly as series x categories, so the
				// bound only requires that several quartile boxes drew.
				{ kind: 'rect', min: 5, why: 'quartile boxes' },
				{ kind: 'line', min: points, why: `whisker segments (>= ${points})` },
			];
		default:
			return [{ kind: 'rect', min: 1, why: 'unknown chart type still draws geometry' }];
	}
}

test.describe('chart rendering (cross-framework parity)', () => {
	mkdirSync(screenshotDir, { recursive: true });

	for (let i = 0; i < CHART_SLIDES.length; i++) {
		const slide = CHART_SLIDES[i];

		test(`${slide.key} renders its per-type SVG profile + screenshot`, async ({
			page,
		}, testInfo) => {
			const framework = testInfo.project.name;
			await openGalleryInPresentMode(page);
			for (let step = 0; step < i; step++) {
				await nextSlide(page);
			}

			// Confirm navigation landed on the intended slide: its unique title
			// anchor must be on screen before we inspect that slide's chart.
			await expect(titleAnchor(page, slide), `${slide.key}: slide active`).toBeVisible();

			const el = await chartElement(page, slide);
			await expect(el, `${slide.key}: chart element present`).toBeVisible();

			const counts = await primitiveCounts(el);
			expect(counts.hasSvg, `${slide.key}: chart renders as SVG`).toBe(true);
			for (const expectation of expectedPrimitives(slide)) {
				expect(
					counts[expectation.kind],
					`${slide.key} (${slide.chartType}): <${expectation.kind}> x${expectation.min} - ${expectation.why}`,
				).toBeGreaterThanOrEqual(expectation.min);
			}
			// A real chart also paints its title plus axis/category/legend text.
			expect(counts.text, `${slide.key}: labels`).toBeGreaterThan(1);
			await expect(el, `${slide.key}: real chart, not placeholder`).toContainText(slide.title);

			// (b) VISUAL - screenshot the chart element per framework + type.
			await el.screenshot({
				path: resolve(screenshotDir, `${framework}-${slide.key}.png`),
			});
		});
	}
});
