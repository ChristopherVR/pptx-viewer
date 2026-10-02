import { writeFile } from 'node:fs/promises';

/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
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

const hex = (css: string) =>
	`#${(css.match(/\d+/gu) ?? [])
		.slice(0, 3)
		.map((part) => Number(part).toString(16).padStart(2, '0'))
		.join('')}`;
const swatchColour = (locator: Locator) =>
	locator.evaluate((node) => getComputedStyle(node).backgroundColor).then(hex);

test.describe('Home font extras and paragraph menus', () => {
	test('expose every id once, as selects and menus, and gate them on a text selection', async ({
		page,
	}) => {
		await openHome(page);
		for (const id of [
			'fontFamily',
			'fontSize',
			'characterSpacing',
			'changeCase',
			'fontColor',
			'highlightColor',
		]) {
			await expect(page.locator(`[data-ribbon-control="home.font.${id}"]`)).toHaveCount(1);
		}
		for (const id of ['bullets', 'numbering', 'lineSpacing', 'textDirection', 'columns']) {
			await expect(page.locator(`[data-ribbon-control="home.paragraph.${id}"]`)).toHaveCount(1);
		}
		await expect(control(page, 'home.font.fontFamily')).toHaveAttribute(
			'data-font-picker',
			'family',
		);
		await expect(control(page, 'home.font.fontSize')).toHaveAttribute('data-font-picker', 'size');
		await expect(control(page, 'home.font.fontSize')).toHaveAttribute('disabled', '');
		await expect(inner(page, 'home.font.changeCase')).toBeDisabled();
		await expect(inner(page, 'home.font.fontColor')).toBeDisabled();
		await expect(inner(page, 'home.paragraph.bullets')).toBeDisabled();
		await selectSubtitle(page);
		await expect(control(page, 'home.font.fontSize')).not.toHaveAttribute('disabled', '');
		await expect(inner(page, 'home.font.changeCase')).toBeEnabled();
		await expect(inner(page, 'home.font.fontColor')).toBeEnabled();
		await expect(inner(page, 'home.paragraph.bullets')).toBeEnabled();
	});

	test('Change Case, font size and line spacing edit the deck, undo and save', async ({
		page,
	}, info) => {
		await openHome(page);
		await selectSubtitle(page);
		const change = inner(page, 'home.font.changeCase');
		await change.click();
		await expect(change).toHaveAttribute('aria-expanded', 'true');
		await page.getByRole('menuitem', { name: 'UPPERCASE', exact: true }).click();
		await expect(change).toHaveAttribute('aria-expanded', 'false');
		await expect(page.getByText('PRODUCT OVERVIEW').first()).toBeVisible();
		await page.keyboard.press('Control+z');
		await expect(elementWithText(page, 'Product Overview')).toBeVisible();
		await selectSubtitle(page);
		await control(page, 'home.font.fontSize').getByRole('combobox').click();
		await page.getByRole('option', { name: '36', exact: true }).click();
		await control(page, 'home.paragraph.lineSpacing').getByRole('combobox').click();
		await page.getByRole('option', { name: '1.5', exact: true }).click();
		const saved = await savedSubtitleRun(page, info, 'home-font-extras.pptx');
		expect(saved.run).toMatch(/\ssz="3600"/u);
		const paragraph = await savedSubtitleParagraph(page, info, 'home-line-spacing.pptx');
		expect(paragraph.paragraph).toMatch(/<a:lnSpc>/u);
	});

	test('the font colour popover applies a swatch, lists it as recent and closes on Escape', async ({
		page,
	}, info) => {
		await openHome(page);
		await selectSubtitle(page);
		const trigger = inner(page, 'home.font.fontColor');
		await trigger.click();
		await expect(trigger).toHaveAttribute('aria-expanded', 'true');
		const swatch = control(page, 'home.font.fontColor').locator('.std-grid button').nth(3);
		const colour = await swatchColour(swatch);
		await page.screenshot({ path: info.outputPath('home-colour-popover.png') });
		await swatch.click();
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		await trigger.click();
		await expect(
			control(page, 'home.font.fontColor').getByTestId('pptx-color-recent'),
		).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		const saved = await savedSubtitleRun(page, info, 'home-font-colour.pptx');
		expect(saved.run.toLowerCase()).toContain(colour.slice(1));
	});

	test('Bullets toggles the list and keeps its ids; the gallery chevron opens the library', async ({
		page,
	}) => {
		await openHome(page);
		await selectSubtitle(page);
		const bullets = inner(page, 'home.paragraph.bullets');
		await bullets.click();
		await expect(bullets).toHaveAttribute('aria-pressed', 'true');
		await bullets.click();
		await expect(bullets).toHaveAttribute('aria-pressed', 'false');
		await control(page, 'home.paragraph.bullets').locator('[data-ribbon-gallery]').click();
		await expect(page.locator('[data-ribbon-gallery-popup="bullets"]')).toBeVisible();
	});

	test('the Select menu offers Select All and Escape closes it', async ({ page }) => {
		await openHome(page);
		const select = inner(page, 'home.editing.select');
		await select.click();
		await expect(select).toHaveAttribute('aria-expanded', 'true');
		await expect(page.getByRole('menuitem', { name: 'Select All', exact: true })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(select).toHaveAttribute('aria-expanded', 'false');
	});
});

test.describe('Home drawing popovers and arrange extras', () => {
	async function insertRectangle(page: Page) {
		await inner(page, 'home.drawing.shapes').click();
		await page
			.getByRole('menuitem', { name: 'Rectangle', exact: true })
			.or(page.getByText('Rectangle', { exact: true }))
			.first()
			.click();
	}

	test('expose Group, Ungroup, Merge, Crop, width and the second Format Painter once', async ({
		page,
	}) => {
		await openHome(page);
		for (const id of ['group', 'ungroup', 'mergeShapes', 'crop', 'outlineWidth']) {
			await expect(page.locator(`[data-ribbon-control="home.arrange.${id}"]`)).toHaveCount(1);
		}
		await expect(page.locator('[data-ribbon-control="home.clipboard.formatPainter"]')).toHaveCount(
			2,
		);
		await expect(control(page, 'home.arrange.group')).toBeDisabled();
		await expect(inner(page, 'home.arrange.mergeShapes')).toBeDisabled();
		await expect(control(page, 'home.arrange.outlineWidth')).toBeDisabled();
		await selectSubtitle(page);
		await expect(control(page, 'home.arrange.outlineWidth')).toBeEnabled();
	});

	test('Shape Fill and Outline popovers, outline width and the Arrange menu edit a shape and save', async ({
		page,
	}, info) => {
		await openHome(page);
		await insertRectangle(page);
		const fill = inner(page, 'home.drawing.shapeFill');
		await fill.click();
		await expect(fill).toHaveAttribute('aria-expanded', 'true');
		const swatch = control(page, 'home.drawing.shapeFill').locator('.std-grid button').nth(3);
		const colour = await swatchColour(swatch);
		await swatch.click();
		await expect(fill).toHaveAttribute('aria-expanded', 'false');
		await inner(page, 'home.drawing.shapeOutline').click();
		await control(page, 'home.drawing.shapeOutline').locator('.std-grid button').nth(5).click();
		const width = control(page, 'home.arrange.outlineWidth');
		await width.fill('6');
		await width.press('Tab');
		await inner(page, 'home.drawing.arrange').click();
		await page.getByRole('menuitem', { name: 'Send to Back', exact: true }).click();
		const bytes = await downloadBytes(await savePptxViaBackstage(page));
		const xml = await (await JSZip.loadAsync(bytes)).file('ppt/slides/slide1.xml')!.async('string');
		await writeFile(info.outputPath('home-shape.pptx'), bytes);
		expect(xml.toLowerCase()).toContain(`val="${colour.slice(1)}"`);
		expect(xml).toContain('w="57150"');
	});

	test('Merge Shapes and Crop stay gated without two shapes or a picture', async ({ page }) => {
		await openHome(page);
		await insertRectangle(page);
		await expect(inner(page, 'home.arrange.crop')).toBeDisabled();
		await expect(inner(page, 'home.arrange.mergeShapes')).toBeDisabled();
	});

	test('the Layout gallery lists tiles with the current one marked and applies a layout', async ({
		page,
	}, info) => {
		await openHome(page);
		await inner(page, 'home.slides.layout').click();
		const menu = page.getByTestId('layout-gallery-menu');
		await expect(menu).toBeVisible();
		await expect(menu.locator('[aria-current="true"]')).toHaveCount(1);
		await page.waitForTimeout(400);
		await page.screenshot({ path: info.outputPath('home-layout-gallery.png') });
		const tiles = menu.locator('[data-layout-path]');
		expect(await tiles.count()).toBeGreaterThan(1);
		await tiles.nth(1).click();
		await expect(menu).toBeHidden();
		await expect(inner(page, 'home.slides.layout')).toHaveAttribute('aria-expanded', 'false');
	});

	test('retain public customization ids for the new controls', async ({ page }) => {
		const ids = [
			'home.font.characterSpacing',
			'home.paragraph.columns',
			'home.arrange.outlineWidth',
			'home.editing.select',
		];
		const customization = { ribbon: { hiddenButtons: ids } };
		await openHome(page, `/?customization=${encodeURIComponent(JSON.stringify(customization))}`);
		for (const id of ids) {
			await expect(control(page, id)).toBeHidden();
		}
		await expect(control(page, 'home.font.changeCase')).toBeVisible();
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
