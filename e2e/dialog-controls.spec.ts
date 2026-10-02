/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/**
 * Secondary dialogs use the shared select, checkbox and radio primitives in every
 * binding: no dialog or backstage page may show an OS-drawn `<select>` popup, a
 * bare `<input type="checkbox">` or a bare `<input type="radio">` (#342). Set UI_SHOTS_DIR to also write the
 * before/after evidence screenshots.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { loadDeck, ribbon, selectElement, slideElements } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const SHOTS = process.env.UI_SHOTS_DIR;

interface Surface {
	name: string;
	open(page: Page): Promise<void>;
	close(page: Page): Promise<void>;
}

async function backstage(page: Page, item: string): Promise<void> {
	await ribbon(page).getByRole('tab', { name: 'File', exact: true }).click();
	const shell = page.locator('[role="dialog"][aria-label="File"]');
	await shell.waitFor();
	await shell.locator('[data-pptx-backstage-nav-item]', { hasText: item }).first().click();
}

async function tab(page: Page, name: string): Promise<void> {
	await ribbon(page).getByRole('tab', { name, exact: true }).click();
}

const escape = async (page: Page): Promise<void> => {
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');
	await page.waitForTimeout(150);
};

const SURFACES: Surface[] = [
	{
		name: 'print',
		open: async (page) => {
			await backstage(page, 'Print');
			await page
				.getByRole('button', { name: /Print Presentation/ })
				.first()
				.click();
		},
		close: escape,
	},
	{
		name: 'document-properties',
		open: async (page) => {
			await backstage(page, 'Info');
			await page
				.getByRole('button', { name: /Inspect|Properties/ })
				.first()
				.click();
		},
		close: escape,
	},
	{
		name: 'hyperlink',
		open: async (page) => {
			await selectElement(page, slideElements(page).first());
			await tab(page, 'Insert');
			await ribbon(page).getByRole('button', { name: 'Hyperlink', exact: true }).first().click();
		},
		close: escape,
	},
	{
		name: 'set-up-slide-show',
		open: async (page) => {
			await tab(page, 'Slide Show');
			await ribbon(page)
				.getByRole('button', { name: /Set Up Slide Show/ })
				.first()
				.click();
		},
		close: escape,
	},
	{
		name: 'custom-shows',
		open: async (page) => {
			await tab(page, 'Slide Show');
			await ribbon(page)
				.getByRole('button', { name: /Custom show/i })
				.first()
				.click();
		},
		close: escape,
	},
];

/** Count OS-owned controls anywhere in the page; the shared primitives are custom elements. */
function nativeControls(
	page: Page,
): Promise<{ selects: number; checkboxes: number; radios: number }> {
	return page.evaluate(() => {
		const find = (selector: string): number => document.querySelectorAll(selector).length;
		return {
			selects: find('select'),
			checkboxes: find('input[type="checkbox"]'),
			radios: find('input[type="radio"]'),
		};
	});
}

for (const surface of SURFACES) {
	test(`${surface.name} shows no native select, checkbox or radio`, async ({ page }, info) => {
		await loadDeck(page);
		await surface.open(page);
		await page.waitForTimeout(400);
		if (SHOTS) {
			await page.screenshot({ path: `${SHOTS}/${info.project.name}-${surface.name}.png` });
		}
		expect(await nativeControls(page)).toEqual({ selects: 0, checkboxes: 0, radios: 0 });
		await surface.close(page);
	});
}

test('Set Up Show radios are shared radio groups with roving arrow keys', async ({ page }) => {
	await loadDeck(page);
	await SURFACES.find((surface) => surface.name === 'set-up-slide-show')!.open(page);
	const radios = page.getByRole('radio');
	await expect(radios.first()).toBeVisible();
	// Show type (presented, browsed, kiosk), show slides, advance: three groups.
	await expect(page.locator('pptx-ui-radio')).toHaveCount(7);
	const checkedBefore = await page.locator('pptx-ui-radio[aria-checked="true"]').count();
	expect(checkedBefore).toBe(3);
	// One tab stop per group; the checked radio holds it.
	await expect(page.locator('pptx-ui-radio[tabindex="0"]')).toHaveCount(3);
	const first = radios.nth(0);
	const second = radios.nth(1);
	const third = radios.nth(2);
	await first.focus();
	await first.press('Space');
	await expect(first).toHaveAttribute('aria-checked', 'true');
	await page.keyboard.press('ArrowDown');
	await expect(second).toBeFocused();
	await expect(second).toHaveAttribute('aria-checked', 'true');
	await expect(first).toHaveAttribute('aria-checked', 'false');
	await page.keyboard.press('End');
	await expect(third).toBeFocused();
	await expect(third).toHaveAttribute('aria-checked', 'true');
	await page.keyboard.press('ArrowRight');
	await expect(first).toBeFocused();
	await page.keyboard.press('ArrowLeft');
	await expect(third).toBeFocused();
	await page.keyboard.press('Home');
	await expect(first).toBeFocused();
	// Radios in other groups do not move with this one.
	await expect(page.locator('pptx-ui-radio[aria-checked="true"]')).toHaveCount(3);
	await escape(page);
});
