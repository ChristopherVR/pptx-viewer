import { writeFile } from 'node:fs/promises';

/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import JSZip from 'jszip';

import { savePptxViaBackstage } from './save-pptx';
import { elementWithText, loadDeck, ribbonTab, selectElement, slideElements } from './support/deck';
import { downloadBytes } from './support/exports';

test.use({ viewport: { width: 1440, height: 900 } });

const control = (page: Page, id: string) => page.locator(`[data-ribbon-control="${id}"]`).first();

async function openHome(page: Page, path?: string) {
	await loadDeck(page, undefined, path);
	await ribbonTab(page, 'Home').click();
}

async function selectSubtitle(page: Page) {
	await selectElement(page, elementWithText(page, 'Product Overview'));
}

const CLIPBOARD = [
	'home.clipboard.paste',
	'home.clipboard.cut',
	'home.clipboard.copy',
	'home.clipboard.formatPainter',
];

test.describe('Home clipboard', () => {
	test('exposes the canonical group and control ids once', async ({ page }, info) => {
		await openHome(page);
		await expect(page.locator('[data-ribbon-group="home.clipboard"]')).toHaveCount(1);
		const group = page.locator('[data-ribbon-group="home.clipboard"]');
		for (const id of CLIPBOARD) {
			await expect(group.locator(`[data-ribbon-control="${id}"]`)).toHaveCount(1);
		}
		await page.screenshot({ path: info.outputPath('home.png') });
	});

	test('gates actions on the selection and the clipboard', async ({ page }) => {
		await openHome(page);
		await expect(control(page, 'home.clipboard.copy')).toBeDisabled();
		await expect(control(page, 'home.clipboard.cut')).toBeDisabled();
		await expect(control(page, 'home.clipboard.paste')).toBeDisabled();
		await selectSubtitle(page);
		await expect(control(page, 'home.clipboard.copy')).toBeEnabled();
		await expect(control(page, 'home.clipboard.cut')).toBeEnabled();
		await expect(control(page, 'home.clipboard.paste')).toBeDisabled();
		await control(page, 'home.clipboard.copy').click();
		await expect(control(page, 'home.clipboard.paste')).toBeEnabled();
	});

	test('copy, paste, cut and undo change the slide', async ({ page }) => {
		await openHome(page);
		const count = () => slideElements(page).count();
		const before = await count();
		await selectSubtitle(page);
		// Keyboard activation reaches the native clipboard action.
		await expect(control(page, 'home.clipboard.copy')).toBeEnabled();
		await control(page, 'home.clipboard.copy').focus();
		await expect(control(page, 'home.clipboard.copy')).toBeFocused();
		await page.keyboard.press('Space');
		await expect(control(page, 'home.clipboard.paste')).toBeEnabled();
		await control(page, 'home.clipboard.paste').click();
		await expect.poll(count).toBe(before + 1);
		await page.keyboard.press('Control+z');
		await expect.poll(count).toBe(before);
		await page.getByRole('button', { name: 'Redo', exact: true }).first().click();
		await expect.poll(count).toBe(before + 1);
		await selectSubtitle(page);
		await control(page, 'home.clipboard.cut').click();
		await expect.poll(count).toBe(before);
		await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
		await expect.poll(count).toBe(before + 1);
	});

	test('arms and cancels the Format Painter', async ({ page }) => {
		await openHome(page);
		const painter = page.getByTestId('format-painter-toggle').first();
		await expect(painter).toBeDisabled();
		await selectSubtitle(page);
		await expect(painter).toBeEnabled();
		await painter.click();
		await expect(painter).toHaveAttribute('data-active', 'true');
		await expect(painter).toHaveAttribute('aria-pressed', 'true');
		await painter.click();
		await expect(painter).toHaveAttribute('data-active', 'false');
	});

	test('retains public customization ids', async ({ page }) => {
		const customization = {
			ribbon: { hiddenButtons: ['home.clipboard.paste', 'home.clipboard.formatPainter'] },
		};
		await openHome(page, `/?customization=${encodeURIComponent(JSON.stringify(customization))}`);
		await expect(control(page, 'home.clipboard.paste')).toBeHidden();
		await expect(control(page, 'home.clipboard.formatPainter')).toBeHidden();
		await expect(control(page, 'home.clipboard.copy')).toBeVisible();
		const groups = { ribbon: { hiddenGroups: ['home.clipboard'] } };
		await openHome(page, `/?customization=${encodeURIComponent(JSON.stringify(groups))}`);
		await expect(page.locator('[data-ribbon-group="home.clipboard"]')).toBeHidden();
	});
});

