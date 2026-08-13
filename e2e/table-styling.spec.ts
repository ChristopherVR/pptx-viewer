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
import type { Page } from '@playwright/test';

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
	borderTop: string;
	borderTopWidth: number;
	/** Per-run spans inside the cell: their text, weight, colour and family. */
	runs: Array<{ text: string; fontWeight: string; color: string; fontFamily: string }>;
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
async function measureTable(page: Page): Promise<TablePaint> {
	return page.evaluate(() => {
		const tables = Array.from(document.querySelectorAll('table'));
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
					};
				});
				cells.push({
					text: (td.textContent ?? '').trim(),
					row: rowIndex,
					col: colIndex,
					x: rect.x,
					width: rect.width,
					background: style.backgroundColor,
					borderTop: style.borderTopStyle,
					borderTopWidth: Number.parseFloat(style.borderTopWidth) || 0,
					runs,
				});
			});
		});
		return { direction: getComputedStyle(best).direction, cells };
	});
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
});
