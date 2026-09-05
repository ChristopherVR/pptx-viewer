/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * `p:set` font-style emphasis animation (Bold Reveal / Change Font Color),
 * run identically against every framework demo.
 *
 * The fixture (`text-style-emphasis.pptx`, `e2e/fixtures/generate-text-style-
 * emphasis-fixture.ts`) authors TWO separate main-sequence clicks (mirroring
 * `generate-smartart-build-fixture.ts`'s proven per-node click nesting): the
 * first fires a discrete `p:set` assigning `style.fontWeight` on one shape,
 * the second fires a `p:set` assigning `style.color` on another. The shared `resolveTextStyleAnimation`
 * (`animation-text-style-resolve.ts`) decodes each into a framework-neutral
 * `{ bold, color }` descriptor, and `buildTextStyleOverrideCss`
 * (`animation-text-style-css.ts`) turns it into a scoped CSS rule:
 *
 *   `[data-element-id="<id>"] [style] { font-weight: bold !important; ... }`
 *
 * That selector targets a descendant carrying its OWN inline `style`
 * attribute (a run span), not the element wrapper itself, so this spec
 * asserts on the RUN's computed style, never on markup or on the wrapper.
 *
 * Present-mode selectors are scoped to `[data-pptx-presenting]`: the editor
 * canvas and the slide rail stay mounted behind the running show and render
 * the same element ids at their own scale.
 *
 * Run: bunx playwright test text-style-emphasis
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import {
	BOLD_TARGET_TEXT,
	COLOR_TARGET_TEXT,
	TEXT_STYLE_EMPHASIS_TITLE,
} from './fixtures/generate-text-style-emphasis-fixture';
import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/text-style-emphasis.pptx', import.meta.url)),
);

/** The running show's own stage; see the module doc. */
const SHOW_STAGE = '[data-pptx-presenting]';

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

async function openInPresentMode(page: Page): Promise<void> {
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page
		.locator('[data-element-id]')
		.filter({ hasText: TEXT_STYLE_EMPHASIS_TITLE })
		.first()
		.waitFor();
	await enterPresentation(page);
	await page.locator(SHOW_STAGE).first().waitFor();
	await page.waitForTimeout(700);
}

/** Advance one click, waiting for any running step animation to finish first. */
async function advance(page: Page): Promise<void> {
	await expect
		.poll(() =>
			page
				.locator(SHOW_STAGE)
				.first()
				.evaluate(
					(stage) =>
						stage.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length,
				),
		)
		.toBe(0);
	await page.keyboard.press('PageDown');
	await page.waitForTimeout(400);
}

/**
 * The on-stage element wrapper carrying `data-element-id` for the given text.
 *
 * Scoped by `[data-element-id]`, not `[data-pptx-element="true"]`: the show
 * stage is exactly where `animation-text-style-css.ts`'s CSS override targets
 * `[data-element-id="<id>"]`, and (per `smartart-build-reveal.spec.ts`'s own
 * `SHOW_STAGE` contract) present-mode markup is walked by that attribute.
 */
function stageElement(page: Page, text: string): Locator {
	return page
		.locator(SHOW_STAGE)
		.first()
		.locator('[data-element-id]')
		.filter({ hasText: text })
		.first();
}

/**
 * A descendant carrying its own inline `style` attribute (a run span): the
 * exact node `buildTextStyleOverrideCss`'s `[data-element-id] [style]`
 * selector targets, per the module doc.
 */
function runSpan(element: Locator): Locator {
	return element.locator('[style]').first();
}

test.describe('text-style emphasis (p:set on style.fontWeight / style.color)', () => {
	test('a bold p:set fires on the first click, a colour p:set on the second', async ({ page }) => {
		await openInPresentMode(page);

		const boldTarget = stageElement(page, BOLD_TARGET_TEXT);
		const colorTarget = stageElement(page, COLOR_TARGET_TEXT);
		await expect(boldTarget).toBeVisible();
		await expect(colorTarget).toBeVisible();

		// Before the first click: neither override has applied yet.
		const boldRun = runSpan(boldTarget);
		const colorRun = runSpan(colorTarget);
		await expect(boldRun).not.toHaveCSS('font-weight', '700');
		const colorBefore = await colorRun.evaluate((el) => getComputedStyle(el).color);
		expect(colorBefore).not.toBe('rgb(255, 0, 0)');

		// Click 1 (advance once): only the bold p:set fires.
		await advance(page);
		await expect(boldRun).toHaveCSS('font-weight', '700');
		const colorAfterFirstClick = await colorRun.evaluate((el) => getComputedStyle(el).color);
		expect(colorAfterFirstClick).not.toBe('rgb(255, 0, 0)');
		// Scoped to its own element: the bold target does not also turn red.
		const boldTargetColor = await boldRun.evaluate((el) => getComputedStyle(el).color);
		expect(boldTargetColor).not.toBe('rgb(255, 0, 0)');

		// Click 2: the colour p:set fires too; the bold override (fill="hold") persists.
		await advance(page);
		await expect(colorRun).toHaveCSS('color', 'rgb(255, 0, 0)');
		await expect(boldRun).toHaveCSS('font-weight', '700');
		await expect(colorRun).not.toHaveCSS('font-weight', '700');
	});
});