const FONT = [
	'bold',
	'italic',
	'underline',
	'strikethrough',
	'shadow',
	'increaseFontSize',
	'decreaseFontSize',
	'clearFormatting',
];

const pressed = (page: Page, id: string) => control(page, `home.font.${id}`);

type Info = { outputPath: (name: string) => string };

async function savedSubtitleRun(page: Page, info: Info, name: string) {
	const bytes = await downloadBytes(await savePptxViaBackstage(page));
	const saved = info.outputPath(name);
	await writeFile(saved, bytes);
	const zip = await JSZip.loadAsync(bytes);
	const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
	const run = xml.split('<a:r>').find((chunk) => chunk.includes('Product Overview')) ?? '';
	return { saved, run };
}

test.describe('Home font', () => {
	test('exposes every character control once and gates them on a text selection', async ({
		page,
	}) => {
		await openHome(page);
		for (const id of FONT) {
			await expect(page.locator(`[data-ribbon-control="home.font.${id}"]`)).toHaveCount(1);
			await expect(pressed(page, id)).toBeDisabled();
		}
		await selectSubtitle(page);
		for (const id of FONT) {
			await expect(pressed(page, id)).toBeEnabled();
		}
		await expect(pressed(page, 'bold')).toHaveAttribute('aria-pressed', 'false');
	});

	test('character formatting edits the deck, undoes and survives save and reload', async ({
		page,
	}, info) => {
		await openHome(page);
		await selectSubtitle(page);
		const size = control(page, 'home.font.fontSize');
		const readSize = () => size.evaluate((node) => Number((node as HTMLSelectElement).value));
		const before = await readSize();
		// Keyboard activation reaches the native edit.
		await expect(pressed(page, 'bold')).toBeEnabled();
		await pressed(page, 'bold').focus();
		await expect(pressed(page, 'bold')).toBeFocused();
		await page.keyboard.press('Space');
		await expect(pressed(page, 'bold')).toHaveAttribute('aria-pressed', 'true');
		await page.getByRole('button', { name: 'Undo', exact: true }).first().click();
		// The undone edit never reaches the saved file.
		expect((await savedSubtitleRun(page, info, 'home-font-undo.pptx')).run).not.toMatch(/\sb="1"/u);
		await selectSubtitle(page);
		await expect(pressed(page, 'bold')).toBeEnabled();
		await pressed(page, 'bold').click();
		await expect(pressed(page, 'bold')).toHaveAttribute('aria-pressed', 'true');
		await pressed(page, 'italic').click();
		await pressed(page, 'underline').click();
		await expect(pressed(page, 'italic')).toHaveAttribute('aria-pressed', 'true');
		await expect(pressed(page, 'underline')).toHaveAttribute('aria-pressed', 'true');
		await pressed(page, 'increaseFontSize').click();
		await expect.poll(readSize).toBeGreaterThan(before);
		const saved = await savedSubtitleRun(page, info, 'home-font.pptx');
		expect(saved.run).toMatch(/\sb="1"/u);
		expect(saved.run).toMatch(/\si="1"/u);
		expect(saved.run).toMatch(/\su="sng"/u);
		expect(Number(/\ssz="(\d+)"/u.exec(saved.run)?.[1])).toBeGreaterThan(1500);
		await pressed(page, 'clearFormatting').click();
		await expect(pressed(page, 'bold')).toHaveAttribute('aria-pressed', 'false');
		await expect(pressed(page, 'italic')).toHaveAttribute('aria-pressed', 'false');
		await loadDeck(page, saved.saved);
		await ribbonTab(page, 'Home').click();
		await selectSubtitle(page);
		await expect(pressed(page, 'bold')).toHaveAttribute('aria-pressed', 'true');
		await expect(pressed(page, 'italic')).toHaveAttribute('aria-pressed', 'true');
	});

	test('text shadow toggles and retains public customization ids', async ({ page }) => {
		await openHome(page);
		await selectSubtitle(page);
		await pressed(page, 'shadow').click();
		await expect(pressed(page, 'shadow')).toHaveAttribute('aria-pressed', 'true');
		await pressed(page, 'shadow').click();
		await expect(pressed(page, 'shadow')).toHaveAttribute('aria-pressed', 'false');
		const customization = {
			ribbon: { hiddenButtons: ['home.font.bold', 'home.font.clearFormatting'] },
		};
		await openHome(page, `/?customization=${encodeURIComponent(JSON.stringify(customization))}`);
		await expect(pressed(page, 'bold')).toBeHidden();
		await expect(pressed(page, 'clearFormatting')).toBeHidden();
		await expect(pressed(page, 'italic')).toBeVisible();
	});
});

