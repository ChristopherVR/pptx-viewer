/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { loadDeck, slideStage, thumbnail } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

const NAMES = [
	'Bold',
	'Italic',
	'Underline',
	'Strikethrough',
	'Bullet list',
	'Numbered list',
	'Increase indent',
	'Decrease indent',
	'Insert link',
	'Print notes',
];

const notesPanel = (page: Page): Locator => page.locator('[data-pptx-chrome="notes"]').first();
const toolbar = (page: Page): Locator => page.getByRole('toolbar', { name: 'Notes formatting' });
const richEditor = (page: Page): Locator =>
	page.locator('#slide-notes-content [contenteditable="true"]').first();
const control = (page: Page, name: string): Locator =>
	toolbar(page).getByRole('button', { name, exact: true });

async function openNotes(page: Page): Promise<void> {
	await loadDeck(page);
	await slideStage(page).waitFor();
	// Keyboard activation: it works the same on touch layouts, where the stage can overlap the bar.
	await page
		.getByRole('button', { name: /^toggle notes$/iu })
		.first()
		.focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('#slide-notes-content')).toBeVisible();
	await expect(toolbar(page)).toBeVisible();
}

/** Type notes, then wait out the editors' debounce so the model holds them. */
async function typeNotes(page: Page, text: string): Promise<Locator> {
	const editor = richEditor(page);
	await editor.click();
	await editor.fill(text);
	await editor.press('Control+A');
	return editor;
}

/** Leave the slide and come back: the editor is re-seeded from the document model. */
async function roundTripSlide(page: Page): Promise<void> {
	// Leave the editor first so its commit lands before the slide changes.
	await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
	await page.waitForTimeout(700);
	await thumbnail(page, 2).click();
	await page.waitForTimeout(200);
	await thumbnail(page, 1).click();
	await page.waitForTimeout(200);
}

test('the shared notes toolbar has one canonical button set, order and toolbar semantics', async ({
	page,
}, info) => {
	await openNotes(page);
	await expect(page.locator('pptx-ui-notes-toolbar')).toHaveCount(1);
	await page.screenshot({ path: info.outputPath('notes-toolbar-page.png') });
	await notesPanel(page).screenshot({ path: info.outputPath('notes-toolbar.png') });
	const order = await toolbar(page)
		.getByRole('button')
		.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? el.textContent));
	expect(order).toStrictEqual([...NAMES, 'Plain editor']);
	for (const name of NAMES) {
		await expect(control(page, name)).toBeEnabled();
	}
	// The mode button names the editor it switches to; it is not a pressed toggle.
	await expect(control(page, 'Plain editor')).not.toHaveAttribute('aria-pressed', /.+/u);
});

test('Bold, bullets and indent edit the real notes and survive a slide change', async ({
	page,
}) => {
	await openNotes(page);
	const editor = await typeNotes(page, 'Alpha beta');
	await control(page, 'Bold').click();
	await expect(editor.locator('b, strong, [style*="font-weight"]').first()).toBeVisible();
	await control(page, 'Bullet list').click();
	await expect(editor.locator('[data-bullet-type="bullet"]').first()).toBeVisible();
	await control(page, 'Increase indent').click();
	await expect(editor.locator('[data-indent-level="1"]').first()).toBeVisible();
	await roundTripSlide(page);
	await expect(editor.locator('[data-bullet-type="bullet"]').first()).toContainText('Alpha beta');
	await expect(editor.locator('[data-indent-level="1"]').first()).toBeVisible();
	await expect(editor.locator('b, strong, [style*="font-weight"]').first()).toBeVisible();
	await control(page, 'Decrease indent').click();
	await expect(editor.locator('[data-indent-level="1"]')).toHaveCount(0);
});

