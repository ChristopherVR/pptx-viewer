/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { loadDeckAt, resetTabSession } from './support/deck';
import { acrossFrameworks } from './support/parity';

/**
 * Chart SERIES DATA fidelity, checked in every binding at once.
 *
 * `chart-data-fidelity.pptx` was authored by the real PowerPoint through COM so
 * the markup is ground truth, not our own serializer's output. Each slide pins
 * one thing the engine used to guess rather than read:
 *
 *   1. bubble   - three series, each with its own `c:xVal` / `c:yVal` /
 *                 `c:bubbleSize`. The engine took sizes from "the third series"
 *                 and dropped every series past the second, so a 3-series deck
 *                 drew 2 series of equal-ish dots instead of 3 sized ones.
 *   2. scatter  - `scatterStyle="lineMarker"` with `c:symbol val="none"` on both
 *                 series, which is how PowerPoint writes "lines, no markers".
 *                 With no scatterStyle parse and no polyline branch, the whole
 *                 chart rendered as literally nothing.
 *   3. column   - a BLANK middle category. `c:strCache` is sparse (`ptCount=5`,
 *                 no `idx=2`) while `c:numCache` is dense, so collapsing the
 *                 categories left them shorter than the values: the last bar
 *                 was not plotted and the remaining labels shifted one place.
 *   4. pie      - `showPercent` + `showCatName` + `separator` on the SERIES
 *                 `c:dLbls`. Labels printed the raw value.
 *
 * All four fixes live in `pptx-viewer-shared`, which every binding projects, so
 * this spec exists to prove that claim rather than to test five code paths.
 */
const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/chart-data-fidelity.pptx', import.meta.url)),
);

/** Counts of the chart's data-bearing SVG primitives, plus its label texts. */
interface ChartShape {
	circles: number;
	polylines: number;
	paths: number;
	rects: number;
	texts: string[];
}

/**
 * Select slide `slideNumber` (1-based) from the thumbnail rail.
 *
 * Only the MAIN canvas carries `aria-roledescription="slide"`, so the rail has
 * to be addressed by its own markers, and the five bindings use two different
 * conventions for those: a `data-slide-index` attribute or a "Go to slide N"
 * button label. Both are accepted rather than branching on the framework, which
 * the neutrality checker forbids and which would hide a real divergence anyway.
 */
async function gotoSlide(page: Page, slideNumber: number): Promise<void> {
	const byIndex = page.locator(`[data-slide-index="${slideNumber - 1}"]`).first();
	const byLabel = page.getByRole('button', { name: `Go to slide ${slideNumber}` }).first();
	const target = (await byIndex.count()) > 0 ? byIndex : byLabel;
	await target.click();
	await page.waitForTimeout(900);
}

/**
 * Measure the chart on slide `slideNumber` (1-based).
 *
 * Slides are reached through the thumbnail rail rather than presentation mode
 * so the spec stays in the editor, where every binding renders the chart into
 * the same neutral `[data-element-id]` wrapper.
 */
async function chartOnSlide(page: Page, slideNumber: number): Promise<ChartShape> {
	if (slideNumber > 1) {
		await gotoSlide(page, slideNumber);
	}
	const svg = page.locator('[data-pptx-viewport] [data-element-id] svg').first();
	await svg.waitFor();
	return svg.evaluate((node) => ({
		circles: node.querySelectorAll('circle').length,
		polylines: node.querySelectorAll('polyline').length,
		paths: node.querySelectorAll('path').length,
		rects: node.querySelectorAll('rect').length,
		texts: [...node.querySelectorAll('text')].map((t) => t.textContent ?? ''),
	}));
}