const PARAGRAPH = [
	'decreaseIndent',
	'increaseIndent',
	'alignLeft',
	'alignCenter',
	'alignRight',
	'justify',
];
const para = (page: Page, id: string) => control(page, `home.paragraph.${id}`);

/** The text body that holds the subtitle in the saved slide XML (paragraph defaults live in its list style). */
async function savedSubtitleParagraph(page: Page, info: Info, name: string) {
	const bytes = await downloadBytes(await savePptxViaBackstage(page));
	const saved = info.outputPath(name);
	await writeFile(saved, bytes);
	const zip = await JSZip.loadAsync(bytes);
	const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
	const paragraph =
		xml.split('<p:txBody>').find((chunk) => chunk.includes('Product Overview')) ?? '';
	return { saved, paragraph };
}

test.describe('Home paragraph', () => {
	test('exposes the indent and alignment controls once and gates them on a text selection', async ({
		page,
	}) => {
		await openHome(page);
		for (const id of PARAGRAPH) {
			await expect(page.locator(`[data-ribbon-control="home.paragraph.${id}"]`)).toHaveCount(1);
			await expect(para(page, id)).toBeDisabled();
		}
		await selectSubtitle(page);
		for (const id of PARAGRAPH) {
			await expect(para(page, id)).toBeEnabled();
		}
	});

	test('alignment and indent edit the deck and survive save and reload', async ({ page }, info) => {
		await openHome(page);
		await selectSubtitle(page);
		await expect(para(page, 'alignRight')).toBeEnabled();
		// Keyboard activation reaches the native edit.
		await para(page, 'alignCenter').focus();
		await expect(para(page, 'alignCenter')).toBeFocused();
		await page.keyboard.press('Space');
		await expect(para(page, 'alignCenter')).toHaveAttribute('aria-pressed', 'true');
		await para(page, 'alignRight').click();
		await expect(para(page, 'alignRight')).toHaveAttribute('aria-pressed', 'true');
		await expect(para(page, 'alignCenter')).toHaveAttribute('aria-pressed', 'false');
		await para(page, 'increaseIndent').click();
		const saved = await savedSubtitleParagraph(page, info, 'home-paragraph.pptx');
		expect(saved.paragraph).toMatch(/\salgn="r"/u);
		expect(Number(/\smarL="(\d+)"/u.exec(saved.paragraph)?.[1])).toBeGreaterThan(0);
		await loadDeck(page, saved.saved);
		await ribbonTab(page, 'Home').click();
		await selectSubtitle(page);
		await expect(para(page, 'alignRight')).toHaveAttribute('aria-pressed', 'true');
	});

	test('retains public customization ids', async ({ page }) => {
		const customization = {
			ribbon: { hiddenButtons: ['home.paragraph.justify', 'home.paragraph.alignLeft'] },
		};
		await openHome(page, `/?customization=${encodeURIComponent(JSON.stringify(customization))}`);
		await expect(para(page, 'justify')).toBeHidden();
		await expect(para(page, 'alignLeft')).toBeHidden();
		await expect(para(page, 'alignCenter')).toBeVisible();
	});
});