test('the link popover replaces window.prompt and inserts the link at the selection', async ({
	page,
}) => {
	let prompted = false;
	page.on('dialog', async (dialog) => {
		prompted = true;
		await dialog.dismiss();
	});
	await openNotes(page);
	const editor = await typeNotes(page, 'Docs');
	await control(page, 'Insert link').click();
	const dialog = page.getByRole('dialog', { name: 'Insert link' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('textbox', { name: 'Display text' })).toHaveValue('Docs');
	const url = dialog.getByRole('textbox', { name: 'URL' });
	await expect(url).toBeFocused();
	await url.fill('example.com');
	await page.keyboard.press('Enter');
	await expect(dialog).toBeHidden();
	await expect(editor.locator('a[href="https://example.com"]')).toHaveText('Docs');
	await roundTripSlide(page);
	await expect(editor.locator('a[href="https://example.com"]')).toHaveText('Docs');
	expect(prompted).toBe(false);
});

test('Escape closes the link popover and returns focus to the Insert link button', async ({
	page,
}) => {
	await openNotes(page);
	await typeNotes(page, 'Docs');
	await control(page, 'Insert link').click();
	const dialog = page.getByRole('dialog', { name: 'Insert link' });
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(control(page, 'Insert link')).toBeFocused();
	// An empty URL is refused and flagged instead of closing the form.
	await control(page, 'Insert link').click();
	await page.keyboard.press('Enter');
	await expect(dialog.getByRole('textbox', { name: 'URL' })).toHaveAttribute(
		'aria-invalid',
		'true',
	);
	await expect(dialog).toBeVisible();
});

test('the toolbar is one roving tab stop with arrow, Home and End navigation', async ({ page }) => {
	await openNotes(page);
	const bold = control(page, 'Bold');
	await bold.focus();
	await expect(bold).toHaveAttribute('tabindex', '0');
	await expect(control(page, 'Italic')).toHaveAttribute('tabindex', '-1');
	await page.keyboard.press('ArrowRight');
	await expect(control(page, 'Italic')).toBeFocused();
	await page.keyboard.press('End');
	await expect(control(page, 'Plain editor')).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await expect(bold).toBeFocused();
	await page.keyboard.press('ArrowLeft');
	await expect(control(page, 'Plain editor')).toBeFocused();
	await page.keyboard.press('Home');
	await expect(bold).toBeFocused();
	// Arrow keys inside the toolbar must not change the slide.
	await expect(page.getByText(/^Slide 1 of \d+$/u).first()).toBeVisible();
});

test('plain mode keeps every button but disables formatting', async ({ page }) => {
	await openNotes(page);
	await control(page, 'Plain editor').click();
	await expect(page.locator('#slide-notes-content textarea[name="slide-notes"]')).toBeVisible();
	await expect(control(page, 'Rich editor')).toBeEnabled();
	for (const name of NAMES.filter((n) => n !== 'Print notes')) {
		await expect(control(page, name)).toBeDisabled();
	}
	await expect(control(page, 'Print notes')).toBeEnabled();
	await control(page, 'Rich editor').click();
	await expect(control(page, 'Bold')).toBeEnabled();
});

test('Print notes starts the native print flow', async ({ page }) => {
	await openNotes(page);
	await control(page, 'Print notes').click();
	await expect
		.poll(async () => {
			const frames = await page.locator('iframe[aria-hidden="true"]').count();
			const dialogs = await page.getByText('Print notes', { exact: true }).count();
			return frames + dialogs;
		})
		.toBeGreaterThan(0);
});

test('theme tokens, focus ring and forced colors apply to the shared toolbar', async ({ page }) => {
	await openNotes(page);
	await page
		.locator('pptx-ui-notes-toolbar')
		.evaluate((host) => host.style.setProperty('--pptx-border', '#123456'));
	await expect(page.locator('pptx-ui-notes-toolbar .group')).toHaveCSS(
		'border-top-color',
		'rgb(18, 52, 86)',
	);
	await control(page, 'Bold').focus();
	await expect(control(page, 'Bold')).toBeFocused();
	await page.emulateMedia({ forcedColors: 'active' });
	await expect(control(page, 'Bold')).toBeVisible();
	await expect(control(page, 'Bold')).toHaveCSS('color', /.+/u);
});

test.describe('touch notes toolbar', () => {
	test.use({ hasTouch: true });
	test('buttons meet the 44px touch target', async ({ page }) => {
		await openNotes(page);
		for (const name of [...NAMES, 'Plain editor']) {
			const box = await control(page, name).boundingBox();
			expect(box!.height, name).toBeGreaterThanOrEqual(44);
			expect(box!.width, name).toBeGreaterThanOrEqual(44);
		}
	});
});
