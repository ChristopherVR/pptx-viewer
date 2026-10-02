/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
/**
 * The non-ribbon chrome controls that moved to shared elements (#386), driven the
 * same way in all five bindings: the read-only banner, the Paste Options strip,
 * the compatibility toast stack and the dialog footer.
 *
 * Only contracts every binding emits are used: the shared tag names, the
 * `data-testid` hooks that predate the migration, accessible names and the
 * `data-pptx-*` markers. Playwright locators pierce the open shadow roots.
 *
 * Run: bunx playwright test chrome-controls-migration
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { elementWithText, fixture, loadDeck, selectElement, slideStage } from './support/deck';
import { pressShortcut } from './support/keyboard';

test.use({ viewport: { width: 1440, height: 900 } });

const MODIFY_DECK = fixture('modify-password.pptx');
const OLE_DECK = fixture('ole-embed.pptx');

async function copyShape(page: Page): Promise<void> {
	await selectElement(page, elementWithText(page, 'Product Overview'));
	await pressShortcut(page, 'Control+c');
}

test.describe('read-only banner', () => {
	test('is the shared element and keeps its hooks, names and password focus', async ({
		page,
	}, info) => {
		await loadDeck(page, MODIFY_DECK);
		await expect(page.locator('pptx-ui-read-only-banner')).toHaveCount(1);
		const banner = page.getByTestId('pptx-readonly-banner');
		await expect(banner).toBeVisible();
		await expect(banner).toHaveAttribute('data-kind', 'modifyVerifier');
		await page.screenshot({ path: info.outputPath('read-only-banner.png') });
		const dismiss = page.getByRole('button', { name: 'Dismiss', exact: true });
		await expect(dismiss).toBeVisible();

		await page.getByRole('button', { name: 'Edit anyway', exact: true }).click();
		const input = page.getByTestId('pptx-readonly-password-input');
		await expect(input).toBeFocused();
		await expect(page.getByRole('button', { name: 'Edit anyway', exact: true })).toBeHidden();

		await input.fill('definitely-wrong');
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('pptx-readonly-password-error')).toBeVisible();
		await expect(input).toHaveAttribute('aria-invalid', 'true');
		await expect(
			page
				.getByRole('alert')
				.filter({ hasText: /password/iu })
				.first(),
		).toBeVisible();
	});

	test('the correct password unlocks and removes the banner', async ({ page }) => {
		await loadDeck(page, MODIFY_DECK);
		await page.getByTestId('pptx-readonly-edit-anyway').click();
		await page.getByTestId('pptx-readonly-password-input').fill('letmeedit123');
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('pptx-readonly-banner')).toBeHidden();
	});
});

test.describe('compatibility toasts', () => {
	test('render, dismiss one, and dismiss all through the shared stack', async ({ page }, info) => {
		await loadDeck(page, OLE_DECK);
		const stack = page.locator('pptx-ui-compat-toasts');
		await expect(stack).toHaveCount(1);
		await expect(stack).toHaveAttribute('data-testid', 'pptx-compat-toasts');
		const toasts = stack.getByTestId('pptx-compat-toast');
		await expect(toasts.first()).toBeVisible();
		await expect(toasts.first()).toHaveAttribute('data-code', /.+/u);
		await page.screenshot({ path: info.outputPath('compat-toasts.png') });
		await expect(stack.getByRole('button', { name: 'Dismiss', exact: true }).first()).toBeVisible();
		const before = await toasts.count();
		await stack.getByTestId('pptx-compat-toast-dismiss').first().click();
		await expect(toasts).toHaveCount(before - 1);
		if (before - 1 > 0) {
			await stack.getByTestId('pptx-compat-toasts-dismiss-all').click();
		}
		await expect(page.getByTestId('pptx-compat-toasts')).toBeHidden();
	});

	test('use inherited theme tokens and keep working in forced colors', async ({ page }) => {
		await loadDeck(page, OLE_DECK);
		const stack = page.locator('pptx-ui-compat-toasts');
		await stack.evaluate((host) => host.style.setProperty('--pptx-popover', 'rgb(18, 52, 86)'));
		await expect(stack.getByTestId('pptx-compat-toast').first()).toHaveCSS(
			'background-color',
			'rgb(18, 52, 86)',
		);
		await page.emulateMedia({ forcedColors: 'active' });
		await expect(stack.getByTestId('pptx-compat-toast').first()).toBeVisible();
	});
});

test.describe('paste options strip', () => {
	test('shows after a paste, applies a format, and goes away', async ({ page }, info) => {
		await loadDeck(page);
		await slideStage(page).waitFor();
		await page.waitForTimeout(400);
		await copyShape(page);
		const before = await page.locator('[data-pptx-viewport] [data-element-id]').count();
		await pressShortcut(page, 'Control+v');

		const strip = page.locator('pptx-ui-paste-options');
		await expect(strip).toHaveCount(1);
		await expect(strip).toHaveAttribute('data-pptx-paste-options', '');
		await expect(strip.getByRole('toolbar')).toBeVisible();
		for (const name of [
			'Keep Source Formatting',
			'Use Destination Theme',
			'Picture',
			'Keep Text Only',
		]) {
			await expect(strip.getByRole('button', { name, exact: true })).toBeVisible();
		}
		await page.screenshot({ path: info.outputPath('paste-options.png') });

		await strip.getByRole('button', { name: 'Keep Text Only', exact: true }).click();
		await expect(strip).toHaveCount(0);
		await expect
			.poll(() => page.locator('[data-pptx-viewport] [data-element-id]').count())
			.toBe(before + 1);
	});

	test('is dismissed by the next keystroke', async ({ page }) => {
		await loadDeck(page);
		await slideStage(page).waitFor();
		await page.waitForTimeout(400);
		await copyShape(page);
		await pressShortcut(page, 'Control+v');
		await expect(page.locator('pptx-ui-paste-options')).toHaveCount(1);
		await page.keyboard.press('ArrowRight');
		await expect(page.locator('pptx-ui-paste-options')).toHaveCount(0);
	});
});

test.describe('dialog footer', () => {
	async function openPasteSpecial(page: Page) {
		await loadDeck(page);
		await slideStage(page).waitFor();
		await page.waitForTimeout(400);
		await copyShape(page);
		await pressShortcut(page, 'Control+Alt+v');
		const dialog = page
			.getByRole('dialog')
			.filter({ hasText: /paste special/iu })
			.first();
		await expect(dialog).toBeVisible();
		return dialog;
	}

	test('renders Cancel and OK from the shared footer and cancels with the keyboard', async ({
		page,
	}, info) => {
		const dialog = await openPasteSpecial(page);
		await expect(dialog.locator('pptx-ui-dialog-footer')).toHaveCount(1);
		const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
		const ok = dialog.getByRole('button', { name: 'OK', exact: true });
		await expect(cancel).toBeVisible();
		await expect(ok).toBeVisible();
		await page.screenshot({ path: info.outputPath('dialog-footer.png') });
		await cancel.focus();
		await expect(cancel).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(dialog).toBeHidden();
	});

	test('OK applies the chosen format from the footer', async ({ page }) => {
		const dialog = await openPasteSpecial(page);
		const before = await page.locator('[data-pptx-viewport] [data-element-id]').count();
		await dialog.getByRole('radio', { name: /keep text only/iu }).check();
		const ok = dialog.getByRole('button', { name: 'OK', exact: true });
		await ok.focus();
		await page.keyboard.press('Enter');
		await expect(dialog).toBeHidden();
		await expect
			.poll(() => page.locator('[data-pptx-viewport] [data-element-id]').count())
			.toBe(before + 1);
	});

	test('use inherited theme tokens and keep working in forced colors', async ({ page }) => {
		const dialog = await openPasteSpecial(page);
		const footer = dialog.locator('pptx-ui-dialog-footer');
		await footer.evaluate((host) => host.style.setProperty('--pptx-primary', 'rgb(18, 52, 86)'));
		const ok = dialog.getByRole('button', { name: 'OK', exact: true });
		await expect(ok).toHaveCSS('background-color', 'rgb(18, 52, 86)');
		await page.emulateMedia({ forcedColors: 'active' });
		await expect(ok).toBeVisible();
	});
});

test.describe('touch targets', () => {
	test.use({ hasTouch: true });

	test('the read-only banner and its password form are at least 44px', async ({ page }) => {
		await loadDeck(page, MODIFY_DECK);
		const edit = page.getByTestId('pptx-readonly-edit-anyway');
		expect((await edit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		await edit.tap();
		for (const id of ['pptx-readonly-password-input', 'pptx-readonly-unlock']) {
			expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(44);
		}
	});

	test('the compatibility toast dismiss buttons are at least 44px', async ({ page }) => {
		await loadDeck(page, OLE_DECK);
		const dismiss = page.locator('pptx-ui-compat-toasts').getByTestId('pptx-compat-toast-dismiss');
		const box = (await dismiss.first().boundingBox())!;
		expect(box.height).toBeGreaterThanOrEqual(44);
		expect(box.width).toBeGreaterThanOrEqual(44);
	});
});

test.describe('mobile bars', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test('the shared bottom bar and top toolbar keep names, order and 44px targets', async ({
		page,
	}, info) => {
		await loadDeck(page);
		await page.waitForTimeout(500);
		const bar = page.locator('pptx-ui-mobile-bar');
		const toolbar = page.locator('pptx-ui-mobile-toolbar');
		await expect(bar).toHaveCount(1);
		await expect(toolbar).toHaveCount(1);
		await page.screenshot({ path: info.outputPath('mobile-bars.png') });

		const nav = page.getByRole('navigation', { name: 'Editor actions' });
		await expect(nav).toBeVisible();
		for (const name of ['Slides', 'Insert', 'Format', 'Comments', 'Toggle notes']) {
			const button = nav.getByRole('button', { name, exact: true });
			await expect(button).toBeVisible();
			const box = (await button.boundingBox())!;
			expect(box.height).toBeGreaterThanOrEqual(44);
			expect(box.width).toBeGreaterThanOrEqual(44);
		}
		const row = page.getByRole('toolbar', { name: 'Toolbar' });
		await expect(row).toBeVisible();
		for (const name of ['Menu', 'Save', 'Present']) {
			const button = row.getByRole('button', { name, exact: true });
			await expect(button).toBeVisible();
			const box = (await button.boundingBox())!;
			expect(box.height).toBeGreaterThanOrEqual(44);
		}
	});

	test('tapping Notes toggles the drawer and the pressed state', async ({ page }) => {
		await loadDeck(page);
		await page.waitForTimeout(500);
		const notes = page
			.getByRole('navigation', { name: 'Editor actions' })
			.getByRole('button', { name: 'Toggle notes', exact: true });
		const before = await notes.getAttribute('aria-pressed');
		await notes.tap();
		await expect(notes).not.toHaveAttribute('aria-pressed', before ?? 'false');
	});

	test('use inherited theme tokens and forced colors', async ({ page }) => {
		await loadDeck(page);
		await page.waitForTimeout(500);
		const bar = page.locator('pptx-ui-mobile-bar');
		await bar.evaluate((host) => host.style.setProperty('--pptx-primary', 'rgb(18, 52, 86)'));
		const slides = bar.getByRole('button', { name: 'Slides', exact: true });
		await slides.tap();
		await expect(slides).toHaveCSS('color', 'rgb(18, 52, 86)');
		await page.emulateMedia({ forcedColors: 'active' });
		await expect(slides).toBeVisible();
	});
});
