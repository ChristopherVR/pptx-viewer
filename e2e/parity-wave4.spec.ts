/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Wave-4 presentation-parity UI, driven the same way in all five demos.
 *
 * `parity-wave4.pptx` (see `fixtures/generate-parity-wave4-fixture.ts`) is a
 * three-slide deck that carries every input these surfaces react to:
 *
 *   - `p:modifyVerifier`: PowerPoint opens it "read-only recommended", so the
 *     viewer shows the read-only banner and locks editing until "Edit anyway".
 *   - an element the schema does not allow under `p:presentation`, which core
 *     reports as `UNMODELLED_PRESENTATION_MARKUP` and the viewer surfaces as a
 *     compatibility toast.
 *   - `p:showPr/p:sldRg st="2" end="3"`: the show is authored to play slides
 *     2..3 only, so presenting must open on slide 2 and end after slide 3.
 *
 * The chart subtype pickers are checked against `chart-gallery.pptx`, whose
 * radar and surface slides are the two chart kinds with a wave-4 select.
 *
 * Every locator is a `data-testid` from the wave-4 binding contract, so a
 * binding that renders the surface with a different hook is a parity bug in
 * that binding, not a reason to add a fallback here.
 *
 * Run: bunx playwright test parity-wave4
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { WAVE4_SLIDE_TEXT } from './fixtures/generate-parity-wave4-fixture';
import { fixture, inspector, loadDeck, selectElement, thumbnail } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const WAVE4_DECK = fixture('parity-wave4.pptx');
const CHART_DECK = fixture('chart-gallery.pptx');

/** 1-based slide numbers in `chart-gallery.pptx` (see `CHART_SLIDES` order). */
const RADAR_SLIDE = 6;
const SURFACE_SLIDE = 17;

/** Enter presentation mode through either the status bar or legacy Present button. */
async function enterPresentation(page: Page): Promise<void> {
	const slideShowButtons = page.getByRole('button', { name: /^slide show$/iu });
	if ((await slideShowButtons.count()) > 0) {
		await slideShowButtons.last().click();
		return;
	}
	await page
		.getByRole('button', { name: /present/iu })
		.first()
		.click();
}

/**
 * The chart element on the current slide: the one hosting chart marks. The
 * gallery slides also carry a 9px stray shape that sorts first in DOM order,
 * so "the first element" is not the chart.
 */
function chartElement(page: Page): Locator {
	return page
		.locator('[data-pptx-viewport] [data-element-id]')
		.filter({ has: page.locator('svg [data-chart-part]') })
		.first();
}

/** The fixture slide whose text is on screen right now, or 'none'. */
async function visibleSlideText(page: Page): Promise<string> {
	for (const text of WAVE4_SLIDE_TEXT) {
		const node = page.locator('[data-element-id]').filter({ hasText: text });
		const count = await node.count();
		for (let index = 0; index < count; index += 1) {
			if (await node.nth(index).isVisible()) {
				return text;
			}
		}
	}
	return 'none';
}

test.describe('read-only recommendation banner', () => {
	test('a modifyVerifier deck shows the banner and "Edit anyway" lifts it', async ({ page }) => {
		await loadDeck(page, WAVE4_DECK);

		const banner = page.getByTestId('pptx-readonly-banner');
		await expect(banner).toBeVisible();
		await expect(banner).toHaveAttribute('data-kind', 'modifyVerifier');

		await page.getByTestId('pptx-readonly-edit-anyway').click();
		// Unmounted or hidden are both fine: a binding may keep the node and
		// toggle `hidden` rather than tear it down.
		await expect(banner).toBeHidden();
	});

	test('"Dismiss" hides the banner', async ({ page }) => {
		await loadDeck(page, WAVE4_DECK);

		await expect(page.getByTestId('pptx-readonly-banner')).toBeVisible();
		await page.getByTestId('pptx-readonly-dismiss').click();
		await expect(page.getByTestId('pptx-readonly-banner')).toBeHidden();
	});
});

test.describe('compatibility-warning toasts', () => {
	test('an unmodelled presentation child raises a toast that "Dismiss all" clears', async ({
		page,
	}) => {
		await loadDeck(page, WAVE4_DECK);

		const stack = page.getByTestId('pptx-compat-toasts');
		await expect(stack).toBeVisible();
		const toast = stack.locator(
			'[data-testid="pptx-compat-toast"][data-code="UNMODELLED_PRESENTATION_MARKUP"]',
		);
		await expect(toast.first()).toBeVisible();
		await expect(toast.first()).toHaveAttribute('data-severity', /warning|error/u);

		await page.getByTestId('pptx-compat-toasts-dismiss-all').click();
		await expect(stack.getByTestId('pptx-compat-toast')).toHaveCount(0);
	});

	test('a single toast can be dismissed on its own', async ({ page }) => {
		await loadDeck(page, WAVE4_DECK);

		const toasts = page.getByTestId('pptx-compat-toasts').getByTestId('pptx-compat-toast');
		const before = await toasts.count();
		expect(before).toBeGreaterThan(0);

		await toasts.first().getByTestId('pptx-compat-toast-dismiss').click();
		await expect(toasts).toHaveCount(before - 1);
	});
});

test.describe('authored slide range (p:sldRg)', () => {
	test('presenting a deck authored to show slides 2..3 opens on slide 2 and ends after 3', async ({
		page,
	}) => {
		await loadDeck(page, WAVE4_DECK);
		// The banner is chrome, not part of the show; lift it so no binding's
		// read-only state can get in the way of entering presentation mode.
		await page.getByTestId('pptx-readonly-edit-anyway').click();

		await enterPresentation(page);
		await page.waitForTimeout(700);
		expect(await visibleSlideText(page)).toBe(WAVE4_SLIDE_TEXT[1]);

		await page.keyboard.press('PageDown');
		await page.waitForTimeout(700);
		expect(await visibleSlideText(page)).toBe(WAVE4_SLIDE_TEXT[2]);

		// Slide 1 is outside the range: stepping back from slide 2 must not reach it.
		await page.keyboard.press('PageUp');
		await page.waitForTimeout(500);
		await page.keyboard.press('PageUp');
		await page.waitForTimeout(500);
		expect(await visibleSlideText(page)).toBe(WAVE4_SLIDE_TEXT[1]);
	});
});

test.describe('chart subtype pickers', () => {
	test('a radar chart exposes the radar-style select', async ({ page }) => {
		await loadDeck(page, CHART_DECK);
		await thumbnail(page, RADAR_SLIDE).click();
		await page.waitForTimeout(300);
		await selectElement(page, chartElement(page));

		await expect(inspector(page).getByTestId('pptx-chart-radar-style')).toBeVisible();
		// Unmounted or hidden are both fine (see the banner spec above).
		await expect(inspector(page).getByTestId('pptx-chart-bar3d-shape')).toBeHidden();
		await expect(inspector(page).getByTestId('pptx-chart-surface-wireframe')).toBeHidden();
	});

	test('a surface chart exposes the wireframe select', async ({ page }) => {
		await loadDeck(page, CHART_DECK);
		await thumbnail(page, SURFACE_SLIDE).click();
		await page.waitForTimeout(300);
		await selectElement(page, chartElement(page));

		const select = inspector(page).getByTestId('pptx-chart-surface-wireframe');
		await expect(select).toBeVisible();
		await expect(inspector(page).getByTestId('pptx-chart-radar-style')).toBeHidden();
	});
});