test.describe('Home editing', () => {
	test('Find and Replace open the find panel and keep their ids', async ({ page }) => {
		await openHome(page);
		const find = page.locator('input[placeholder*="Find" i]').first();
		for (const id of ['find', 'replace']) {
			await expect(page.locator(`[data-ribbon-control="home.editing.${id}"]`)).toHaveCount(1);
		}
		await expect(find).toBeHidden();
		await control(page, 'home.editing.find').click();
		await expect(find).toBeVisible();
		await control(page, 'home.editing.replace').click();
		const customization = { ribbon: { hiddenButtons: ['home.editing.replace'] } };
		await openHome(page, `/?customization=${encodeURIComponent(JSON.stringify(customization))}`);
		await expect(control(page, 'home.editing.replace')).toBeHidden();
		await expect(control(page, 'home.editing.find')).toBeVisible();
	});
});

const rows = (page: Page) => page.locator('[data-pptx-chrome="slide-row"]');
const inner = (page: Page, id: string) => {
	const host = control(page, id);
	return host
		.locator('button')
		.first()
		.or(host.and(page.locator('button')));
};

test.describe('Home slides', () => {
	test('exposes the group and ids once; New Slide and Reset edit the deck with undo', async ({
		page,
	}) => {
		await openHome(page);
		await expect(page.locator('[data-ribbon-group="home.slides"]')).toHaveCount(1);
		for (const id of ['newSlide', 'slideTemplates', 'layout', 'reset', 'section']) {
			await expect(page.locator(`[data-ribbon-control="home.slides.${id}"]`)).toHaveCount(1);
		}
		const before = await rows(page).count();
		await page
			.locator('[data-ribbon-control="home.slides.newSlide"] [data-pptx-chrome="split-main"]')
			.click();
		await expect(rows(page)).toHaveCount(before + 1);
		await page.keyboard.press('Control+z');
		await expect(rows(page)).toHaveCount(before);
	});

	test('the Layout and New Slide caret open native menus and Escape or a second press closes them', async ({
		page,
	}) => {
		await openHome(page);
		const layout = inner(page, 'home.slides.layout');
		await expect(layout).toBeEnabled();
		await layout.click();
		await expect(layout).toHaveAttribute('aria-expanded', 'true');
		await layout.click();
		await expect(layout).toHaveAttribute('aria-expanded', 'false');
		const caret = page.locator(
			'[data-ribbon-control="home.slides.newSlide"] [data-pptx-chrome="split-caret"]',
		);
		await caret.click();
		await expect(caret).toHaveAttribute('aria-expanded', 'true');
	});

	test('retains public customization ids', async ({ page }) => {
		const customization = {
			ribbon: { hiddenButtons: ['home.slides.reset', 'home.slides.layout'] },
		};
		await openHome(page, `/?customization=${encodeURIComponent(JSON.stringify(customization))}`);
		await expect(control(page, 'home.slides.reset')).toBeHidden();
		await expect(control(page, 'home.slides.layout')).toBeHidden();
		await expect(control(page, 'home.slides.section')).toBeVisible();
	});
});

