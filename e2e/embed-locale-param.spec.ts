/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * The docs landing page embeds each demo with `?sample=1&locale=<code>`
 * (`docs/.vitepress/theme/landing/useLiveDemo.ts`) so the embedded viewer
 * follows the docs site's active nav locale. This spec drives that exact
 * startup path directly (no File > Options round trip, which
 * `locale-switching.spec.ts` already covers) and checks all five demos parse
 * the param the same way, via the shared `resolveLocaleParam` helper in
 * `pptx-viewer-locales`.
 *
 * Framework-neutral: only the shared ribbon-tab contract is used, and the
 * spec runs unmodified across the react/vue/angular/vanilla/svelte Playwright
 * projects via their `baseURL`s (see playwright.config.ts). No per-binding
 * branching.
 *
 * Run: bunx playwright test embed-locale-param
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { translationsFr } from '../packages/locales/src';
import { translationsEn } from '../packages/shared/src/i18n/translations-en';

const HOME_TAB_KEY = 'pptx.ribbon.tab.home';

/** Resolve a dictionary value, failing loudly on a missing key. */
function entry(dictionary: Record<string, string>, key: string): string {
	const value = dictionary[key];
	if (!value) {
		throw new Error(`dictionary is missing "${key}"`);
	}
	return value;
}

async function waitForSampleDeck(page: Page): Promise<void> {
	await page.locator('[aria-roledescription="slide"]').first().waitFor({ timeout: 90_000 });
	await page.locator('[data-pptx-element="true"]').first().waitFor({ timeout: 90_000 });
}

/**
 * The ribbon tab by its localized name.
 *
 * Not scoped through the toolbar's own accessible name ("Presentation
 * toolbar"): that label is itself translated once the locale switches, so a
 * lookup scoped to the English name would stop resolving. Matches
 * `expectChromeLanguage` in `locale-switching.spec.ts`.
 */
function homeTab(page: Page, label: string): Locator {
	return page.getByRole('tab', { name: label, exact: true }).first();
}

test.describe('embedded viewer locale param', () => {
	test('?locale=fr renders the ribbon in French on first load', async ({ page }) => {
		const consoleErrors: string[] = [];
		page.on('console', (message) => {
			if (message.type() === 'error') {
				consoleErrors.push(message.text());
			}
		});

		await page.goto('./?sample=1&locale=fr');
		await waitForSampleDeck(page);

		await expect(homeTab(page, entry(translationsFr, HOME_TAB_KEY))).toBeVisible();

		expect(consoleErrors, `unexpected console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
	});

	test('an unrecognised ?locale= falls back to English with no console errors', async ({
		page,
	}) => {
		const consoleErrors: string[] = [];
		page.on('console', (message) => {
			if (message.type() === 'error') {
				consoleErrors.push(message.text());
			}
		});

		await page.goto('./?sample=1&locale=not-a-real-locale');
		await waitForSampleDeck(page);

		await expect(homeTab(page, entry(translationsEn, HOME_TAB_KEY))).toBeVisible();

		expect(consoleErrors, `unexpected console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
	});
});
