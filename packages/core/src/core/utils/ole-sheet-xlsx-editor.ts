/**
 * In-place cell editing for an embedded Excel workbook (`Excel.Sheet.12` /
 * `.xlsx` OLE payload).
 *
 * Reuses the same SpreadsheetML primitives the chart embedded-workbook
 * write-back path already relies on (`chart-xlsx-sheet-cells.ts`,
 * `chart-xlsx-cellref.ts`): only the specific `<c>` element a write targets
 * is touched, so an untouched cell's styles, formulas, and formatting
 * survive the round-trip byte-for-byte.
 *
 * @module ole-sheet-xlsx-editor
 */
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

import type { XmlObject } from '../types';
import { formatCellAddress, parseCellAddress } from './chart-xlsx-cellref';
import { applyCellWritesToWorksheet } from './chart-xlsx-sheet-cells';
import { xmlAttr, xmlChild, xmlChildren, xmlText } from './xml-access';
import { preservesSpreadsheetXmlWhitespace } from './xml-whitespace';

const FIRST_SHEET_PATH = 'xl/worksheets/sheet1.xml';
const DEFAULT_MAX_ROWS = 50;
const DEFAULT_MAX_COLS = 26;

/** One cell in a preview/edit grid. */
export interface OleSheetCell {
	/** Display text (already resolved from any shared-string reference). */
	value: string;
	isNumeric: boolean;
}

/** One row of an {@link OleSheetGrid}. */
export interface OleSheetRow {
	cells: OleSheetCell[];
}

/** A read-only snapshot of an embedded workbook's first sheet for editing UI. */
export interface OleSheetGrid {
	sheetName: string;
	rows: OleSheetRow[];
}

function createSpreadsheetXmlParser(): XMLParser {
	return new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: '@_',
		trimValues: false,
		// `xmlAttr`/`xmlText` (`xml-access.ts`) assume every leaf is a string
		// (matching the main PPTX parser's config); without this a bare
		// numeric cell value like `<v>42</v>` parses to the NUMBER 42, which
		// neither helper's type guard accepts.
		parseTagValue: false,
		parseAttributeValue: false,
		tagValueProcessor: (tagName: string, tagValue: string) =>
			preservesSpreadsheetXmlWhitespace(tagName) ? tagValue : tagValue.trim(),
	});
}

function createSpreadsheetXmlBuilder(): XMLBuilder {
	return new XMLBuilder({
		ignoreAttributes: false,
		attributeNamePrefix: '@_',
		suppressBooleanAttributes: false,
		format: false,
	});
}

function parseSharedStrings(tree: XmlObject | undefined): string[] {
	if (!tree) {
		return [];
	}
	const sst = xmlChild(tree, 'sst');
	if (!sst) {
		return [];
	}
	return xmlChildren(sst, 'si').map((si) => {
		const direct = xmlText(xmlChild(si, 't') ?? si['t']);
		if (direct !== undefined) {
			return direct;
		}
		const runs = xmlChildren(si, 'r');
		if (runs.length > 0) {
			return runs.map((run) => xmlText(xmlChild(run, 't') ?? run['t']) ?? '').join('');
		}
		return '';
	});
}

function cellDisplayValue(cell: XmlObject, sharedStrings: string[]): OleSheetCell {
	const type = xmlAttr(cell, 't') ?? 'n';
	if (type === 's') {
		const idx = Number.parseInt(xmlText(cell['v']) ?? '', 10);
		const text = Number.isFinite(idx) ? (sharedStrings[idx] ?? '') : '';
		return { value: text, isNumeric: false };
	}
	if (type === 'inlineStr') {
		const inline = xmlChild(cell, 'is');
		return { value: xmlText(xmlChild(inline, 't')) ?? '', isNumeric: false };
	}
	if (type === 'str' || type === 'b') {
		return { value: xmlText(cell['v']) ?? '', isNumeric: false };
	}
	return { value: xmlText(cell['v']) ?? '', isNumeric: true };
}

/**
 * Read the first worksheet of an embedded `.xlsx` payload as a bounded grid
 * suitable for a spreadsheet-style edit dialog.
 *
 * Returns `undefined` when the payload is not a readable xlsx workbook.
 */
