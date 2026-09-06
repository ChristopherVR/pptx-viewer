import { describe, expect, it } from 'vitest';

import { findAllWorksheetRanges, readOleXlsGrid, readRecords } from './ole-sheet-xls-biff8';
import { writeOleXlsStringCellEdit } from './ole-sheet-xls-biff8-writer';

const OPCODE_BOUNDSHEET = 0x0085;

/** Minimal BIFF8 record: [opcode:u16le][length:u16le][data]. */
function record(opcode: number, data: number[]): number[] {
	return [
		opcode & 0xff,
		(opcode >> 8) & 0xff,
		data.length & 0xff,
		(data.length >> 8) & 0xff,
		...data,
	];
}

function bof(dt: number): number[] {
	return record(0x0809, [
		0x00,
		0x06,
		dt & 0xff,
		(dt >> 8) & 0xff,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
	]);
}

const EOF_RECORD = record(0x000a, []);

function sstRecord(strings: string[]): number[] {
	const data: number[] = [];
	const count = strings.length;
	data.push(count & 0xff, (count >> 8) & 0xff, 0, 0, count & 0xff, (count >> 8) & 0xff, 0, 0);
	for (const s of strings) {
		data.push(s.length & 0xff, (s.length >> 8) & 0xff, 0x00);
		for (const ch of s) {
			data.push(ch.charCodeAt(0) & 0xff);
		}
	}
	return record(0x00fc, data);
}

function numberRecord(row: number, col: number, value: number): number[] {
	const buffer = new ArrayBuffer(8);
	new DataView(buffer).setFloat64(0, value, true);
	return record(0x0203, [
		row & 0xff,
		row >> 8,
		col & 0xff,
		col >> 8,
		0,
		0,
		...Array.from(new Uint8Array(buffer)),
	]);
}

function rkIntRecord(row: number, col: number, intValue: number): number[] {
	const rk = ((intValue << 2) | 0x2) >>> 0;
	return record(0x027e, [
		row & 0xff,
		row >> 8,
		col & 0xff,
		col >> 8,
		0,
		0,
		rk & 0xff,
		(rk >> 8) & 0xff,
		(rk >> 16) & 0xff,
		(rk >> 24) & 0xff,
	]);
}

/** A BIFF8 `RK` record using the div-by-100 encoding real Excel uses for an exact-looking decimal (e.g. `3.14`). */
function rkDiv100Record(row: number, col: number, hundredths: number): number[] {
	const rk = ((hundredths << 2) | 0x3) >>> 0; // bit0 = isDiv100, bit1 = isInt
	return record(0x027e, [
		row & 0xff,
		row >> 8,
		col & 0xff,
		col >> 8,
		0,
		0,
		rk & 0xff,
		(rk >> 8) & 0xff,
		(rk >> 16) & 0xff,
		(rk >> 24) & 0xff,
	]);
}

function labelSstRecord(row: number, col: number, sstIndex: number): number[] {
	return record(0x00fd, [
		row & 0xff,
		row >> 8,
		col & 0xff,
		col >> 8,
		0,
		0,
		sstIndex & 0xff,
		sstIndex >> 8,
		0,
		0,
	]);
}

function rowRecord(row: number, colFirst: number, colLast: number): number[] {
	return record(0x0208, [
		row & 0xff,
		row >> 8,
		colFirst & 0xff,
		colFirst >> 8,
		colLast & 0xff,
		colLast >> 8,
		0xff,
		0x00,
		0,
		0,
		0x00,
		0x01,
		0x0f,
		0x00,
	]);
}

/** Build a minimal single-worksheet BIFF8 `Workbook` stream. */
function buildSingleSheetWorkbook(): Uint8Array {
	const globals = [...bof(0x0005), ...sstRecord(['Revenue']), ...EOF_RECORD];
	const worksheet = [
		...bof(0x0010),
		...rowRecord(0, 0, 2),
		...labelSstRecord(0, 0, 0), // A1 = "Revenue" (existing SST entry)
		...rkIntRecord(0, 1, 42), // B1 = 42 (RK)
		...numberRecord(1, 0, 3.14), // A2 = 3.14 (NUMBER, 14 bytes)
		...EOF_RECORD,
	];
	return new Uint8Array([...globals, ...worksheet]);
}

/** Build a two-worksheet BIFF8 `Workbook` stream (for the multi-sheet refusal test). */
function buildTwoSheetWorkbook(): Uint8Array {
	const globals = [...bof(0x0005), ...sstRecord(['Revenue']), ...EOF_RECORD];
	const sheet1 = [...bof(0x0010), ...rowRecord(0, 0, 1), ...rkIntRecord(0, 0, 42), ...EOF_RECORD];
	const sheet2 = [...bof(0x0010), ...rowRecord(0, 0, 1), ...rkIntRecord(0, 0, 7), ...EOF_RECORD];
	return new Uint8Array([...globals, ...sheet1, ...sheet2]);
}

