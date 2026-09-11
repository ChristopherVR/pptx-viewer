/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Table styling, run identically against every framework demo.
 *
 * Before this spec there was NO cross-binding coverage of table style
 * resolution at all (`grep -rn "tableStyle|bandRow|firstRow" e2e/*.spec.ts`
 * returned nothing), which is how four separate table defects shipped at once:
 * a missing built-in style catalogue, an inverted style-part precedence, an
 * unrendered `a:tblPr@rtl`, and per-run cell formatting that no binding could
 * receive.
 *
 * FIXTURE (`e2e/fixtures/table-styling.pptx`) is PowerPoint 16.0's own output,
 * built over COM, one table per slide:
 *
 *   1  "Medium Style 2 - Accent 3", header row + banded rows
 *   2  "Dark Style 1 - Accent 1", header row + first column (they cross)
 *   3  "Medium Style 2 - Accent 1" with `a:tblPr@rtl="1"`
 *   4  "No Style, Table Grid" with one mixed-format cell
 *   5  "Medium Style 2 - Accent 6", its definition then DELETED from
 *      `ppt/tableStyles.xml` - which is what every deck produced by something
 *      other than PowerPoint looks like, since the built-in gallery styles are
 *      known by GUID and never written into the package.
 *
 * The expected colours are what PowerPoint itself paints, sampled from its
 * exported PNGs:
 *
 *   slide 1  header #196B24 (accent3), body rows banded lighter
 *   slide 2  header x first column #000000 (dk1, the ROW part wins),
 *            first column x body row #0E4B66, ordinary body #156082
 *   slide 5  header #4EA72E (accent6)
 *
 * Assertions are on colour RELATIONSHIPS (which channel dominates, which cells
 * match each other) rather than exact hex, because our tint/shade math runs in
 * sRGB where PowerPoint's runs in linear RGB. That is a separate, known
 * colour-transform gap; what matters here is that the right style PART is being
 * applied and that it is themed at all rather than falling back to the
 * hardcoded accent1 blue.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import JSZip from 'jszip';

import { savePptxViaBackstage } from './save-pptx';
import {
	centreOf,
	chooseCommand,
	menuIsOpen,
	openMenuAt,
	openMenuOn,
	selectTableCell,
} from './support/context-menu';
import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/table-styling.pptx', import.meta.url)),
);

const LOAD_TIMEOUT_MS = 60_000;
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

interface DeckPayload {
	name: string;
	mimeType: string;
	buffer: Buffer;
}

/** The hardcoded fallback every unresolved table style used to paint. */
const BLUE_FALLBACK = { r: 68, g: 114, b: 196 };

interface CellPaint {
	text: string;
	row: number;
	col: number;
	x: number;
	width: number;
	background: string;
	/** Computed `color`, i.e. what the cell's own text actually paints in. */
	color: string;
	fontSize: number;
	borderTop: string;
	borderTopWidth: number;
	/** Per-run spans inside the cell: their text, weight, colour, family and size. */
	runs: Array<{
		text: string;
		fontWeight: string;
		color: string;
		fontFamily: string;
		fontSize: number;
	}>;
}

interface TablePaint {
	direction: string;
	cells: CellPaint[];
}

/**
 * Measure the current slide's rendered `<table>`, cell by cell.
 *
 * Picked by largest VISIBLE area, not largest area: several bindings keep every
 * slide mounted and scroll between them, so the off-screen slide 1 table stays
 * the biggest element on the page for the whole run and a plain area test
 * silently measures it on every slide.
 */
async function measureTable(page: Page, containing?: string): Promise<TablePaint> {
	return page.evaluate((needle: string | undefined) => {
		// When a needle is given, only tables holding a cell with that text are
		// candidates: a table INSERTED onto a slide that already has one has to be
		// told apart from it, and it is not necessarily the larger of the two.
		const tables = Array.from(document.querySelectorAll('table')).filter(
			(table) =>
				!needle ||
				Array.from(table.querySelectorAll('td, th')).some((cell) =>
					(cell.textContent ?? '').includes(needle),
				),
		);
		let best: HTMLTableElement | undefined;
		let bestArea = 0;
		for (const table of tables) {
			const rect = table.getBoundingClientRect();
			const visibleWidth = Math.max(
				0,
				Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0),
			);
			const visibleHeight = Math.max(
				0,
				Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0),
			);
			const area = visibleWidth * visibleHeight;
			if (area > bestArea) {
				bestArea = area;
				best = table as HTMLTableElement;
			}
		}
		if (!best) {
			return { direction: '', cells: [] };
		}
		const cells: TablePaint['cells'] = [];
		const rows = Array.from(best.querySelectorAll('tr'));
		rows.forEach((tr, rowIndex) => {
			Array.from(tr.querySelectorAll('td, th')).forEach((td, colIndex) => {
				const style = getComputedStyle(td);
				const rect = td.getBoundingClientRect();
				const runs = Array.from(td.querySelectorAll('span')).map((span) => {
					const runStyle = getComputedStyle(span);
					return {
						text: span.textContent ?? '',
						fontWeight: runStyle.fontWeight,
						color: runStyle.color,
						fontFamily: runStyle.fontFamily,
						fontSize: Number.parseFloat(runStyle.fontSize) || 0,
					};
				});
				cells.push({
					text: (td.textContent ?? '').trim(),
					row: rowIndex,
					col: colIndex,
					x: rect.x,
					width: rect.width,
					background: style.backgroundColor,
					color: style.color,
					fontSize: Number.parseFloat(style.fontSize) || 0,
					borderTop: style.borderTopStyle,
					borderTopWidth: Number.parseFloat(style.borderTopWidth) || 0,
					runs,
				});
			});
		});
		return { direction: getComputedStyle(best).direction, cells };
	}, containing);
}

