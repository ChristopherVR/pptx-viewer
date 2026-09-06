import { describe, expect, it } from 'vitest';

import { readOleXlsGrid, writeOleXlsNumericCellEdit } from './ole-sheet-xls-biff8';

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
	// vers(2)=0x0600, dt(2), rupBuild(2)=0, rupYear(2)=0, remaining padding to 16 bytes.
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
	// total count, unique count (both = strings.length for this minimal builder)
	const count = strings.length;
	data.push(count & 0xff, (count >> 8) & 0xff, 0, 0);
	data.push(count & 0xff, (count >> 8) & 0xff, 0, 0);
	for (const s of strings) {
		data.push(s.length & 0xff, (s.length >> 8) & 0xff, 0x00); // charCount, flags=0 (narrow)
		for (const ch of s) {
			data.push(ch.charCodeAt(0) & 0xff);
		}
	}
	return record(0x00fc, data);
}

function numberRecord(row: number, col: number, value: number): number[] {
	const buffer = new ArrayBuffer(8);
	new DataView(buffer).setFloat64(0, value, true);
	const valueBytes = Array.from(new Uint8Array(buffer));
	return record(0x0203, [
		row & 0xff,
		(row >> 8) & 0xff,
		col & 0xff,
		(col >> 8) & 0xff,
		0,
		0,
		...valueBytes,
	]);
}

function rkIntRecord(row: number, col: number, intValue: number): number[] {
	const rk = ((intValue << 2) | 0x2) >>> 0;
	return record(0x027e, [
		row & 0xff,
		(row >> 8) & 0xff,
		col & 0xff,
		(col >> 8) & 0xff,
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
		(row >> 8) & 0xff,
		col & 0xff,
		(col >> 8) & 0xff,
		0,
		0,
		sstIndex & 0xff,
		(sstIndex >> 8) & 0xff,
		0,
		0,
	]);
}

/** Build a minimal BIFF8 `Workbook` stream: Globals substream + one worksheet substream. */
function buildWorkbookStream(): Uint8Array {
	const globals = [...bof(0x0005), ...sstRecord(['Total']), ...EOF_RECORD];
	const worksheet = [
		...bof(0x0010),
		...numberRecord(0, 0, 3.14),
		...rkIntRecord(0, 1, 100),
		...labelSstRecord(1, 0, 0),
		...EOF_RECORD,
	];
	return new Uint8Array([...globals, ...worksheet]);
}

describe('ole-sheet-xls-biff8', () => {
	it('reads NUMBER, RK, and LABELSST cells from the first worksheet substream', () => {
		const grid = readOleXlsGrid(buildWorkbookStream());
		expect(grid).toBeDefined();
		expect(Number(grid!.rows[0]!.cells[0]!.value)).toBeCloseTo(3.14, 5);
		expect(grid!.rows[0]!.cells[0]!.isNumeric).toBeTruthy();
		expect(Number(grid!.rows[0]!.cells[1]!.value)).toBe(100);
		expect(grid!.rows[1]!.cells[0]!.value).toBe('Total');
		expect(grid!.rows[1]!.cells[0]!.isNumeric).toBeFalsy();
	});

	it('returns undefined when no worksheet substream can be located', () => {
		expect(readOleXlsGrid(new Uint8Array([1, 2, 3, 4]))).toBeUndefined();
	});

	it('overwrites an existing NUMBER cell in place without resizing the stream', () => {
		const original = buildWorkbookStream();
		const updated = writeOleXlsNumericCellEdit(original, { row: 0, col: 0, value: 42.5 });
		expect(updated).toHaveLength(original.length);
		const grid = readOleXlsGrid(updated);
		expect(Number(grid!.rows[0]!.cells[0]!.value)).toBeCloseTo(42.5, 5);
	});

	it('overwrites an existing RK cell in place, re-encoding as RK', () => {
		const original = buildWorkbookStream();
		const updated = writeOleXlsNumericCellEdit(original, { row: 0, col: 1, value: 7 });
		expect(updated).toHaveLength(original.length);
		const grid = readOleXlsGrid(updated);
		expect(Number(grid!.rows[0]!.cells[1]!.value)).toBe(7);
	});

	it('leaves the stream unchanged when the target cell is not a NUMBER/RK record', () => {
		const original = buildWorkbookStream();
		const updated = writeOleXlsNumericCellEdit(original, { row: 1, col: 0, value: 1 });
		expect(updated).toStrictEqual(original);
	});

	it('leaves the stream unchanged for a non-finite value', () => {
		const original = buildWorkbookStream();
		const updated = writeOleXlsNumericCellEdit(original, { row: 0, col: 0, value: Number.NaN });
		expect(updated).toStrictEqual(original);
	});
});
