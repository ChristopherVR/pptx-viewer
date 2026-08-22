/**
 * Cell-level read/write helpers for a parsed SpreadsheetML worksheet part
 * (`xl/worksheets/sheetN.xml`), used by the embedded-workbook write-back
 * path (see `chart-xlsx-writer.ts`).
 *
 * Every mutation here touches only the specific `<c>` elements a write
 * targets. Everything else on the worksheet (styles, formatting, other
 * cells, other rows) is left exactly as parsed, so an untouched chart's
 * embedded workbook re-serializes byte-for-byte unchanged.
 *
 * @module chart-xlsx-sheet-cells
 */

import type { XmlObject } from '../types';
import { parseCellAddress } from './chart-xlsx-cellref';
import { xmlChild, xmlChildren, xmlText } from './xml-access';

/** One resolved cell write: a concrete "A1"-style ref plus its new value. */
export interface ChartCellWrite {
	ref: string;
	isNumeric: boolean;
	value: string;
}

function toArray(value: XmlObject | XmlObject[] | string | undefined): XmlObject[] {
	if (Array.isArray(value)) {
		return value;
	}
	return value !== undefined && typeof value === 'object' ? [value] : [];
}

function findCellInRow(row: XmlObject, ref: string): XmlObject | undefined {
	return xmlChildren(row, 'c').find((cell) => String(cell['@_r'] ?? '') === ref);
}

/** Read-only lookup: find an existing cell by its "A1"-style reference. */
function findExistingCell(sheetData: XmlObject, ref: string): XmlObject | undefined {
	for (const row of xmlChildren(sheetData, 'row')) {
		const cell = findCellInRow(row, ref);
		if (cell) {
			return cell;
		}
	}
	return undefined;
}

/**
 * Get (creating if necessary) the row and cell for `ref`, inserting each in
 * column/row order so the worksheet stays well-formed. Only called once a
 * caller has already established the write is not a no-op.
 */
function ensureCell(sheetData: XmlObject, ref: string): XmlObject | undefined {
	const address = parseCellAddress(ref);
	if (!address) {
		return undefined;
	}
	const rowNumber = address.row + 1;
	const rows = toArray(sheetData['row']);
	let row = rows.find((r) => Number(r['@_r']) === rowNumber);
	if (!row) {
		row = { '@_r': String(rowNumber), c: [] };
		const insertAt = rows.findIndex((r) => Number(r['@_r']) > rowNumber);
		if (insertAt < 0) {
			rows.push(row);
		} else {
			rows.splice(insertAt, 0, row);
		}
		sheetData['row'] = rows;
	}

	const cells = toArray(row['c']);
	let cell = cells.find((c) => String(c['@_r'] ?? '') === ref);
	if (!cell) {
		cell = { '@_r': ref };
		const insertAt = cells.findIndex((c) => {
			const existingAddress = parseCellAddress(String(c['@_r'] ?? ''));
			return existingAddress !== undefined && existingAddress.col > address.col;
		});
		if (insertAt < 0) {
			cells.push(cell);
		} else {
			cells.splice(insertAt, 0, cell);
		}
		row['c'] = cells;
	}
	return cell;
}

/** Read a numeric cell's cached raw text (the `<v>` child), if any. */
function readNumericValue(cell: XmlObject): string | undefined {
	return xmlText(cell['v']);
}

/** Read an `inlineStr` cell's text (`<is><t>…</t></is>`), if any. */
function readInlineStringValue(cell: XmlObject): string | undefined {
	const inlineString = xmlChild(cell, 'is');
	return inlineString ? xmlText(xmlChild(inlineString, 't')) : undefined;
}

/**
 * Whether `cell` already holds `value` in the representation a write would
 * produce, so the caller can leave it untouched rather than reformat an
 * unchanged cell (which would needlessly perturb the re-serialized bytes).
 */
function cellAlreadyHasValue(cell: XmlObject, isNumeric: boolean, value: string): boolean {
	const currentType = String(cell['@_t'] ?? 'n');
	if (isNumeric) {
		if (currentType !== 'n') {
			return false;
		}
		const current = readNumericValue(cell);
		if (current === undefined) {
			return false;
		}
		const currentNumber = Number.parseFloat(current);
		const nextNumber = Number.parseFloat(value);
		return Number.isFinite(currentNumber) && Number.isFinite(nextNumber)
			? currentNumber === nextNumber
			: current === value;
	}
	return currentType === 'inlineStr' && readInlineStringValue(cell) === value;
}

/** Overwrite a cell's type/value to hold `value`, dropping any prior shape. */
function writeCellValue(cell: XmlObject, isNumeric: boolean, value: string): void {
	delete cell['is'];
	delete cell['v'];
	if (isNumeric) {
		delete cell['@_t'];
		cell['v'] = value;
		return;
	}
	// `inlineStr` keeps the write self-contained: it never touches the shared
	// string table, so other cells referencing the same shared string index
	// are unaffected. `xml:space="preserve"` is always added so boundary
	// whitespace in an edited label survives, matching how a hand-authored
	// SpreadsheetML string with such whitespace is written.
	cell['@_t'] = 'inlineStr';
	cell['is'] = { t: { '@_xml:space': 'preserve', '#text': value } };
}

/**
 * Apply a batch of cell writes to a parsed worksheet tree. Returns whether
 * any cell actually changed, so the caller only re-serializes and stores a
 * worksheet part that genuinely differs from what was loaded.
 */
export function applyCellWritesToWorksheet(
	sheetTree: XmlObject,
	writes: readonly ChartCellWrite[],
): boolean {
	const worksheet = xmlChild(sheetTree, 'worksheet');
	const sheetData = worksheet ? xmlChild(worksheet, 'sheetData') : undefined;
	if (!sheetData) {
		return false;
	}

	let changed = false;
	for (const write of writes) {
		if (!parseCellAddress(write.ref)) {
			continue;
		}
		const existing = findExistingCell(sheetData, write.ref);
		if (existing && cellAlreadyHasValue(existing, write.isNumeric, write.value)) {
			continue;
		}
		const cell = existing ?? ensureCell(sheetData, write.ref);
		if (!cell) {
			continue;
		}
		writeCellValue(cell, write.isNumeric, write.value);
		changed = true;
	}
	return changed;
}