/** Parse a computed `rgb()` / `rgba()` string. */
function rgb(value: string): { r: number; g: number; b: number; a: number } {
	const parts = value.match(/[\d.]+/gu)?.map(Number) ?? [];
	return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts[3] ?? 1 };
}

/** Euclidean distance between two colours, ignoring alpha. */
function distance(a: string, b: { r: number; g: number; b: number }): number {
	const c = rgb(a);
	return Math.hypot(c.r - b.r, c.g - b.g, c.b - b.b);
}

function cellAt(table: TablePaint, row: number, col: number): CellPaint {
	const found = table.cells.find((cell) => cell.row === row && cell.col === col);
	if (!found) {
		throw new Error(`no cell at r${row}c${col}; got ${table.cells.length} cells`);
	}
	return found;
}

async function loadDeck(page: Page, deck: string | DeckPayload = fixturePath): Promise<void> {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(deck);
	await page.locator('[aria-label="Go to slide 5"]').first().waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
}

/**
 * Change PowerPoint's 12pt first run to an exact 10.5pt OOXML value in memory.
 * The checked-in fixture stays byte-for-byte PowerPoint authored while this
 * regression exercises the half-point value that the core parser used to
 * round to 11pt.
 */
async function fractionalTableDeck(): Promise<DeckPayload> {
	const zip = await JSZip.loadAsync(await readFile(fixturePath));
	const slidePath = 'ppt/slides/slide4.xml';
	const slide = zip.file(slidePath);
	if (!slide) {
		throw new Error(`${slidePath} is missing from the table styling fixture`);
	}
	const xml = await slide.async('string');
	const authoredRun = '<a:rPr lang="en-US" sz="1200" b="0">';
	if (!xml.includes(authoredRun)) {
		throw new Error('the expected 12pt Revenue run is missing from slide 4');
	}
	zip.file(slidePath, xml.replace(authoredRun, authoredRun.replace('1200', '1050')));
	return {
		name: 'table-fractional-font-size.pptx',
		mimeType: PPTX_MIME,
		buffer: Buffer.from(await zip.generateAsync({ type: 'uint8array' })),
	};
}

/** Derive a vertical two-cell merge from PowerPoint's public table fixture. */
async function verticallyMergedTableDeck(): Promise<DeckPayload> {
	const zip = await JSZip.loadAsync(await readFile(fixturePath));
	const slidePath = 'ppt/slides/slide4.xml';
	const slide = zip.file(slidePath);
	if (!slide) {
		throw new Error(`${slidePath} is missing from the table styling fixture`);
	}
	const xml = await slide.async('string');
	const rows = [...xml.matchAll(/<a:tr\b[^>]*>.*?<\/a:tr>/gsu)].map((match) => match[0]);
	const first = rows[0];
	const second = rows[1];
	if (!first?.includes('<a:tc>') || !second?.includes('<a:tc>')) {
		throw new Error('slide 4 is missing the expected first two table rows');
	}
	const patchedFirst = first.replace('<a:tc>', '<a:tc rowSpan="2">');
	const patchedSecond = second.replace('<a:tc>', '<a:tc vMerge="1">');
	zip.file(slidePath, xml.replace(first, patchedFirst).replace(second, patchedSecond));
	return {
		name: 'table-vertical-merge.pptx',
		mimeType: PPTX_MIME,
		buffer: Buffer.from(await zip.generateAsync({ type: 'uint8array' })),
	};
}

/** Add the whitespace attribute that makes fast-xml-parser expose `a:t` as an object. */
async function attributedTableTextDeck(): Promise<DeckPayload> {
	const zip = await JSZip.loadAsync(await readFile(fixturePath));
	const slidePath = 'ppt/slides/slide4.xml';
	const slide = zip.file(slidePath);
	if (!slide) {
		throw new Error(`${slidePath} is missing from the table styling fixture`);
	}
	const xml = await slide.async('string');
	const authoredRun = '<a:t>Revenue </a:t>';
	if (!xml.includes(authoredRun)) {
		throw new Error('the expected Revenue run is missing from slide 4');
	}
	zip.file(slidePath, xml.replace(authoredRun, '<a:t xml:space="preserve">Revenue </a:t>'));
	return {
		name: 'table-attributed-text.pptx',
		mimeType: PPTX_MIME,
		buffer: Buffer.from(await zip.generateAsync({ type: 'uint8array' })),
	};
}

interface RawTableRun {
	text: string;
	xml: string;
}

interface RawTableCell {
	text: string;
	runs: RawTableRun[];
}