/**
 * Build a single-worksheet workbook whose numeric cell is `RK` div-by-100
 * encoded, the way real Excel stores an exact-looking decimal like `3.14`
 * (found via COM: `Shapes.AddOLEObject` against a real `.xls` never uses a
 * 14-byte `NUMBER` record for such a value, only `buildSingleSheetWorkbook`'s
 * synthetic fixture above did, which is why the grid rebuild's RK decode bug
 * went uncaught until COM verification of the real embedding).
 */
function buildWorkbookWithRkDecimal(): Uint8Array {
	const globals = [...bof(0x0005), ...sstRecord(['Revenue']), ...EOF_RECORD];
	const worksheet = [
		...bof(0x0010),
		...rowRecord(0, 0, 2),
		...labelSstRecord(0, 0, 0), // A1 = "Revenue"
		...rkDiv100Record(0, 1, 314), // B1 = 3.14 (RK, div-by-100)
		...EOF_RECORD,
	];
	return new Uint8Array([...globals, ...worksheet]);
}

/** A BIFF8 `BOUNDSHEET` record (MS-XLS 2.4.28): `lbPlyPos` is an absolute offset from the start of the `Workbook` stream to that sheet's own `BOF`. */
function boundsheetRecord(lbPlyPos: number, name: string): number[] {
	return record(0x0085, [
		lbPlyPos & 0xff,
		(lbPlyPos >> 8) & 0xff,
		(lbPlyPos >> 16) & 0xff,
		(lbPlyPos >> 24) & 0xff,
		0x00, // visibility
		0x00, // sheet type
		name.length & 0xff,
		0x00, // grbitChr: narrow (ANSI) characters
		...Array.from(name).map((ch) => ch.charCodeAt(0) & 0xff),
	]);
}

/** Build a single-worksheet workbook WITH a real `BOUNDSHEET` record whose `lbPlyPos` must stay correct across a resize. */
function buildWorkbookWithBoundsheet(): Uint8Array {
	const globalsPrefix = bof(0x0005);
	// The worksheet's BOF lands right after: globalsPrefix + BOUNDSHEET(placeholder) + SST + EOF.
	const boundsheetPlaceholder = boundsheetRecord(0, 'Sheet1');
	const sst = sstRecord(['Revenue']);
	const lbPlyPos =
		globalsPrefix.length + boundsheetPlaceholder.length + sst.length + EOF_RECORD.length;
	const globals = [
		...globalsPrefix,
		...boundsheetRecord(lbPlyPos, 'Sheet1'),
		...sst,
		...EOF_RECORD,
	];
	const worksheet = [
		...bof(0x0010),
		...rowRecord(0, 0, 2),
		...labelSstRecord(0, 0, 0), // A1 = "Revenue"
		...rkIntRecord(0, 1, 42), // B1 = 42 (RK)
		...EOF_RECORD,
	];
	return new Uint8Array([...globals, ...worksheet]);
}

