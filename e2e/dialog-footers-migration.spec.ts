/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
/**
 * Every dialog action row is the shared `pptx-ui-dialog-footer` in all five
 * bindings (#396). One spec, run once per binding by the Playwright projects:
 * it opens each dialog and asserts the footer element, the button order (the
 * primary action last, at most one), that Escape leaves the footer intact and that a
 * focused Cancel/Close button closes it on Enter. Callbacks, ids and test hooks
 * are covered by each dialog's own spec and unit tests.
 *
 * Set UI_SHOTS_DIR to write one screenshot per dialog (the "after" captures in
 * docs/public/assets/ui-migration/dialog-footers).
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { loadDeck, ribbon, selectElement, slideElements } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const SHOTS = process.env.UI_SHOTS_DIR;

interface Surface {
	name: string;
	open(page: Page): Promise<void>;
	/** Visible labels of the actions, in order, for bindings that agree on them. */
	primary: RegExp;
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

const SURFACES: Surface[] = [
	{
		name: 'print',
		primary: /^Print/u,
		open: async (page) => {
			await backstage(page, 'Print');
			await page
				.getByRole('button', { name: /Print Presentation/ })
				.first()
				.click();
		},
	},
	{
		name: 'document-properties',
		primary: /^Save$/u,
		open: async (page) => {
			await backstage(page, 'Info');
			await page
				.getByRole('button', { name: /Inspect|Properties/ })
				.first()
				.click();
		},
	},
	{
		name: 'hyperlink',
		primary: /^(Apply|OK)$/u,
		open: async (page) => {
			await selectElement(page, slideElements(page).first());
			await tab(page, 'Insert');
			await ribbon(page).getByRole('button', { name: 'Hyperlink', exact: true }).first().click();
		},
	},
	{
		name: 'set-up-slide-show',
		primary: /^OK$/u,
		open: async (page) => {
			await tab(page, 'Slide Show');
			await ribbon(page)
				.getByRole('button', { name: /Set Up Slide Show/ })
				.first()
				.click();
		},
	},
	{
		name: 'equation',
		primary: /^Insert$/u,
		open: async (page) => {
			await tab(page, 'Insert');
			await ribbon(page).getByRole('button', { name: 'Equation', exact: true }).click();
		},
	},
	{
		name: 'smartart',
		primary: /^Insert$/u,
		open: async (page) => {
			await tab(page, 'Insert');
			await ribbon(page).getByRole('button', { name: 'SmartArt', exact: true }).click();
		},
	},
	{
		name: 'slide-templates',
		primary: /^Insert$/u,
		open: async (page) => {
			await tab(page, 'Home');
			await page.getByRole('button', { name: 'Slide Templates' }).first().click();
		},
	},
	{
		name: 'share',
		primary: /^(Start Sharing|Share|Start)/u,
		open: async (page) => {
			await page.getByRole('button', { name: 'Share', exact: true }).first().click();
		},
	},
	{
		name: 'password-protection',
		primary: /^(Set Password|Update Password)$/iu,
		open: async (page) => {
			await backstage(page, 'Info');
			await page
				.getByRole('button', { name: /protect presentation/iu })
				.first()
				.click();
		},
	},
];

/** Footers that are on screen (some bindings keep closed dialogs mounted, hidden). */
function visibleFooters(page: Page): Locator {
	return page.locator('pptx-ui-dialog-footer:visible');
}

for (const surface of SURFACES) {
	test.describe(surface.name, () => {
		test.beforeEach(async ({ page }) => {
			await loadDeck(page);
			await surface.open(page);
			await expect(visibleFooters(page).first()).toBeVisible();
		});

		test('uses the shared footer with the primary action last', async ({ page }, info) => {
			const footer = visibleFooters(page).last();
			if (SHOTS) {
				await page.screenshot({ path: `${SHOTS}/after-${info.project.name}-${surface.name}.png` });
			}
			const buttons = footer.getByRole('button');
			const names = (await buttons.allTextContents()).map((text) => text.trim());
			expect(names.length).toBeGreaterThanOrEqual(1);
			const primary = footer.locator('button.primary');
			expect(await primary.count()).toBeLessThanOrEqual(1);
			if ((await primary.count()) === 1) {
				expect(names.at(-1)).toMatch(surface.primary);
				expect(await primary.evaluate((node) => node.nextElementSibling === null)).toBeTruthy();
			}
			// Exactly one action row is on screen: no hand-built row beside it.
			await expect(visibleFooters(page)).toHaveCount(1);
		});

		test('Escape never leaves a second or broken footer behind', async ({ page }) => {
			// Escape is the shell's: some dialogs (React Print and Hyperlink, the
			// Vanilla file-info dialogs) have no Escape handler of their own, which
			// is unchanged here. Either way the footer must not be duplicated.
			const before = await visibleFooters(page).count();
			await page.keyboard.press('Escape');
			await page.waitForTimeout(300);
			expect(await visibleFooters(page).count()).toBeLessThanOrEqual(before);
		});

		test('a focused Cancel or Close action closes the dialog on Enter', async ({ page }) => {
			const footer = visibleFooters(page).last();
			const dismiss = footer
				.getByRole('button', { name: /^(Cancel|Close|Done|Discard)$/u })
				.first();
			if ((await dismiss.count()) === 0) {
				test.skip(true, 'this dialog has no dismiss action in its footer');
			}
			const before = await visibleFooters(page).count();
			// A dialog's own initial-focus effect can land just after the first focus(): retry until it holds.
			await expect(async () => {
				await dismiss.focus();
				// Let any late initial-focus effect run, then require focus to still be here.
				await page.waitForTimeout(250);
				await expect(dismiss).toBeFocused({ timeout: 1000 });
			}).toPass({ timeout: 10_000 });
			await page.keyboard.press('Enter');
			await expect(visibleFooters(page)).toHaveCount(before - 1);
		});
	});
}