/** Read slide 4's authored table cells from a saved browser download. */
async function savedSlideFourTable(page: Page): Promise<RawTableCell[][]> {
	const download = await savePptxViaBackstage(page);
	const savedPath = await download.path();
	expect(savedPath, 'the browser should retain the downloaded PPTX').not.toBeNull();
	const zip = await JSZip.loadAsync(await readFile(savedPath!));
	const slide = zip.file('ppt/slides/slide4.xml');
	expect(slide, 'the saved package should contain slide 4').not.toBeNull();
	const xml = await slide!.async('string');
	const table = xml.match(/<a:tbl>.*?<\/a:tbl>/su)?.[0];
	expect(table, 'slide 4 should retain its table XML').toBeTruthy();
	return [...table!.matchAll(/<a:tr\b.*?<\/a:tr>/gsu)].map((row) =>
		[...row[0].matchAll(/<a:tc>.*?<\/a:tc>/gsu)].map((cell) => ({
			text: [...cell[0].matchAll(/<a:t>(.*?)<\/a:t>/gsu)].map((match) => match[1]).join(''),
			runs: [...cell[0].matchAll(/<a:r>(.*?)<\/a:r>/gsu)].map((run) => ({
				text: [...run[1].matchAll(/<a:t>(.*?)<\/a:t>/gsu)].map((match) => match[1]).join(''),
				xml: run[0],
			})),
		})),
	);
}

function expectMixedRevenueRuns(cell: RawTableCell): void {
	expect(cell.text).toBe('Revenue grew 42%');
	expect(cell.runs.map((run) => run.text)).toEqual(['Revenue ', 'grew 42%']);
	expect(cell.runs[0]?.xml).toContain('sz="1200"');
	expect(cell.runs[0]?.xml).toContain('b="0"');
	expect(cell.runs[0]?.xml).toContain('typeface="Arial"');
	expect(cell.runs[1]?.xml).toContain('sz="2400"');
	expect(cell.runs[1]?.xml).toContain('b="1"');
	expect(cell.runs[1]?.xml).toContain('val="C00000"');
	expect(cell.runs[1]?.xml).toContain('typeface="Georgia"');
}

/** Make the cell to the right of the authored rich cell empty without changing its anchor. */
async function richAnchorWithEmptyRightDeck(): Promise<DeckPayload> {
	const zip = await JSZip.loadAsync(await readFile(fixturePath));
	const slidePath = 'ppt/slides/slide4.xml';
	const slide = zip.file(slidePath);
	if (!slide) {
		throw new Error(`${slidePath} is missing from the table styling fixture`);
	}
	const xml = await slide.async('string');
	const table = xml.match(/<a:tbl>.*?<\/a:tbl>/su)?.[0];
	const row = table ? [...table.matchAll(/<a:tr\b.*?<\/a:tr>/gsu)][1]?.[0] : undefined;
	const rightCell = row ? [...row.matchAll(/<a:tc\b[^>]*>.*?<\/a:tc>/gsu)][2]?.[0] : undefined;
	if (!table || !row || !rightCell || !rightCell.includes('<a:t>R2C3</a:t>')) {
		throw new Error('the expected cell to the right of Revenue is missing from slide 4');
	}
	const emptyCell = rightCell.replace(
		/<a:txBody>.*?<\/a:txBody>/su,
		'<a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></a:txBody>',
	);
	const updatedRow = row.replace(rightCell, emptyCell);
	const updatedTable = table.replace(row, updatedRow);
	zip.file(slidePath, xml.replace(table, updatedTable));
	return {
		name: 'table-rich-anchor-empty-right.pptx',
		mimeType: PPTX_MIME,
		buffer: Buffer.from(await zip.generateAsync({ type: 'uint8array' })),
	};
}

async function gotoSlide(page: Page, slideNumber: number): Promise<void> {
	await page.locator(`[aria-label="Go to slide ${slideNumber}"]`).first().click();
	await page.waitForTimeout(800);
}

/** Switch the ribbon to a tab by its accessible name (all five expose this). */
async function openRibbonTab(page: Page, name: string): Promise<void> {
	await page
		.getByRole('toolbar', { name: 'Presentation toolbar' })
		.getByRole('tab', { name, exact: true })
		.click();
	await page.waitForTimeout(300);
}

/** Insert a table from the Insert tab; every binding labels the control "Table". */
async function insertTable(page: Page): Promise<void> {
	await openRibbonTab(page, 'Insert');
	await page.getByRole('button', { name: 'Table', exact: true }).first().click();
	await page.waitForTimeout(900);
}

/**
 * Right-click `cell` and report the menu's lower-cased command labels.
 *
 * A binding with no menu at all yields one explanatory entry rather than an
 * empty array, so the failure names the gap instead of reading as "the command
 * is missing".
 */
async function menuLabelsOn(page: Page, cell: Locator): Promise<string[]> {
	const menu = await openMenuOn(page, cell);
	return menu.present ? menu.labels : ['(no context menu appeared on the cell)'];
}

/** The `<td>` on the main canvas whose text is exactly `text`. */
function canvasCell(page: Page, text: string): Locator {
	return page
		.locator('[aria-roledescription="slide"]')
		.first()
		.locator('td')
		.filter({ hasText: new RegExp(`^\\s*${text}\\s*$`, 'u') })
		.first();
}

/** A cell by rendered row and column, independent of its binding-specific merged text. */
function canvasCellAt(page: Page, row: number, column: number): Locator {
	return page
		.locator('[aria-roledescription="slide"]')
		.first()
		.locator('table tr')
		.nth(row)
		.locator('td')
		.nth(column);
}

/**
 * Select and invoke a cell command through the context menu.
 *
 * Right-click the cell first. If that opens the table-level menu, dismiss it
 * without clearing the table selection, then one left click selects the cell
 * before the second right-click. Re-measure because the inspector moves it.
 */
