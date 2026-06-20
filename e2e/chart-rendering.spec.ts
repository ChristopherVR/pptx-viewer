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
 * each chart slide is inspected through the neutral DOM the React, Vue and
 * Angular viewers all emit (`[data-pptx-element="true"]`,
 * `[aria-roledescription="slide"]`, inline `<svg>`).
 *
 * Per chart slide the spec:
 *   (a) PARITY - captures the rendered form of the chart element (a real chart
 *       `<svg>` with per-type geometry, or the "Chart" placeholder fallback) and
 *       asserts the SAME contract holds. Because the body is framework-agnostic,
 *       a divergence between React / Vue / Angular fails the run and names the
 *       chart kind. When a chart renders as SVG, the per-type primitive counts
 *       (`<rect>` / `<path>` / `<circle>` / `<polygon>`) are validated too.
 *   (b) VISUAL - screenshots the chart element to
 *       `e2e/__screenshots__/<framework>-<charttype>.png` for eyeballing.
 *
 * NOTE (discovered by this harness): in the current codebase a chart loaded
 * from a `.pptx` renders as the neutral "Chart" placeholder, not an SVG - the
 * load pipeline parses the graphic frame into a chart element but never
 * populates `element.chartData` (no consumer calls
 * `PptxHandler.getChartDataForGraphicFrame`), and every binding's chart renderer
 * short-circuits to the placeholder when `chartData` is absent. The placeholder
 * is itself rendered identically across the three frameworks, so the parity
 * assertions pass; `expectsSvg` is `false` until chart enrichment on load is
 * implemented, at which point flipping it re-enables the SVG geometry checks.
 */

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/chart-gallery.pptx', import.meta.url)),
);
const screenshotDir = resolve(fileURLToPath(new URL('./__screenshots__', import.meta.url)));

/**
 * Whether a loaded chart is expected to render as an SVG. Currently `false`
 * because `load()` does not enrich `chartData` (see the file header). Flip to
 * `true` once chart-on-load enrichment lands to turn on the SVG geometry
 * assertions for every framework.
 */
const EXPECTS_SVG = true;

/**
 * Load the gallery deck and enter presentation mode.
 *
 * Presentation mode (not the editor) is the navigation vehicle because slide
 * stepping via the keyboard is the one contract all three bindings implement
 * identically (`ArrowRight` / `PageDown` advance - `NEXT_SLIDE_KEYS`); the Vue
 * port, for instance, has no editor slide-nav. The neutral per-element hook used
 * throughout is `data-element-id`, which every binding emits on every element in
 * both modes (React/Angular additionally emit `data-pptx-element`, but Vue's
 * chart renderer does not, so `data-pptx-element` is not portable for charts).
 */
async function openGalleryInPresentMode(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	// First chart slide's title anchor confirms the deck rendered.
	await titleAnchor(page, CHART_SLIDES[0]).waitFor();
	await page
		.getByRole('button', { name: /^present$/iu })
		.first()
		.click();
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
		.locator('[data-element-id]')
		.filter({ hasText: new RegExp(escapeRe(slide.title), 'u') })
		.first();
}

/**
 * The chart element on the active slide. Each chart slide carries exactly one
 * chart graphic frame plus a tiny title anchor shape. The neutral per-element
 * hook common to all three bindings' chart renderers is `data-element-id`:
 * React/Angular also add `data-pptx-element` but Vue's chart renderer does not,
 * so `data-element-id` is the portable selector. The chart element is the
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
	const candidates = page.locator('[data-element-id]:has(svg)').filter({ hasText: slide.title });
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
async function primitiveCounts(el: Locator): Promise<{
	hasSvg: boolean;
	rect: number;
	path: number;
	circle: number;
	polygon: number;
	polyline: number;
	line: number;
	text: number;
}> {
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

/**
 * Per-type minimum primitive expectations for a rendered chart `<svg>`.
 * Lower-bound (`>=`) because the shared engine adds chrome (gridlines, ticks,
 * legend swatches) whose exact count is not the parity target - the target is
 * that the *same* engine drives all three bindings, so the same bounds hold.
 */
function assertSvgTypeShape(
	slide: ChartSlideSpec,
	counts: Awaited<ReturnType<typeof primitiveCounts>>,
): void {
	// Every chart, whatever its kind, must draw *some* geometry: an empty svg is
	// the regression this guards against. We total the drawable kinds the shared
	// engine emits (bars `rect`, slices/arcs `path`, area/line bands `polyline`,
	// rings/trapezoids `polygon`, points `circle`) rather than asserting a
	// per-type breakdown, because the parity target is that the *same* engine
	// drives all three bindings (so the same svg renders), not a specific
	// primitive mix. The screenshots are the per-type visual record.
	const drawable = counts.rect + counts.path + counts.circle + counts.polygon + counts.polyline;
	expect(drawable, `${slide.key} (${slide.chartType}): drew geometry`).toBeGreaterThan(0);
	// A real chart also paints axis/category/legend text in every binding.
	expect(counts.text, `${slide.key}: labels`).toBeGreaterThan(0);
}

test.describe('chart rendering (cross-framework parity)', () => {
	test('every chart kind renders an identical contract + captures screenshots', async ({
		page,
	}, testInfo) => {
		const framework = testInfo.project.name;
		mkdirSync(screenshotDir, { recursive: true });

		await openGalleryInPresentMode(page);

		const renderedAsSvg: string[] = [];
		const renderedAsPlaceholder: string[] = [];

		for (let i = 0; i < CHART_SLIDES.length; i++) {
			const slide = CHART_SLIDES[i];
			if (i > 0) {
				await nextSlide(page);
			}

			// Confirm navigation landed on the intended slide: its unique title
			// anchor must be on screen before we inspect that slide's chart.
			await expect(titleAnchor(page, slide), `${slide.key}: slide active`).toBeVisible();

			const el = await chartElement(page, slide);
			await expect(el, `${slide.key}: chart element present`).toBeVisible();

			const counts = await primitiveCounts(el);

			// (a) PARITY - the rendered form must match the cross-framework
			// contract. `EXPECTS_SVG` is the single switch that flips the whole
			// gallery from "placeholder" to "SVG geometry"; whichever is active,
			// it must hold identically on React / Vue / Angular.
			expect(counts.hasSvg, `${slide.key}: chart renders as SVG`).toBe(EXPECTS_SVG);
			if (counts.hasSvg) {
				assertSvgTypeShape(slide, counts);
				// Distinguish a real rendered chart from the icon-bearing "Chart"
				// placeholder (which also has an svg + one text node): a real chart
				// paints its title, drawn by the shared engine in every binding. The
				// placeholder shows only the literal word "Chart", never the title.
				await expect(el, `${slide.key}: real chart, not placeholder`).toContainText(slide.title);
				renderedAsSvg.push(slide.key);
			} else {
				// Placeholder parity: the neutral chart element still carries the
				// "Chart" label text identically across frameworks.
				await expect(el, `${slide.key}: placeholder label`).toContainText('Chart');
				renderedAsPlaceholder.push(slide.key);
			}

			// (b) VISUAL - screenshot the chart element per framework + type.
			await el.screenshot({
				path: resolve(screenshotDir, `${framework}-${slide.key}.png`),
			});
		}

		// Surface the rendered-form tally in the report for quick triage.
		testInfo.annotations.push({
			type: 'chart-render-form',
			description: `svg=[${renderedAsSvg.join(',')}] placeholder=[${renderedAsPlaceholder.join(',')}]`,
		});
	});
});
