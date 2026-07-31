/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Does the app chrome LOOK the same in all five bindings?
 *
 * The bug class pinned here is chrome drift. React, Vue and Angular build the
 * title bar from `TITLE_BAR_CLASSES` in `pptx-viewer-shared`; Vanilla and
 * Svelte hand-port the same look into their own stylesheets, and a hand-port
 * has nothing holding it to the original. Every functional test still passes
 * when a bar is 34px instead of 36px, a logo is `#d24726` instead of
 * `#c43e1c`, a switch knob rests 16px along its track instead of 15px, or a
 * status bar announces itself with the name of a button inside it. Users see
 * all four.
 *
 * So this spec measures instead of clicking: computed style, bounding boxes,
 * accessible names, and the one behaviour the status bar owes the canvas (its
 * zoom controls must actually resize the stage). Each test aggregates every
 * mismatch from every binding into a single assertion, because a per-binding
 * assertion stops at the first failure and a defect shared by four bindings
 * then reads as a defect in one.
 *
 * Run: bunx playwright test chrome-shell-parity
 */
import { expect, test } from '@playwright/test';

import type { ZoomProbe } from './support/chrome';
import { measureChrome, stageWidth, zoomInButton, zoomOutButton } from './support/chrome';
import {
	quickAccessProblems,
	statusBarProblems,
	titleBarProblems,
	zoomProblems,
} from './support/chrome-parity';
import { fixture, loadDeckAt, slideStage, zoomFitButton } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const SAMPLE = fixture('sample-deck.pptx');

/** Long enough for a zoom transition to land, short enough to stay cheap. */
const ZOOM_SETTLE_MS = 400;

test.describe('cross-binding application chrome', () => {
	test('the title bar is painted to the same measurements everywhere', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, SAMPLE);
			await slideStage(page).waitFor();
			return measureChrome(page);
		});

		expect(titleBarProblems(results).join('\n')).toBe('');
	});

	test('the status bar reports the same state and is named unambiguously', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, SAMPLE);
			await slideStage(page).waitFor();
			return measureChrome(page);
		});

		expect(statusBarProblems(results).join('\n')).toBe('');
	});

	test('the status-bar zoom controls resize the rendered stage', async ({ browser }, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, SAMPLE);
			await slideStage(page).waitFor();
			const fitted = await stageWidth(page);
			await zoomInButton(page).click();
			await page.waitForTimeout(ZOOM_SETTLE_MS);
			const zoomedIn = await stageWidth(page);
			await zoomOutButton(page).click();
			await page.waitForTimeout(ZOOM_SETTLE_MS);
			const zoomedOut = await stageWidth(page);
			await zoomFitButton(page).click();
			await page.waitForTimeout(ZOOM_SETTLE_MS);
			return { fitted, zoomedIn, zoomedOut, refitted: await stageWidth(page) } satisfies ZoomProbe;
		});

		expect(zoomProblems(results).join('\n')).toBe('');
	});

	test('the quick-access strip and command search reach every binding', async ({
		browser,
	}, testInfo) => {
		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, SAMPLE);
			await slideStage(page).waitFor();
			return measureChrome(page);
		});

		expect(quickAccessProblems(results).join('\n')).toBe('');
	});
});