async function chooseTableCommand(page: Page, cell: Locator, label: string): Promise<void> {
	const box = await cell.boundingBox();
	expect(box, 'the table cell should have a layout box').not.toBeNull();
	const directMenu = await openMenuAt(page, {
		x: box!.x + box!.width / 4,
		y: box!.y + box!.height / 2,
	});
	if (directMenu.labels.includes(label.toLowerCase())) {
		await chooseCommand(page, label);
		return;
	}

	await page.keyboard.press('Escape');
	await expect.poll(() => menuIsOpen(page)).toBe(false);
	const movedBox = await cell.boundingBox();
	expect(movedBox, 'the cell should remain laid out after dismissing the menu').not.toBeNull();
	await page.mouse.click(movedBox!.x + movedBox!.width / 4, movedBox!.y + movedBox!.height / 2);
	await page.waitForTimeout(350);
	const selectedBox = await cell.boundingBox();
	expect(selectedBox, 'the selected cell should remain laid out').not.toBeNull();
	const selectedMenu = await openMenuAt(page, {
		x: selectedBox!.x + selectedBox!.width / 4,
		y: selectedBox!.y + selectedBox!.height / 2,
	});
	expect(selectedMenu.labels, `context menu commands after selecting the cell`).toContain(
		label.toLowerCase(),
	);
	await chooseCommand(page, label);
}

interface RawRevenueRun {
	text: string;
	rPr: string;
}

/** Read the authored rich cell on slide 4 from a saved PPTX. */
async function rawRevenueRuns(path: string): Promise<RawRevenueRun[]> {
	const zip = await JSZip.loadAsync(await readFile(path));
	const slide = zip.file('ppt/slides/slide4.xml');
	if (!slide) {
		throw new Error('saved deck is missing ppt/slides/slide4.xml');
	}
	const xml = await slide.async('string');
	const table = xml.match(/<a:tbl>.*?<\/a:tbl>/su)?.[0] ?? '';
	const row = [...table.matchAll(/<a:tr\b.*?<\/a:tr>/gsu)][1]?.[0] ?? '';
	const cell = [...row.matchAll(/<a:tc\b[^>]*>.*?<\/a:tc>/gsu)][1]?.[0] ?? '';
	return [...cell.matchAll(/<a:r>(.*?)<\/a:r>/gsu)].map((run) => ({
		text: [...run[1].matchAll(/<a:t>(.*?)<\/a:t>/gsu)].map((match) => match[1]).join(''),
		rPr: run[1].match(/<a:rPr\b.*?<\/a:rPr>|<a:rPr\b[^>]*\/>/su)?.[0] ?? '',
	}));
}

function expectAuthoredRevenueRuns(runs: RawRevenueRun[]): void {
	expect(runs.map((run) => run.text)).toStrictEqual(['Revenue ', 'grew 42%']);
	expect(runs[0]?.rPr).toMatch(/\bsz="1200"/u);
	expect(runs[0]?.rPr).toMatch(/\bb="0"/u);
	expect(runs[0]?.rPr).toMatch(/\btypeface="Arial"/u);
	expect(runs[1]?.rPr).toMatch(/\bsz="2400"/u);
	expect(runs[1]?.rPr).toMatch(/\bb="1"/u);
	expect(runs[1]?.rPr).toMatch(/\btypeface="Georgia"/u);
	expect(runs[1]?.rPr).toMatch(/\bval="C00000"/u);
}

async function expectTopRowCellCount(page: Page, count: number): Promise<void> {
	await expect
		.poll(async () => {
			const table = await measureTable(page);
			return table.cells.filter((cell) => cell.row === 0).length;
		})
		.toBe(count);
}

function expectRenderedRevenueRuns(table: TablePaint): void {
	const cell = table.cells.find((candidate) => candidate.text === 'Revenue grew 42%');
	expect(cell, 'the untouched rich-text cell should remain rendered').toBeTruthy();
	const plain = cell!.runs.find((run) => run.text === 'Revenue ');
	const emphasis = cell!.runs.find((run) => run.text === 'grew 42%');
	expect(plain, 'the regular Arial run should remain separate').toBeTruthy();
	expect(emphasis, 'the bold red Georgia run should remain separate').toBeTruthy();
	expect(Number(plain!.fontWeight) || 400).toBeLessThan(700);
	expect(plain!.fontFamily).toContain('Arial');
	expect(Number(emphasis!.fontWeight)).toBeGreaterThanOrEqual(700);
	expect(emphasis!.fontFamily).toContain('Georgia');
	expect(distance(emphasis!.color, { r: 192, g: 0, b: 0 })).toBeLessThan(30);
}