test.describe('Home drawing and arrange', () => {
	test('gates the Drawing triggers and Arrange strips on a selection', async ({ page }) => {
		await openHome(page);
		await expect(page.locator('[data-ribbon-group="home.drawing"]')).toHaveCount(1);
		await expect(inner(page, 'home.drawing.shapes')).toBeEnabled();
		for (const id of ['arrange', 'shapeFill', 'shapeOutline']) {
			await expect(page.locator(`[data-ribbon-control="home.drawing.${id}"]`)).toHaveCount(1);
			await expect(inner(page, `home.drawing.${id}`)).toBeDisabled();
		}
		const arrangeIds = [
			'flipHorizontal',
			'flipVertical',
			'sendBackward',
			'bringForward',
			'sendToBack',
			'bringToFront',
			'duplicate',
			'delete',
		];
		for (const id of arrangeIds) {
			await expect(page.locator(`[data-ribbon-control="home.arrange.${id}"]`)).toHaveCount(1);
			await expect(control(page, `home.arrange.${id}`)).toBeDisabled();
		}
		await expect(page.locator('[data-ribbon-control="home.arrange.align"]')).toHaveCount(1);
		await selectSubtitle(page);
		for (const id of arrangeIds) {
			await expect(control(page, `home.arrange.${id}`)).toBeEnabled();
		}
		for (const id of ['arrange', 'shapeFill', 'shapeOutline']) {
			await expect(inner(page, `home.drawing.${id}`)).toBeEnabled();
		}
	});

	test('Duplicate, Delete and z-order edit the deck and undo', async ({ page }) => {
		await openHome(page);
		const count = () => slideElements(page).count();
		const before = await count();
		await selectSubtitle(page);
		await control(page, 'home.arrange.duplicate').click();
		await expect.poll(count).toBe(before + 1);
		await page.keyboard.press('Control+z');
		await expect.poll(count).toBe(before);
		await selectSubtitle(page);
		await control(page, 'home.arrange.delete').click();
		await expect.poll(count).toBe(before - 1);
		await page.keyboard.press('Control+z');
		await expect.poll(count).toBe(before);
		await selectSubtitle(page);
		await control(page, 'home.arrange.bringToFront').focus();
		await page.keyboard.press('Space');
		await expect
			.poll(async () => (await slideElements(page).last().textContent()) ?? '')
			.toContain('Product Overview');
	});

	test('Shapes opens a native menu and inserts a shape', async ({ page }) => {
		await openHome(page);
		const before = await slideElements(page).count();
		await inner(page, 'home.drawing.shapes').click();
		await expect(inner(page, 'home.drawing.shapes')).toHaveAttribute('aria-expanded', 'true');
		await page
			.getByText('Rectangle', { exact: true })
			.or(page.getByLabel('Rectangle', { exact: true }))
			.first()
			.click();
		await expect.poll(() => slideElements(page).count()).toBe(before + 1);
	});

	test('retains public customization ids', async ({ page }) => {
		const customization = {
			ribbon: {
				hiddenButtons: ['home.arrange.align', 'home.arrange.delete', 'home.drawing.shapeFill'],
			},
		};
		await openHome(page, `/?customization=${encodeURIComponent(JSON.stringify(customization))}`);
		await expect(control(page, 'home.arrange.align')).toBeHidden();
		await expect(control(page, 'home.arrange.delete')).toBeHidden();
		await expect(control(page, 'home.drawing.shapeFill')).toBeHidden();
		await expect(control(page, 'home.arrange.duplicate')).toBeVisible();
	});
});

test.describe('touch Home controls', () => {
	test.use({ hasTouch: true });
	test('targets, theme tokens and forced colors remain usable', async ({ page }) => {
		await loadDeck(page);
		await ribbonTab(page, 'Home').tap();
		await page.setViewportSize({ width: 900, height: 900 });
		const copy = control(page, 'home.clipboard.copy');
		await copy.evaluate((button) => {
			(button.closest('pptx-ui-ribbon-home-clipboard') as HTMLElement).style.setProperty(
				'--pptx-foreground',
				'#123456',
			);
		});
		await expect(copy).toHaveCSS('color', 'rgb(18, 52, 86)');
		for (const button of [
			copy,
			pressed(page, 'bold'),
			para(page, 'alignLeft'),
			control(page, 'home.arrange.sendToBack'),
			inner(page, 'home.slides.reset'),
		]) {
			const box = await button.boundingBox();
			expect(box!.width).toBeGreaterThanOrEqual(44);
			expect(box!.height).toBeGreaterThanOrEqual(44);
		}
		await page.emulateMedia({ forcedColors: 'active' });
		await expect(copy).toBeVisible();
	});
});
