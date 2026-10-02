/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/**
 * Secondary dialogs use the shared select and checkbox primitives in every
 * binding: no dialog or backstage page may show an OS-drawn `<select>` popup or
 * a bare `<input type="checkbox">` (#342). Set UI_SHOTS_DIR to also write the
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
function nativeControls(page: Page): Promise<{ selects: number; checkboxes: number }> {
	return page.evaluate(() => {
		const find = (selector: string): number => document.querySelectorAll(selector).length;
		return { selects: find('select'), checkboxes: find('input[type="checkbox"]') };
	});
}

for (const surface of SURFACES) {
	test(`${surface.name} shows no native select or checkbox`, async ({ page }, info) => {
		await loadDeck(page);
		await surface.open(page);
		await page.waitForTimeout(400);
		if (SHOTS) {
			await page.screenshot({ path: `${SHOTS}/${info.project.name}-${surface.name}.png` });
		}
		expect(await nativeControls(page)).toEqual({ selects: 0, checkboxes: 0 });
		await surface.close(page);
	});
}