test.describe('chart series-data fidelity', () => {
	test('every binding reads c:bubbleSize, c:scatterStyle, blank categories and c:showPercent', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await resetTabSession(page);
			await loadDeckAt(page, origin, fixturePath);
			return {
				bubble: await chartOnSlide(page, 1),
				scatter: await chartOnSlide(page, 2),
				column: await chartOnSlide(page, 3),
				pie: await chartOnSlide(page, 4),
			};
		});

		for (const { framework, value } of results) {
			const where = `[${framework.name}]`;

			// 3 series x 3 points. The old heuristic could only ever produce 6.
			expect(value.bubble.circles, `${where} bubble points`).toBeGreaterThanOrEqual(9);

			// One connecting polyline per series. Markers are suppressed by
			// c:symbol val="none", so without the line the series is invisible.
			expect(value.scatter.polylines, `${where} scatter lines`).toBeGreaterThanOrEqual(2);

			// Five values, five bars, blank label included.
			expect(value.column.rects, `${where} column bars`).toBeGreaterThanOrEqual(5);
			expect(value.column.texts.join('|'), `${where} column labels`).toContain('West');

			// A percentage label, not the raw 40 / 25 / 20 / 15.
			const pieLabels = value.pie.texts.join('|');
			expect(pieLabels, `${where} pie labels`).toMatch(/\d+%/u);
			expect(pieLabels, `${where} pie category name`).toContain('Direct');
		}
	});

	test('every binding lets a data point be dragged on the canvas', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await resetTabSession(page);
			await loadDeckAt(page, origin, fixturePath);
			// Slide 3's column chart: a single series of plain bars, the simplest
			// mark with an unambiguous single-value meaning.
			await chartOnSlide(page, 3);
			// Scoped to the main canvas: the thumbnail rail renders the same chart
			// through the same projector, so an unscoped locator grabs a ~4px bar
			// off a thumbnail and measures nothing.
			const marks = page.locator(
				'[data-pptx-viewport] [data-element-id] svg [data-chart-part="dataPoint"]',
			);
			const bar = marks.first();
			const before = await bar.evaluate((node) => node.getBoundingClientRect().height);
			const box = await bar.boundingBox();
			if (!box) {
				throw new Error('the first bar has no box');
			}
			const at = { x: box.x + box.width / 2, y: box.y + 4 };
			// Two presses at the same point on purpose. Three bindings arm the marks
			// only once the chart is SELECTED, and until then the marks are
			// pointer-transparent, so the first click lands on the chart root and
			// selects it; the second press lands on the bar itself.
			await page.mouse.click(at.x, at.y);
			await page.waitForTimeout(300);
			await page.mouse.move(at.x, at.y);
			await page.mouse.down();
			// Downward: a column bar grows from the axis, so pulling its top down
			// must SHRINK it.
			await page.mouse.move(at.x, at.y + 40, { steps: 8 });
			await page.mouse.up();
			await page.waitForTimeout(400);
			const after = await marks.first().evaluate((node) => node.getBoundingClientRect().height);
			return { before, after };
		});

		for (const { framework, value } of results) {
			// The bar's rendered height is the honest signal: it proves the value
			// actually changed AND that the change survived the commit, which an
			// assertion on the drag preview alone would not.
			expect(value.before, `[${framework.name}] bar had no height to drag`).toBeGreaterThan(10);
			expect(value.after, `[${framework.name}] drag did not change the value`).toBeLessThan(
				value.before,
			);
		}
	});
});

/**
 * Mark interaction on the six kinds React and Vue used to hand-roll.
 *
 * `chart-gallery.pptx` is the corpus here rather than `chart-data-fidelity.pptx`
 * because those six kinds live in the gallery, and until this change the gallery
 * did not carry them at all: `chart-svg-parity.spec.ts` compares bindings
 * against each other, so a kind missing from the corpus could not be compared,
 * which is exactly how two bindings painting a different chart from the other
 * three went unnoticed.
 *
 * What is asserted is the user-visible consequence, not the markup: every
 * binding must tag the data marks (`data-chart-part`) and must highlight the
 * one that was clicked (the shared `pptx-chart-part-selected` class). React and
 * Vue emitted no `data-chart-part` at all for these kinds, so selection and
 * drag-to-value silently did nothing in two of the five viewers.
 */
const MARKED_KINDS = [
	{ key: 'combo', slide: 15 },
	{ key: 'stock', slide: 16 },
	{ key: 'surface', slide: 17 },
	{ key: 'waterfall', slide: 18 },
	{ key: 'treemap', slide: 19 },
	{ key: 'region-map', slide: 20 },
] as const;

const galleryPath = resolve(
	fileURLToPath(new URL('./fixtures/chart-gallery.pptx', import.meta.url)),
);

test.describe('chart mark interaction on the advanced kinds', () => {
	test('every binding tags and highlights marks on combo, stock, surface, waterfall, treemap and region map', async ({
		browser,
	}, testInfo) => {
		test.slow();

		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await resetTabSession(page);
			await loadDeckAt(page, origin, galleryPath);

			const perKind: Record<string, { marks: number; selected: number }> = {};
			for (const { key, slide } of MARKED_KINDS) {
				await gotoSlide(page, slide);
				const marks = page.locator(
					'[data-pptx-viewport] [data-element-id] svg [data-chart-part="dataPoint"]',
				);
				const count = await marks.count();
				let selected = 0;
				if (count > 0) {
					const box = await marks.first().boundingBox();
					if (box) {
						const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
						// Two presses: three bindings arm the marks only once the chart
						// itself is selected, so the first click lands on the chart root.
						await page.mouse.click(at.x, at.y);
						await page.waitForTimeout(250);
						await page.mouse.click(at.x, at.y);
						await page.waitForTimeout(350);
						selected = await page.locator('[data-pptx-viewport] .pptx-chart-part-selected').count();
					}
				}
				perKind[key] = { marks: count, selected };
			}
			return perKind;
		});

		for (const { framework, value } of results) {
			for (const { key } of MARKED_KINDS) {
				const where = `[${framework.name}] ${key}`;
				expect(value[key].marks, `${where}: no selectable data marks`).toBeGreaterThan(0);
				expect(value[key].selected, `${where}: clicking a mark selected nothing`).toBeGreaterThan(
					0,
				);
			}
		}
	});
});
