/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * `c:bar3DChart` with `c:barDir val="bar"` - PowerPoint's horizontal 3-D Bar,
 * as opposed to the (much more common) vertical 3-D Column.
 *
 * None of the five demos opt into the interactive three.js `bar3D` scene
 * (`BarChart3DContext`), so every binding falls back to the flat SVG chart:
 * `resolveChartKind` (`packages/shared/src/render/chart-view-model-kinds.ts`)
 * folds `bar3D` onto the ordinary `'bar'` kind, and `c:barDir val="bar"` is
 * exactly what `chart-horizontal-bars.ts` (shared) turns into WIDER-THAN-TALL
 * bar rects rather than the default taller-than-wide columns. This is the
 * neutral, framework-agnostic contract every binding paints from the same
 * shared geometry: the chart renders at all (not a blank frame), and every
 * bar rect is wider than it is tall.
 *
 * Run: bunx playwright test horizontal-bar3d-chart
 */
import { expect, test } from '@playwright/test';

import { fixture, loadDeckAt, slideStage } from './support/deck';
import { acrossFrameworks } from './support/parity';
import { fingerprintCharts } from './support/svg-fingerprint';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('bar3d-horizontal.pptx');

/** The two series' `srgbClr` fills, as the browser reports them via `getComputedStyle`. */
const SERIES_FILLS = ['rgb(68, 114, 196)', 'rgb(237, 125, 49)'];

test.describe('horizontal bar3D chart', () => {
	test('renders a real chart whose bars are wider than tall in every binding', async ({
		browser,
	}, testInfo) => {
		test.slow();

		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, FIXTURE);
			await slideStage(page).waitFor();
			await page
				.locator('[aria-roledescription="slide"] [aria-roledescription="chart"] svg')
				.first()
				.waitFor({ timeout: 20_000 });
			const charts = await fingerprintCharts(page);
			return charts;
		});

		const failures = results.flatMap(({ framework, value: charts }) => {
			const problems: string[] = [];
			if (charts.length === 0) {
				return [`${framework.name}: no chart rendered at all`];
			}
			const chart = charts[0];
			// The legend paints its own small colour-key swatch in each series'
			// colour too (a fixed ~10x10 square), so filtering on fill alone also
			// matches those; a real bar mark is far larger than a legend key.
			const LEGEND_SWATCH_MAX_SIDE = 16;
			const bars = chart.shapes.filter(
				(shape) =>
					shape.tag === 'rect' &&
					SERIES_FILLS.includes(shape.fill) &&
					shape.geometry[2] > LEGEND_SWATCH_MAX_SIDE &&
					shape.geometry[3] > LEGEND_SWATCH_MAX_SIDE,
			);
			if (bars.length === 0) {
				problems.push(
					`renders a blank/unrecognised chart: no rect carries either series colour ` +
						`(saw fills: ${[...new Set(chart.shapes.map((s) => s.fill))].join(', ') || 'none'})`,
				);
			}
			for (const bar of bars) {
				const [, , width, height] = bar.geometry;
				if (!(width > height)) {
					problems.push(
						`a bar rect is ${width}x${height} (not wider than tall) - expected a HORIZONTAL bar`,
					);
				}
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});
});
