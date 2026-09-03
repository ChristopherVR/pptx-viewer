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
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { centreOf, openMenuOn } from './support/context-menu';
import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/table-styling.pptx', import.meta.url)),
);

const LOAD_TIMEOUT_MS = 60_000;

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

async function loadDeck(page: Page): Promise<void> {
	await page.setViewportSize({ width: 1600, height: 1000 });
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[aria-label="Go to slide 5"]').first().waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
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
});