describe('writeOleXlsStringCellEdit', () => {
	it('keeps BOUNDSHEET.lbPlyPos pointing at the worksheet BOF after a resize (regression: Excel silently blanked the sheet when this went stale)', () => {
		const original = buildWorkbookWithBoundsheet();
		// A brand-new string forces the resize path, which replaces the SST
		// (in Globals, BEFORE the worksheet's BOF) with a differently-sized one.
		const updated = writeOleXlsStringCellEdit(original, {
			row: 0,
			col: 1,
			value: 'Brand New Text',
		});

		const view = new DataView(updated.buffer, updated.byteOffset, updated.byteLength);
		const boundsheet = readRecords(updated, 0, updated.length).find(
			(r) => r.opcode === OPCODE_BOUNDSHEET,
		)!;
		const lbPlyPos = view.getUint32(boundsheet.dataOffset, true);
		const actualWorksheetOffset = findAllWorksheetRanges(updated)[0]!.start;
		expect(lbPlyPos).toBe(actualWorksheetOffset);

		const grid = readOleXlsGrid(updated);
		expect(grid!.rows[0]!.cells[1]!.value).toBe('Brand New Text');
	});

	it('preserves an untouched RK div-by-100 decimal cell across the resize path (regression: raw RK bits were written back verbatim)', () => {
		const original = buildWorkbookWithRkDecimal();
		// Editing a different, brand-new cell forces the resize/rebuild path,
		// which re-serializes every cell (including the untouched B1) from the
		// parsed grid.
		const updated = writeOleXlsStringCellEdit(original, { row: 2, col: 0, value: 'New Row' });
		const grid = readOleXlsGrid(updated);
		expect(Number(grid!.rows[0]!.cells[1]!.value)).toBeCloseTo(3.14, 5);
		expect(grid!.rows[2]!.cells[0]!.value).toBe('New Row');
	});

	it('converts an existing RK cell to a string in place (zero resize) when the string is already in the SST', () => {
		const original = buildSingleSheetWorkbook();
		const updated = writeOleXlsStringCellEdit(original, { row: 0, col: 1, value: 'Revenue' });
		expect(updated).toHaveLength(original.length);
		const grid = readOleXlsGrid(updated);
		expect(grid!.rows[0]!.cells[1]!.value).toBe('Revenue');
		expect(grid!.rows[0]!.cells[1]!.isNumeric).toBeFalsy();
		// Untouched cells survive.
		expect(grid!.rows[0]!.cells[0]!.value).toBe('Revenue');
		expect(Number(grid!.rows[1]!.cells[0]!.value)).toBeCloseTo(3.14, 5);
	});

	it('converts an existing LABELSST cell to a different existing string in place', () => {
		const original = buildSingleSheetWorkbook();
		const withSecondString = writeOleXlsStringCellEdit(original, {
			row: 0,
			col: 1,
			value: 'Other',
		});
		// New string -> triggers the resize path once; re-edit back to the
		// now-existing first string to exercise the in-place LABELSST->LABELSST swap.
		const updated = writeOleXlsStringCellEdit(withSecondString, { row: 0, col: 0, value: 'Other' });
		const grid = readOleXlsGrid(updated);
		expect(grid!.rows[0]!.cells[0]!.value).toBe('Other');
	});

	it('adds a brand-new string to the SST and rebuilds the cell region (resize path)', () => {
		const original = buildSingleSheetWorkbook();
		const updated = writeOleXlsStringCellEdit(original, {
			row: 0,
			col: 1,
			value: 'Brand New Text',
		});
		expect(updated).not.toHaveLength(original.length);
		const grid = readOleXlsGrid(updated);
		expect(grid!.rows[0]!.cells[1]!.value).toBe('Brand New Text');
		// Untouched cells (including the NUMBER cell, a different record size) survive.
		expect(grid!.rows[0]!.cells[0]!.value).toBe('Revenue');
		expect(Number(grid!.rows[1]!.cells[0]!.value)).toBeCloseTo(3.14, 5);
	});

	it('converts a NUMBER cell (14 bytes) to a string via the resize path', () => {
		const original = buildSingleSheetWorkbook();
		const updated = writeOleXlsStringCellEdit(original, { row: 1, col: 0, value: 'Now Text' });
		const grid = readOleXlsGrid(updated);
		expect(grid!.rows[1]!.cells[0]!.value).toBe('Now Text');
		expect(grid!.rows[1]!.cells[0]!.isNumeric).toBeFalsy();
	});

	it('adds a genuinely new cell (no prior record at that row/col)', () => {
		const original = buildSingleSheetWorkbook();
		const updated = writeOleXlsStringCellEdit(original, { row: 2, col: 0, value: 'New Row' });
		const grid = readOleXlsGrid(updated);
		expect(grid!.rows[2]!.cells[0]!.value).toBe('New Row');
		// Prior rows untouched.
		expect(grid!.rows[0]!.cells[0]!.value).toBe('Revenue');
	});

	it('round-trips a multi-edit sequence (each edit builds on the previous result)', () => {
		let bytes = buildSingleSheetWorkbook();
		bytes = writeOleXlsStringCellEdit(bytes, { row: 0, col: 1, value: 'Second' });
		bytes = writeOleXlsStringCellEdit(bytes, { row: 3, col: 3, value: 'Third' });
		const grid = readOleXlsGrid(bytes);
		expect(grid!.rows[0]!.cells[1]!.value).toBe('Second');
		expect(grid!.rows[3]!.cells[3]!.value).toBe('Third');
		expect(grid!.rows[0]!.cells[0]!.value).toBe('Revenue');
	});

	it('refuses to resize a multi-worksheet file (leaves bytes unchanged) when in-place does not apply', () => {
		const original = buildTwoSheetWorkbook();
		const updated = writeOleXlsStringCellEdit(original, { row: 0, col: 0, value: 'Brand New' });
		expect(updated).toStrictEqual(original);
	});

	it('still allows the zero-resize in-place path on a multi-worksheet file', () => {
		const original = buildTwoSheetWorkbook();
		// "Revenue" already exists in the SST, and row 0 col 0 of the FIRST
		// sheet is an RK cell, so this is the safe, zero-resize path.
		const updated = writeOleXlsStringCellEdit(original, { row: 0, col: 0, value: 'Revenue' });
		expect(updated).toHaveLength(original.length);
		const grid = readOleXlsGrid(updated);
		expect(grid!.rows[0]!.cells[0]!.value).toBe('Revenue');
	});

	it('returns the original bytes unchanged for an unreadable workbook', () => {
		const original = new Uint8Array([1, 2, 3]);
		expect(writeOleXlsStringCellEdit(original, { row: 0, col: 0, value: 'x' })).toStrictEqual(
			original,
		);
	});
});