export async function readOleSheetGrid(
	xlsxBytes: Uint8Array,
	maxRows = DEFAULT_MAX_ROWS,
	maxCols = DEFAULT_MAX_COLS,
): Promise<OleSheetGrid | undefined> {
	try {
		const zip = await JSZip.loadAsync(xlsxBytes);
		const sheetFile = zip.file(FIRST_SHEET_PATH);
		if (!sheetFile) {
			return undefined;
		}
		const parser = createSpreadsheetXmlParser();

		let sharedStrings: string[] = [];
		const sharedStringsFile = zip.file('xl/sharedStrings.xml');
		if (sharedStringsFile) {
			sharedStrings = parseSharedStrings(
				parser.parse(await sharedStringsFile.async('string')) as XmlObject,
			);
		}

		const sheetTree = parser.parse(await sheetFile.async('string')) as XmlObject;
		const worksheet = xmlChild(sheetTree, 'worksheet');
		const sheetData = worksheet ? xmlChild(worksheet, 'sheetData') : undefined;
		if (!sheetData) {
			return { sheetName: 'Sheet1', rows: [] };
		}

		const rows: OleSheetRow[] = Array.from({ length: maxRows }, () => ({
			cells: Array.from({ length: maxCols }, () => ({ value: '', isNumeric: false })),
		}));
		for (const rowNode of xmlChildren(sheetData, 'row')) {
			for (const cellNode of xmlChildren(rowNode, 'c')) {
				const address = parseCellAddress(xmlAttr(cellNode, 'r') ?? '');
				if (!address || address.row >= maxRows || address.col >= maxCols) {
					continue;
				}
				rows[address.row]!.cells[address.col] = cellDisplayValue(cellNode, sharedStrings);
			}
		}
		// Trim fully-blank trailing rows so a tiny sheet does not render maxRows
		// of empty grid.
		let lastNonEmpty = -1;
		for (let r = 0; r < rows.length; r++) {
			if (rows[r]!.cells.some((c) => c.value !== '')) {
				lastNonEmpty = r;
			}
		}
		return { sheetName: 'Sheet1', rows: rows.slice(0, Math.max(1, lastNonEmpty + 1)) };
	} catch {
		return undefined;
	}
}

/** Mark the workbook to fully recalculate the next time Excel opens it. */
function markFullCalcOnLoad(workbookXml: string, parser: XMLParser, builder: XMLBuilder): string {
	try {
		const tree = parser.parse(workbookXml) as XmlObject;
		const workbook = xmlChild(tree, 'workbook');
		if (!workbook) {
			return workbookXml;
		}
		const calcPr = xmlChild(workbook, 'calcPr') ?? {};
		calcPr['@_fullCalcOnLoad'] = '1';
		workbook['calcPr'] = calcPr;
		return builder.build(tree) as string;
	} catch {
		return workbookXml;
	}
}

/**
 * Apply a single cell edit to the first worksheet of an embedded `.xlsx`
 * payload and return the updated workbook bytes.
 *
 * `value` is written as a numeric cell when it parses as a finite number and
 * the caller has not forced text; otherwise as a self-contained
 * `inlineStr` cell (never touching the shared-string table, so other cells
 * that reference the same shared string are unaffected). Returns the
 * original bytes unchanged if the edit could not be applied (corrupt
 * payload, missing worksheet).
 */
export async function writeOleSheetCellEdit(
	xlsxBytes: Uint8Array,
	edit: { row: number; col: number; value: string; forceText?: boolean },
): Promise<Uint8Array> {
	try {
		const zip = await JSZip.loadAsync(xlsxBytes);
		const sheetFile = zip.file(FIRST_SHEET_PATH);
		if (!sheetFile) {
			return xlsxBytes;
		}
		const parser = createSpreadsheetXmlParser();
		const builder = createSpreadsheetXmlBuilder();
		const sheetTree = parser.parse(await sheetFile.async('string')) as XmlObject;

		const ref = formatCellAddress({ col: edit.col, row: edit.row });
		const numeric =
			!edit.forceText && edit.value.trim().length > 0 && Number.isFinite(Number(edit.value));
		const changed = applyCellWritesToWorksheet(sheetTree, [
			{ ref, isNumeric: numeric, value: edit.value },
		]);
		if (!changed) {
			return xlsxBytes;
		}
		zip.file(FIRST_SHEET_PATH, builder.build(sheetTree) as string);

		const workbookFile = zip.file('xl/workbook.xml');
		if (workbookFile) {
			const updatedWorkbookXml = markFullCalcOnLoad(
				await workbookFile.async('string'),
				parser,
				builder,
			);
			zip.file('xl/workbook.xml', updatedWorkbookXml);
		}

		return await zip.generateAsync({
			type: 'uint8array',
			compression: 'DEFLATE',
			compressionOptions: { level: 6 },
		});
	} catch {
		return xlsxBytes;
	}
}
