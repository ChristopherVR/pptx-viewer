/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Data-label boxes, callouts and leader lines beyond bar charts, in every
 * binding. The fixture is authored by PowerPoint itself (COM,
 * `chart-label-callouts.pptx`): a line, a doughnut and a radar chart whose
 * series-1 labels are pale yellow `wedgeRectCallout` boxes outlined in dark
 * red, with point 2's label dragged away and leader lines on. The decorations
 * come from `packages/shared/src/render/chart-data-label-callout.ts`, so this
 * pins every binding to painting them.
 *
 * Run: bunx playwright test chart-label-callouts
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, loadDeckAt, slideStage, thumbnail } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('chart-label-callouts.pptx');

interface Decorations {
	/** Label boxes: polygons filled with the authored `#FFFFCC`. */
	boxes: number;
	/** Of those, the ones carrying a callout pointer (7 points, not 4). */
	pointers: number;
	/** Grey leader polylines. */
	leaders: number;
}

async function countDecorations(page: Page): Promise<Decorations> {
	return page.evaluate(() => {
		const root = document.querySelector('[data-pptx-viewport]') ?? document;
		const fillOf = (el: Element) =>
			(el.getAttribute('fill') ?? getComputedStyle(el).fill).toLowerCase();
		const polygons = [...root.querySelectorAll('svg polygon')].filter((el) =>
			['#ffffcc', 'rgb(255, 255, 204)'].includes(fillOf(el)),
		);
		const pointCount = (el: Element) =>
			(el.getAttribute('points') ?? '').trim().split(/\s+/u).length;
		const leaders = [...root.querySelectorAll('svg polyline')].filter((el) => {
			const fill = fillOf(el);
			return (fill === 'none' || fill === '') && pointCount(el) === 3;
		});
		return {
			boxes: polygons.length,
			pointers: polygons.filter((el) => pointCount(el) === 7).length,
			leaders: leaders.length,
		};
	});
}

async function readDeck(page: Page, origin: string): Promise<Decorations[]> {
	await loadDeckAt(page, origin, FIXTURE);
	await slideStage(page).waitFor();
	const out: Decorations[] = [];
	for (const slide of [1, 2, 3]) {
		await thumbnail(page, slide).first().click();
		await page.waitForTimeout(800);
		out.push(await countDecorations(page));
	}
	return out;
}

test.describe('chart data-label callouts', () => {
	test('every binding boxes line, doughnut and radar labels like PowerPoint', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readDeck);
		const failures = results.flatMap(({ framework, value }) => {
			const [line, doughnut, radar] = value;
			const problems: string[] = [];
			// Line: four labels right of their markers, all pointing back at them.
			if (line.boxes !== 4 || line.pointers !== 4 || line.leaders !== 1) {
				problems.push(`line ${JSON.stringify(line)}`);
			}
			// Doughnut: labels centred on the ring keep a plain box; only the
			// dragged one points back (and has the leader line).
			if (doughnut.boxes !== 4 || doughnut.pointers !== 1 || doughnut.leaders !== 1) {
				problems.push(`doughnut ${JSON.stringify(doughnut)}`);
			}
			// Radar: five labels out along their spokes, each pointing back.
			if (radar.boxes !== 5 || radar.pointers !== 5 || radar.leaders !== 1) {
				problems.push(`radar ${JSON.stringify(radar)}`);
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});
		expect(failures.join('\n')).toBe('');
	});
});
