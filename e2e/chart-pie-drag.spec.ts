/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * On-canvas pie-slice value drag, run identically against every framework
 * demo.
 *
 * A pie/doughnut slice has no single vertical value axis, so it cannot use
 * `ChartValueDrag`/`advanceChartValueDrag` (the cartesian-only path in
 * `packages/shared/src/render/chart-canvas-drag.ts`); it instead goes through
 * `buildChartMarkDragGeometry` / `resolveChartDragValue`
 * (`chart-interaction.ts`'s "non-cartesian mark drag" section), which every
 * binding's chart pointer handler calls for a `pie`/`doughnut` mark.
 *
 * Reuses `chart-gallery.pptx`'s existing "Pie" slide (slide 4 of
 * `CHART_SLIDES` in `generate-chart-fixture.ts`: series "Revenue", categories
 * Q1..Q4, values 45/62/58/71) rather than a new fixture.
 *
 * The dragged value is read back from the mark's own hover-tooltip `<title>`
 * (`buildMarkTooltip`'s `"<series>, <category>: <value>"`), a framework-
 * neutral readout that does not depend on the inspector's data-panel markup.
 * The value can land in a different `formatAxisValue` magnitude band (e.g.
 * "62" -> "6.0K"), so the reader undoes the K/M/B abbreviation.
 *
 * A chart's marks stay pointer-transparent until the chart itself is the
 * CURRENT SELECTION (`ElementBody.tsx`'s `editable={isSel && canEditChart}`
 * gate), so this spec selects the chart as a gesture SEPARATE from the drag,
 * confirming the marks became pointer-interactive before attempting one.
 *
 * Run: bunx playwright test chart-pie-drag
 */
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { fixture, loadDeck, selectElement, thumbnail } from './support/deck';

const CHART_FIXTURE = fixture('chart-gallery.pptx');
/** `CHART_SLIDES[3]` in `generate-chart-fixture.ts`: "Pie", 1-based slide 4. */
const PIE_SLIDE_NUMBER = 4;
/** The dragged slice: Q2, value 62. */
const DRAGGED_POINT_INDEX = 1;

/** The chart's own graphic frame, via the shared accessibility contract. */
function chartHost(page: Page): Locator {
	return page
		.locator('[aria-roledescription="slide"]')
		.first()
		.locator('[aria-roledescription="chart"]')
		.first();
}

function pieSliceMark(page: Page): Locator {
	return chartHost(page).locator(
		`svg [data-chart-part="dataPoint"][data-chart-point="${DRAGGED_POINT_INDEX}"]`,
	);
}

/** `formatAxisValue`'s abbreviation suffixes, largest first (own multiplier). */
const UNIT_MULTIPLIERS: ReadonlyArray<readonly [suffix: string, factor: number]> = [
	['B', 1_000_000_000],
	['M', 1_000_000],
	['K', 1_000],
];

/**
 * Parse the trailing number out of the mark's hover-tooltip `<title>` text
 * (`buildMarkTooltip`'s `"<label>: <value>"`), undoing `formatAxisValue`'s
 * K/M/B abbreviation so a drag that lands the value in a different magnitude
 * band still reads back correctly.
 */
async function markValue(mark: Locator): Promise<number> {
	const titleText = (await mark.locator('title').first().textContent()) ?? '';
	const match = /(-?[\d,.]+)\s*([KMB]?)\s*$/u.exec(titleText);
	if (!match) {
		throw new Error(`mark tooltip has no trailing numeric value: "${titleText}"`);
	}
	const magnitude = Number.parseFloat(match[1].replaceAll(',', ''));
	const unit = UNIT_MULTIPLIERS.find(([suffix]) => suffix === match[2]);
	return unit ? magnitude * unit[1] : magnitude;
}

/**
 * Select the chart first, as a SEPARATE gesture from the drag: marks stay
 * pointer-transparent (`pointer-events: none`) until the chart's own
 * `canEditChart` flag is set, which every binding gates on the graphic frame
 * being the CURRENT selection (`ElementBody.tsx`'s `editable={isSel && ...}`).
 * A single down-move-up sequence that starts on an unselected chart would
 * hit the SVG's pointer-transparent background on `mousedown`, not the mark.
 */
async function selectChart(page: Page): Promise<void> {
	await selectElement(page, chartHost(page));
	await expect
		.poll(() => pieSliceMark(page).evaluate((el) => getComputedStyle(el).pointerEvents), {
			message: 'selecting the chart must make its data-point marks pointer-interactive',
		})
		.not.toBe('none');
}

async function openPieSlide(page: Page): Promise<void> {
	await loadDeck(page, CHART_FIXTURE);
	await thumbnail(page, PIE_SLIDE_NUMBER).click();
	await pieSliceMark(page).waitFor();
	await page.waitForTimeout(400);
	await selectChart(page);
}

test.describe('pie chart slice value drag', () => {
	test('dragging a slice mark changes its underlying value', async ({ page }) => {
		await openPieSlide(page);

		const mark = pieSliceMark(page);
		const before = await markValue(mark);

		const box = await mark.boundingBox();
		expect(box, 'the dragged slice must have a layout box').not.toBeNull();
		const cx = box!.x + box!.width / 2;
		const cy = box!.y + box!.height / 2;

		await page.mouse.move(cx, cy);
		await page.mouse.down();
		// Several intermediate steps, well past the shared 3px click threshold,
		// in both axes: pie-slice geometry resolves the drag via angle, not a
		// single vertical value axis, so a diagonal move is the neutral gesture.
		for (const [dx, dy] of [
			[10, -10],
			[20, -25],
			[35, -45],
			[50, -60],
		]) {
			await page.mouse.move(cx + dx, cy + dy);
		}
		await page.mouse.up();
		await page.waitForTimeout(400);

		await expect
			.poll(
				async () => {
					const current = await markValue(pieSliceMark(page));
					return Math.abs(current - before);
				},
				{ message: 'dragging the slice mark must change its underlying value' },
			)
			.toBeGreaterThan(0.5);
	});
});