test.describe('table styling', () => {
	test.beforeEach(async ({ page }) => {
		await loadDeck(page);
	});

	test('paints the header row and banded rows from the table style', async ({ page }) => {
		await gotoSlide(page, 1);
		const table = await measureTable(page);
		expect(table.cells.length).toBeGreaterThanOrEqual(16);

		// PowerPoint paints this header #196B24: accent3, a green. Whatever our
		// exact resolution, green must dominate, and it must not be the blue
		// fallback an unresolved style used to produce.
		const header = cellAt(table, 0, 0);
		const headerColor = rgb(header.background);
		expect(headerColor.a).toBeGreaterThan(0);
		expect(headerColor.g).toBeGreaterThan(headerColor.r);
		expect(headerColor.g).toBeGreaterThan(headerColor.b);
		expect(distance(header.background, BLUE_FALLBACK)).toBeGreaterThan(40);

		// Every header cell agrees.
		expect(cellAt(table, 0, 2).background).toBe(header.background);

		// Banded rows: consecutive body rows differ, and neither is the header.
		const band1 = cellAt(table, 1, 0).background;
		const band2 = cellAt(table, 2, 0).background;
		expect(band1).not.toBe(band2);
		expect(band1).not.toBe(header.background);
	});

	test('gives the header row precedence over the first column where they cross', async ({
		page,
	}) => {
		await gotoSlide(page, 2);
		const table = await measureTable(page);

		// "Dark Style 1 - Accent 1" fills its header row dk1 (#000000) and its
		// first column with a shaded accent1. PowerPoint paints the top-left cell
		// BLACK: ECMA-376 21.1.3.14 sequences firstRow AFTER firstCol, so the row
		// part wins. Applying the parts the other way round tints it blue.
		const topLeft = cellAt(table, 0, 0);
		const topMid = cellAt(table, 0, 2);
		const colBody = cellAt(table, 1, 0);
		const body = cellAt(table, 1, 2);

		expect(topLeft.background).toBe(topMid.background);
		expect(topLeft.background).not.toBe(colBody.background);
		const header = rgb(topLeft.background);
		expect(header.r + header.g + header.b).toBeLessThan(60);

		// The first column is still painted in the body rows, distinctly from the
		// whole-table fill, so the fix did not simply drop the column part.
		expect(colBody.background).not.toBe(body.background);
	});

	test('lays a right-to-left table out with its first column on the right', async ({ page }) => {
		await gotoSlide(page, 3);
		const table = await measureTable(page);

		expect(table.direction).toBe('rtl');
		// `a:tblPr@rtl="1"` mirrors the column order: R1C1 is drawn rightmost.
		const first = cellAt(table, 0, 0);
		const last = cellAt(table, 0, 3);
		expect(first.text).toBe('R1C1');
		expect(last.text).toBe('R1C4');
		expect(first.x).toBeGreaterThan(last.x);
	});

	test('renders per-run cell formatting instead of one flat style', async ({ page }) => {
		await gotoSlide(page, 4);
		const table = await measureTable(page);

		const mixed = table.cells.find((cell) => cell.text.includes('grew 42%'));
		expect(mixed, 'the mixed-format cell should be rendered').toBeTruthy();
		// "Revenue " is 12pt Arial regular; "grew 42%" is 24pt Georgia bold
		// #C00000. The whole cell used to take the FIRST run's style.
		expect(mixed!.runs.length).toBeGreaterThanOrEqual(2);
		const bold = mixed!.runs.find((run) => run.text.includes('grew 42%'));
		const plain = mixed!.runs.find((run) => run.text.includes('Revenue'));
		expect(bold, 'the bold run should be its own span').toBeTruthy();
		expect(plain, 'the plain run should be its own span').toBeTruthy();
		expect(Number(bold!.fontWeight)).toBeGreaterThanOrEqual(700);
		expect(Number(plain!.fontWeight) || 400).toBeLessThan(700);
		expect(distance(bold!.color, { r: 192, g: 0, b: 0 })).toBeLessThan(30);
		expect(bold!.fontFamily).toContain('Georgia');
	});

	test('keeps the authored font size after editing a rich-text cell', async ({ page }) => {
		await gotoSlide(page, 4);
		const original = await measureTable(page);
		const mixed = original.cells.find((cell) => cell.text.includes('Revenue grew 42%'));
		expect(mixed, 'the mixed-format cell should be rendered').toBeTruthy();
		const firstRunSize = mixed!.runs.find((run) => run.text.includes('Revenue'))?.fontSize;
		expect(firstRunSize).toBeGreaterThan(0);
		expect(firstRunSize).toBeCloseTo(16, 2);

		const cell = canvasCell(page, 'Revenue grew 42%');
		const cellBox = await cell.boundingBox();
		expect(cellBox, 'the mixed-format cell should have a layout box').not.toBeNull();
		await page.mouse.dblclick(cellBox!.x + cellBox!.width / 2, cellBox!.y + cellBox!.height / 2);
		const input = page
			.locator('[aria-roledescription="slide"]')
			.first()
			.locator('td input')
			.first();
		await expect(input).toBeVisible();
		await input.fill('Edited cell');
		await input.press('Enter');
		await expect(canvasCell(page, 'Edited cell')).toBeVisible();

		const edited = await measureTable(page);
		const editedCell = edited.cells.find((candidate) => candidate.text === 'Edited cell');
		expect(editedCell, 'the edited cell should be rendered').toBeTruthy();
		expect(editedCell!.fontSize).toBeCloseTo(firstRunSize!, 2);
	});

	test('preserves a fractional authored font size through edit and save', async ({ page }) => {
		await loadDeck(page, await fractionalTableDeck());
		await gotoSlide(page, 4);
		const original = await measureTable(page);
		const mixed = original.cells.find((cell) => cell.text.includes('Revenue grew 42%'));
		expect(mixed, 'the mixed-format cell should be rendered').toBeTruthy();
		const authoredRun = mixed!.runs.find((run) => run.text.includes('Revenue'));
		expect(authoredRun, 'the 10.5pt run should be rendered').toBeTruthy();
		// Browsers render points at 4/3 CSS pixels: 10.5pt is exactly 14px.
		expect(authoredRun!.fontSize).toBeCloseTo(14, 2);

		const cell = canvasCell(page, 'Revenue grew 42%');
		const cellBox = await cell.boundingBox();
		expect(cellBox, 'the mixed-format cell should have a layout box').not.toBeNull();
		await page.mouse.dblclick(cellBox!.x + cellBox!.width / 2, cellBox!.y + cellBox!.height / 2);
		const input = page
			.locator('[aria-roledescription="slide"]')
			.first()
			.locator('td input')
			.first();
		await expect(input).toBeVisible();
		await input.fill('Fractional cell');
		await input.press('Enter');
		await expect(canvasCell(page, 'Fractional cell')).toBeVisible();

		const edited = await measureTable(page);
		const editedCell = edited.cells.find((candidate) => candidate.text === 'Fractional cell');
		expect(editedCell, 'the edited cell should be rendered').toBeTruthy();
		expect(editedCell!.fontSize).toBeCloseTo(14, 2);

		const download = await savePptxViaBackstage(page);
		const savedPath = await download.path();
		expect(savedPath, 'the browser should retain the downloaded PPTX').not.toBeNull();
		await loadDeck(page, savedPath!);
		await gotoSlide(page, 4);
		const reloaded = await measureTable(page);
		const reloadedCell = reloaded.cells.find((candidate) => candidate.text === 'Fractional cell');
		expect(reloadedCell, 'the saved edit should survive reloading').toBeTruthy();
		expect(reloadedCell!.fontSize).toBeCloseTo(14, 2);
	});

	test('renders attributed table text and preserves it through save', async ({ page }) => {
		await loadDeck(page, await attributedTableTextDeck());
		await gotoSlide(page, 4);
		let cell = canvasCell(page, 'Revenue grew 42%');
		await expect(cell).toBeVisible();
		expect(await cell.locator('span').allTextContents()).toEqual(['Revenue ', 'grew 42%']);

		const cellBox = await cell.boundingBox();
		expect(cellBox, 'the attributed table cell should have a layout box').not.toBeNull();
		await page.mouse.dblclick(cellBox!.x + cellBox!.width / 2, cellBox!.y + cellBox!.height / 2);
		const input = page
			.locator('[aria-roledescription="slide"]')
			.first()
			.locator('td input')
			.first();
		await expect(input).toHaveValue('Revenue grew 42%');
		await input.press('Escape');

		const noOpDownload = await savePptxViaBackstage(page);
		const noOpPath = await noOpDownload.path();
		expect(noOpPath, 'the browser should retain the downloaded PPTX').not.toBeNull();
		const noOpZip = await JSZip.loadAsync(await readFile(noOpPath!));
		const noOpXml = await noOpZip.file('ppt/slides/slide4.xml')?.async('string');
		expect(noOpXml).toContain('<a:t xml:space="preserve">Revenue </a:t>');

		await loadDeck(page, noOpPath!);
		await gotoSlide(page, 4);
		cell = canvasCell(page, 'Revenue grew 42%');
		await expect(cell).toBeVisible();
		expect(await cell.locator('span').allTextContents()).toEqual(['Revenue ', 'grew 42%']);

		const reloadedBox = await cell.boundingBox();
		expect(reloadedBox, 'the reloaded table cell should have a layout box').not.toBeNull();
		await page.mouse.dblclick(
			reloadedBox!.x + reloadedBox!.width / 2,
			reloadedBox!.y + reloadedBox!.height / 2,
		);
		const reloadedInput = page
			.locator('[aria-roledescription="slide"]')
			.first()
			.locator('td input')
			.first();
		await expect(reloadedInput).toHaveValue('Revenue grew 42%');
		await reloadedInput.fill('Edited attributed cell');
		await reloadedInput.press('Enter');
		await expect(canvasCell(page, 'Edited attributed cell')).toBeVisible();
		const undo = page.getByRole('button', { name: 'Undo' });
		const redo = page.getByRole('button', { name: 'Redo' });
		await expect(undo).toBeEnabled();
		await undo.click();
		await expect(canvasCell(page, 'Revenue grew 42%')).toBeVisible();
		await expect(redo).toBeEnabled();
		await redo.click();
		await expect(canvasCell(page, 'Edited attributed cell')).toBeVisible();

		const editDownload = await savePptxViaBackstage(page);
		const editPath = await editDownload.path();
		expect(editPath, 'the browser should retain the edited PPTX').not.toBeNull();
		await loadDeck(page, editPath!);
		await gotoSlide(page, 4);
		await expect(canvasCell(page, 'Edited attributed cell')).toBeVisible();
	});

	test('keeps rich cell runs aligned after inserting a middle row', async ({ page }) => {
		await gotoSlide(page, 4);
		await chooseTableCommand(page, canvasCell(page, 'R1C1'), 'Insert Row Below');

		const live = await measureTable(page);
		const liveMixed = cellAt(live, 2, 1);
		expect(liveMixed.text).toBe('Revenue grew 42%');
		expect(liveMixed.runs.map((run) => run.text)).toEqual(['Revenue ', 'grew 42%']);

		const rows = await savedSlideFourTable(page);
		expect(rows).toHaveLength(5);
		expect(rows[1]?.map((cell) => cell.text)).toEqual(['', '', '', '']);
		expectMixedRevenueRuns(rows[2]![1]!);
	});

	test('keeps rich cell runs aligned after deleting the first column', async ({ page }) => {
		await gotoSlide(page, 4);
		await chooseTableCommand(page, canvasCell(page, 'R1C1'), 'Delete Column');

		const live = await measureTable(page);
		const liveMixed = cellAt(live, 1, 0);
		expect(liveMixed.text).toBe('Revenue grew 42%');
		expect(liveMixed.runs.map((run) => run.text)).toEqual(['Revenue ', 'grew 42%']);

		const rows = await savedSlideFourTable(page);
		expect(rows).toHaveLength(4);
		expect(rows.every((row) => row.length === 3)).toBe(true);
		expectMixedRevenueRuns(rows[1]![0]!);
	});

	test('resolves a built-in style GUID the deck does not define', async ({ page }) => {
		await gotoSlide(page, 5);
		const table = await measureTable(page);

		// The style is "Medium Style 2 - Accent 6" and its <a:tblStyle> was
		// removed from ppt/tableStyles.xml, exactly as a non-PowerPoint producer
		// would leave it. PowerPoint paints this header #4EA72E (accent6 green);
		// without a built-in catalogue it fell through to the accent1 blue.
		const header = cellAt(table, 0, 0);
		const color = rgb(header.background);
		expect(color.a).toBeGreaterThan(0);
		expect(color.g).toBeGreaterThan(color.r);
		expect(color.g).toBeGreaterThan(color.b);
		expect(distance(header.background, BLUE_FALLBACK)).toBeGreaterThan(40);

		// The style also gives the table lt1 gridlines; they must reach the cell.
		expect(header.borderTopWidth).toBeGreaterThan(0);
		expect(header.borderTop).not.toBe('none');
	});

	/**
	 * A table INSERTED from the ribbon carries `firstRowHeader` + `bandedRows` and
	 * no style GUID, so its banding can only come from the shared band cascade.
	 * That is the one path React never ran: `table-render-data.tsx` (the
	 * structured-model renderer, which every programmatic table goes through)
	 * imported `TableStyleContext` as a TYPE and called `getTableCellBandStyle`
	 * nowhere, so React alone painted these tables flat. The loaded-deck tests
	 * above cannot see it, because a deck's tables carry rawXml and React renders
	 * those through its other, banded, path.
	 */
	test('bands a table inserted from the ribbon', async ({ page }) => {
		await gotoSlide(page, 4);
		await insertTable(page);
		const table = await measureTable(page, 'Header 1'),
			band1 = cellAt(table, 1, 0),
			band2 = cellAt(table, 2, 0),
			header = cellAt(table, 0, 0);
		expect(table.cells.length).toBeGreaterThanOrEqual(9);
		// Only the band cascade distinguishes consecutive body rows here: the
		// inserted cells carry an explicit fill on the HEADER row and none at all
		// on the body rows.
		expect(band1.background).not.toBe(band2.background);
		expect(band1.background).not.toBe(header.background);
	});

	/**
	 * ... and its body text has to be legible.
	 *
	 * These cells author no colour and no band supplies one, so without a floor
	 * the `<td>` inherits whatever the viewer CHROME cascades. Angular was the one
	 * binding with no floor and painted `rgb(240, 239, 236)` - literally the dark
	 * theme preset's `foreground` token - on a light cell.
	 */
	test('paints inserted body cells in dark text, not the chrome foreground', async ({ page }) => {
		await gotoSlide(page, 4);
		await insertTable(page);
		const table = await measureTable(page, 'Header 1'),
			body = cellAt(table, 1, 0),
			text = rgb(body.color);
		expect(
			text.r + text.g + text.b,
			`an unstyled body cell painted ${body.color}, which is the host chrome's colour, not the deck's`,
		).toBeLessThan(240);
	});

	test('preserves an untouched rich cell through merge and split saves', async ({ page }) => {
		await gotoSlide(page, 4);
		expectRenderedRevenueRuns(await measureTable(page));

		await chooseTableCommand(page, canvasCellAt(page, 0, 0), 'Merge Right');
		await expectTopRowCellCount(page, 3);
		expectRenderedRevenueRuns(await measureTable(page));

		const undo = page.getByRole('button', { name: 'Undo', exact: true });
		const redo = page.getByRole('button', { name: 'Redo', exact: true });
		await expect(undo).toBeEnabled();
		await undo.click();
		await expectTopRowCellCount(page, 4);
		expectRenderedRevenueRuns(await measureTable(page));
		await expect(redo).toBeEnabled();
		await redo.click();
		await expectTopRowCellCount(page, 3);
		expectRenderedRevenueRuns(await measureTable(page));

		const mergedDownload = await savePptxViaBackstage(page);
		const mergedPath = await mergedDownload.path();
		expect(mergedPath, 'the browser should retain the merged PPTX').not.toBeNull();
		expectAuthoredRevenueRuns(await rawRevenueRuns(mergedPath!));
		await loadDeck(page, mergedPath!);
		await gotoSlide(page, 4);
		expectRenderedRevenueRuns(await measureTable(page));

		await chooseTableCommand(page, canvasCellAt(page, 0, 0), 'Split Cell');
		await expectTopRowCellCount(page, 4);
		expectRenderedRevenueRuns(await measureTable(page));

		await expect(undo).toBeEnabled();
		await undo.click();
		await expectTopRowCellCount(page, 3);
		expectRenderedRevenueRuns(await measureTable(page));
		await expect(redo).toBeEnabled();
		await redo.click();
		await expectTopRowCellCount(page, 4);
		expectRenderedRevenueRuns(await measureTable(page));

		const splitDownload = await savePptxViaBackstage(page);
		const splitPath = await splitDownload.path();
		expect(splitPath, 'the browser should retain the split PPTX').not.toBeNull();
		expectAuthoredRevenueRuns(await rawRevenueRuns(splitPath!));
		await loadDeck(page, splitPath!);
		await gotoSlide(page, 4);
		expectRenderedRevenueRuns(await measureTable(page));
	});

	test('preserves a rich anchor when merging its empty right neighbour', async ({ page }) => {
		await loadDeck(page, await richAnchorWithEmptyRightDeck());
		await gotoSlide(page, 4);
		expectRenderedRevenueRuns(await measureTable(page));
		await expect(canvasCellAt(page, 1, 2)).toHaveText('');

		await chooseTableCommand(page, canvasCellAt(page, 1, 1), 'Merge Right');
		await expect
			.poll(async () => {
				const table = await measureTable(page);
				return table.cells.filter((cell) => cell.row === 1).length;
			})
			.toBe(3);
		expectRenderedRevenueRuns(await measureTable(page));

		const download = await savePptxViaBackstage(page);
		const savedPath = await download.path();
		expect(savedPath, 'the browser should retain the merged PPTX').not.toBeNull();
		expectAuthoredRevenueRuns(await rawRevenueRuns(savedPath!));
		await loadDeck(page, savedPath!);
		await gotoSlide(page, 4);
		expectRenderedRevenueRuns(await measureTable(page));
	});

	/**
	 * Shift-click has to build a real cell RANGE, or block merge is unreachable.
	 *
	 * Vue's `computeCellSelection` was correct all along; the break was upstream
	 * in the gesture. The press bubbled to the canvas, whose additive branch
	 * toggled the table OUT of the element selection, and the selection watcher
	 * then nulled the cell selection - so by the time the click handler ran there
	 * was no anchor and only the clicked cell was selected. The visible symptom is
	 * exactly what this asserts: the context menu offering the two pairwise merges
	 * instead of "Merge Selected Cells".
	 */
	test('builds a cell range from a shift-click and offers Merge Selected Cells', async ({
		page,
	}) => {
		await gotoSlide(page, 4);
		const anchor = canvasCell(page, 'R2C1'),
			far = canvasCell(page, 'R3C2');
		await anchor.waitFor();

		// Two presses: the first selects the table element, the second the cell.
		// The centre is re-measured between them because selecting opens the
		// inspector, which narrows the canvas and moves the cell.
		for (let press = 0; press < 2; press += 1) {
			const point = await centreOf(anchor);
			await page.mouse.click(point.x, point.y);
			await page.waitForTimeout(350);
		}

		await far.click({ modifiers: ['Shift'] });
		await page.waitForTimeout(400);

		expect(await menuLabelsOn(page, far)).toContain('merge selected cells');
	});

	test('keeps Split Cell available when one merged cell is selected', async ({ page }) => {
		const deck = await verticallyMergedTableDeck();
		await loadDeck(page, deck);
		await gotoSlide(page, 4);
		const anchor = canvasCell(page, 'R1C1');

		// Selecting the same visible cell, including a Shift-click on it, must not
		// turn its hidden merge continuation into a second user-selected cell.
		await selectTableCell(page, anchor);
		await anchor.click({ modifiers: ['Shift'] });
		const selectedMenu = await openMenuOn(page, anchor);
		expect(selectedMenu.labels).toContain('split cell');
		expect(selectedMenu.labels).not.toContain('merge selected cells');

		await chooseCommand(page, 'Split Cell');
		await expect(anchor).not.toHaveAttribute('rowspan', '2');
		await expect(canvasCell(page, 'R2C1')).toHaveCount(1);

		const undo = page.getByRole('button', { name: /^undo/iu }).first();
		const redo = page.getByRole('button', { name: /^redo/iu }).first();
		await expect(undo).toBeEnabled();
		await undo.click();
		await expect(canvasCell(page, 'R1C1')).toHaveAttribute('rowspan', '2');
		await expect(canvasCell(page, 'R2C1')).toHaveCount(0);
		await expect(redo).toBeEnabled();
		await redo.click();
		await expect(canvasCell(page, 'R1C1')).not.toHaveAttribute('rowspan', '2');
		await expect(canvasCell(page, 'R2C1')).toHaveCount(1);

		const download = await savePptxViaBackstage(page);
		const savedPath = await download.path();
		expect(savedPath, 'the browser should retain the downloaded PPTX').not.toBeNull();
		await loadDeck(page, savedPath!);
		await gotoSlide(page, 4);
		await expect(canvasCell(page, 'R1C1')).not.toHaveAttribute('rowspan', '2');
		await expect(canvasCell(page, 'R2C1')).toHaveCount(1);
	});

	test('still treats a merged cell plus a visible neighbour as a block', async ({ page }) => {
		await loadDeck(page, await verticallyMergedTableDeck());
		await gotoSlide(page, 4);
		const anchor = canvasCell(page, 'R1C1');
		const neighbour = canvasCell(page, 'R1C2');
		await selectTableCell(page, anchor);
		await neighbour.click({ modifiers: ['Shift'] });
		const menu = await openMenuOn(page, neighbour);
		expect(menu.labels).toContain('merge selected cells');
		expect(menu.labels).not.toContain('split cell');
	});
});
