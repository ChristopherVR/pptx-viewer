/**
 * Cell-reference and range parsing for SpreadsheetML (`.xlsx`) formula
 * strings, e.g. the `c:f` cached-formula text on a chart series
 * (`"Sheet1!$B$2:$B$4"`). Used by the embedded-workbook write-back path
 * (see `chart-xlsx-writer.ts`) to translate a chart's data reference into
 * the exact worksheet cells it names, rather than guessing at a grid
 * layout.
 *
 * @module chart-xlsx-cellref
 */

/** Convert an Excel-style column reference ("A", "B", "AA") to a 0-based index. */
export function columnLetterToIndex(letters: string): number {
	let index = 0;
	for (let i = 0; i < letters.length; i++) {
		index = index * 26 + (letters.charCodeAt(i) - 64);
	}
	return index - 1;
}

/** Convert a 0-based column index back to an Excel-style column reference. */
export function columnIndexToLetter(index: number): string {
	let remaining = index + 1;
	let letters = '';
	while (remaining > 0) {
		const remainder = (remaining - 1) % 26;
		letters = String.fromCharCode(65 + remainder) + letters;
		remaining = Math.floor((remaining - 1) / 26);
	}
	return letters;
}

/** A parsed cell address: 0-based column and row indices. */
export interface CellAddress {
	col: number;
	row: number;
}

/** Build the "A1"-style reference string for a 0-based cell address. */
export function formatCellAddress(address: CellAddress): string {
	return `${columnIndexToLetter(address.col)}${address.row + 1}`;
}

/** Parse a plain cell reference like "A1", "$A$1" or "AA10" (no sheet name). */
export function parseCellAddress(ref: string): CellAddress | undefined {
	const match = /^\$?([A-Z]+)\$?(\d+)$/u.exec(ref.trim());
	if (!match) {
		return undefined;
	}
	return { col: columnLetterToIndex(match[1]), row: Number.parseInt(match[2], 10) - 1 };
}

/** A parsed `c:f` chart formula range: sheet name plus start/end cell addresses. */
export interface ChartFormulaRange {
	sheetName: string;
	start: CellAddress;
	end: CellAddress;
}

/**
 * Parse a `c:f` formula string (e.g. `Sheet1!$B$2:$B$4` or `'My Data'!$C$1`)
 * into its sheet name and cell range.
 *
 * Returns `undefined` for anything that is not a plain `Sheet!Range`
 * reference (a defined name, a cross-workbook reference, a 3-D reference
 * spanning sheets), which is out of scope for write-back: the chart's
 * cached values remain the source of truth for those cases.
 */
export function parseChartFormulaRange(formula: string): ChartFormulaRange | undefined {
	const trimmed = formula.trim();
	const bangIndex = trimmed.lastIndexOf('!');
	if (bangIndex < 0) {
		return undefined;
	}
	let sheetName = trimmed.slice(0, bangIndex).trim();
	if (sheetName.startsWith("'") && sheetName.endsWith("'") && sheetName.length >= 2) {
		sheetName = sheetName.slice(1, -1).replace(/''/gu, "'");
	}
	if (sheetName.length === 0) {
		return undefined;
	}

	const rangePart = trimmed.slice(bangIndex + 1).trim();
	const [startRef, endRef] = rangePart.split(':');
	const start = startRef ? parseCellAddress(startRef) : undefined;
	if (!start) {
		return undefined;
	}
	const end = endRef ? parseCellAddress(endRef) : start;
	if (!end) {
		return undefined;
	}
	return { sheetName, start, end };
}

/**
 * Expand a chart formula range into the ordered list of cell references it
 * names, matching `count` values one-for-one against the range PowerPoint
 * itself recorded.
 *
 * Only a single straight vector (one row, or one column) is supported,
 * matching how classic chart series-name/category/value references are
 * always authored. A 2-D block, or a length mismatch against the edited
 * data (a structural add/remove of points), returns `undefined` so the
 * caller can leave the workbook untouched for that reference rather than
 * write into the wrong cells.
 */
export function expandRangeAddresses(
	range: ChartFormulaRange,
	count: number,
): string[] | undefined {
	const { start, end } = range;
	if (count <= 0) {
		return undefined;
	}
	if (start.col === end.col && start.row === end.row) {
		return count === 1 ? [formatCellAddress(start)] : undefined;
	}
	if (start.col === end.col) {
		const length = end.row - start.row + 1;
		return length === count
			? Array.from({ length }, (_, i) => formatCellAddress({ col: start.col, row: start.row + i }))
			: undefined;
	}
	if (start.row === end.row) {
		const length = end.col - start.col + 1;
		return length === count
			? Array.from({ length }, (_, i) => formatCellAddress({ col: start.col + i, row: start.row }))
			: undefined;
	}
	return undefined;
}
