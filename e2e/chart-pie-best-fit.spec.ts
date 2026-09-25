/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Pie data labels at `c:dLblPos val="bestFit"`, and the size of the box
 * around a data label, in every binding, against what PowerPoint drew for the
 * same deck (COM `Slide.Export` pixels and `DataLabel.Width/Height`,
 * `chart-pie-best-fit.pptx`; see `packages/shared/src/render/
 * chart-pie-best-fit.ts` and `chart-label-measure.ts`):
 *
 *  - a label that fits in its slice sits inside it with its farthest box
 *    corner 4pt inside the rim; the 1% and 2% slices' labels go outside;
 *  - a boxed 12pt Calibri "25" is 18.16 x 17.65pt and a "5" 12.08pt wide:
 *    the text is measured, not estimated.
 *
 * The pie's own radius is not PowerPoint's yet (the automatic plot-area
 * layout is a separate gap), so placement is checked relative to the radius
 * each binding drew. Slide 2 boxes the labels so the boxes can be found.
 *
 * Run: bunx playwright test chart-pie-best-fit
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { BEST_FIT_PIES, PIE_FRAME_PT } from './fixtures/generate-chart-pie-best-fit-fixture';
import { fixture, loadDeckAt, slideStage, thumbnail } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('chart-pie-best-fit.pptx');

/**
 * PowerPoint's placement per slice: `I` inside, `O` outside, `?` a slice on
 * the fit boundary that the pie's radius decides (not checked).
 */
const POWERPOINT_FIT = ['IIII', 'IIII', 'IIII', 'IIII', 'OO?I', 'II', 'IIIIIIIIIII', 'IOOOI'];

interface LabelBox {
	/** Box centre, relative to the pie centre, in pt. */
	x: number;
	y: number;
	w: number;
	h: number;
}

interface PieReading {
	/** Pie radius in pt. */
	r: number;
	boxes: LabelBox[];
}

interface SlideReading {
	pies: PieReading[];
	/** Whether the page measures Calibri-metric text (else sizes are not checked). */
	calibri: boolean;
}

async function readPies(page: Page, framePt: number): Promise<SlideReading> {
	return page.evaluate((frameWidthPt) => {
		const root = document.querySelector('[data-pptx-viewport]') ?? document;
		const fillOf = (el: Element) =>
			(el.getAttribute('fill') ?? getComputedStyle(el).fill).toLowerCase();
		const svgs = [...root.querySelectorAll('svg')].filter((svg) =>
			[...svg.querySelectorAll('polygon')].some((el) =>
				['#fff2cc', 'rgb(255, 242, 204)'].includes(fillOf(el)),
			),
		);
		const pies = svgs.map((svg) => {
			const host = svg.closest('[data-element-id]') ?? svg;
			const ptPerPx = frameWidthPt / host.getBoundingClientRect().width;
			const slices = [...svg.querySelectorAll('path')].map((el) => el.getBoundingClientRect());
			const left = Math.min(...slices.map((b) => b.left));
			const right = Math.max(...slices.map((b) => b.right));
			const top = Math.min(...slices.map((b) => b.top));
			const bottom = Math.max(...slices.map((b) => b.bottom));
			const cx = (left + right) / 2;
			const cy = (top + bottom) / 2;
			const boxes = [...svg.querySelectorAll('polygon')]
				.filter((el) => ['#fff2cc', 'rgb(255, 242, 204)'].includes(fillOf(el)))
				.map((el) => {
					const b = el.getBoundingClientRect();
					return {
						x: (b.left + b.width / 2 - cx) * ptPerPx,
						y: (b.top + b.height / 2 - cy) * ptPerPx,
						w: b.width * ptPerPx,
						h: b.height * ptPerPx,
					};
				});
			return { r: ((right - left) / 2) * ptPerPx, boxes, at: host.getBoundingClientRect() };
		});
		pies.sort((a, b) => Math.round(a.at.top - b.at.top) || a.at.left - b.at.left);
		const ctx = document.createElement('canvas').getContext('2d');
		let calibri = false;
		if (ctx) {
			ctx.font = '16px "Calibri", sans-serif';
			calibri = Math.abs(ctx.measureText('25').width - 16.22) < 0.3;
		}
		return { pies: pies.map(({ r, boxes }) => ({ r, boxes })), calibri };
	}, framePt);
}

async function readDeck(page: Page, origin: string): Promise<SlideReading> {
	await loadDeckAt(page, origin, FIXTURE);
	await slideStage(page).waitFor();
	await thumbnail(page, 2).first().click();
	await page.waitForTimeout(800);
	return readPies(page, PIE_FRAME_PT.width);
}

/** Which slice (index) a box centre's angle falls in, clockwise from 12 o'clock. */
function sliceOf(values: readonly number[], box: LabelBox): number {
	const total = values.reduce((sum, v) => sum + v, 0);
	const angle = ((Math.atan2(box.x, -box.y) / (2 * Math.PI)) * total + total) % total;
	let mid = 0;
	let best = 0;
	let bestGap = Number.POSITIVE_INFINITY;
	for (const [i, v] of values.entries()) {
		const centre = mid + v / 2;
		const gap = Math.min(Math.abs(angle - centre), total - Math.abs(angle - centre));
		if (gap < bestGap) {
			bestGap = gap;
			best = i;
		}
		mid += v;
	}
	return best;
}

function farCorner(box: LabelBox): number {
	return Math.hypot(Math.abs(box.x) + box.w / 2, Math.abs(box.y) + box.h / 2);
}

function checkPie(values: readonly number[], fit: string, pie: PieReading, calibri: boolean) {
	const problems: string[] = [];
	if (pie.boxes.length !== values.length) {
		return [`${pie.boxes.length} label boxes for ${values.length} slices`];
	}
	for (const box of pie.boxes) {
		const slice = sliceOf(values, box);
		const expected = fit[slice];
		const far = farCorner(box);
		const inside = far < pie.r;
		const name = `slice ${slice + 1} (${values[slice]})`;
		if (expected !== '?' && inside !== (expected === 'I')) {
			problems.push(`${name} ${inside ? 'inside' : 'outside'}, PowerPoint ${expected}`);
		} else if (expected === 'I' && Math.abs(pie.r - far - 4) > 1.5) {
			problems.push(`${name} corner ${(pie.r - far).toFixed(1)}pt inside the rim, not 4pt`);
		}
		if (calibri) {
			const wide = values[slice] >= 10 ? 18.16 : 12.08;
			if (Math.abs(box.w - wide) > 1 || Math.abs(box.h - 17.65) > 1) {
				problems.push(`${name} box ${box.w.toFixed(1)}x${box.h.toFixed(1)}pt`);
			}
		}
	}
	return problems;
}

test.describe('pie bestFit data labels', () => {
	test('every binding places bestFit labels and sizes label boxes like PowerPoint', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readDeck);
		const failures = results.flatMap(({ framework, value }) => {
			if (value.pies.length !== BEST_FIT_PIES.length) {
				return [`${framework.name}: found ${value.pies.length} boxed pies`];
			}
			const problems = BEST_FIT_PIES.flatMap((values, i) =>
				checkPie(values, POWERPOINT_FIT[i], value.pies[i], value.calibri).map(
					(problem) => `pie ${i + 1} ${problem}`,
				),
			);
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});
		expect(failures.join('\n')).toBe('');
	});
});
