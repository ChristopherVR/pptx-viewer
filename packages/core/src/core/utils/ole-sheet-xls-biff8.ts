/**
 * Minimal BIFF8 (legacy `Excel.Sheet.8` / `.xls`) cell reader and in-place
 * numeric editor.
 *
 * `.xls` payloads are themselves OLE2 compound files whose `Workbook`
 * stream holds a BIFF8 record stream (see `ole2-parser-read.ts` for the
 * container). A full BIFF8 writer (arbitrary text edits, new cells, styles)
 * would need to rewrite the row/DBCELL offset tables the format uses for
 * random access, which is out of scope here; this module supports the
 * bounded, corruption-safe subset that does not require resizing anything:
 *
 * - Reading a preview grid (`NUMBER`, `RK`, `LABELSST`, `LABEL` cell
 *   records) from the first worksheet substream.
 * - Overwriting an EXISTING `NUMBER` or `RK` cell's value in place, since
 *   both are fixed-size records: the edit never changes the stream's
 *   length, so no offset table needs updating.
 *
 * Editing a text cell, or a cell with no existing numeric record, is not
 * supported by this module; callers should fall back to Replace File for
 * those. This is a deliberate scope boundary, not a bug: legacy `.xls`
 * editing exists so simple numeric worksheets stay editable without a full
 * BIFF writer, not as a drop-in replacement for `.xlsx` (which supports
 * every edit via `ole-sheet-xlsx-editor.ts`).
 *
 * Reference: [MS-XLS] Excel Binary File Format.
 * @see https://learn.microsoft.com/openspecs/office_standards/ms-xls
 *
 * @module ole-sheet-xls-biff8
 */
import { unwrapXlsBytes } from './ole-sheet-xls-cfb';
import type { OleSheetCell, OleSheetGrid, OleSheetRow } from './ole-sheet-xlsx-editor';

/** BIFF8 record opcodes this module (and its writer sibling, `ole-sheet-xls-biff8-writer.ts`) understands. */
export const OPCODE_BOF = 0x0809;
export const OPCODE_EOF = 0x000a;
export const OPCODE_NUMBER = 0x0203;
export const OPCODE_RK = 0x027e;
export const OPCODE_LABELSST = 0x00fd;
export const OPCODE_LABEL = 0x0204;
export const OPCODE_SST = 0x00fc;
export const OPCODE_EXTSST = 0x00ff;
export const OPCODE_ROW = 0x0208;
export const OPCODE_DBCELL = 0x00d7;
export const OPCODE_DIMENSIONS = 0x0200;
export const OPCODE_BLANK = 0x0201;
export const OPCODE_BOUNDSHEET = 0x0085;
export const WORKSHEET_DT = 0x0010;

/** One parsed BIFF8 record: `[opcode:u16][length:u16][data]`. */
export interface BiffRecord {
	opcode: number;
	/** Offset of the record's 4-byte header (opcode + length). */
	headerOffset: number;
	/** Offset of the record's data (headerOffset + 4). */
	dataOffset: number;
	length: number;
}

/** Parse every well-formed BIFF8 record in `[start, end)`. Exported for `ole-sheet-xls-biff8-writer.ts`. */
export function readRecords(bytes: Uint8Array, start: number, end: number): BiffRecord[] {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const records: BiffRecord[] = [];
	let offset = start;
	while (offset + 4 <= end) {
		const opcode = view.getUint16(offset, true);
		const length = view.getUint16(offset + 2, true);
		const dataOffset = offset + 4;
		if (dataOffset + length > end) {
			break;
		}
		records.push({ opcode, headerOffset: offset, dataOffset, length });
		offset = dataOffset + length;
	}
	return records;
}

/** Every worksheet substream's byte range `[start, end)`, in file order. */
export function findAllWorksheetRanges(bytes: Uint8Array): Array<{ start: number; end: number }> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const allBof = readRecords(bytes, 0, bytes.length).filter((r) => r.opcode === OPCODE_BOF);
	const ranges: Array<{ start: number; end: number }> = [];
	for (const bof of allBof) {
		if (bof.length < 4) {
			continue;
		}
		const dt = view.getUint16(bof.dataOffset + 2, true);
		if (dt !== WORKSHEET_DT) {
			continue;
		}
		// Find the matching EOF: the next EOF record after this BOF, scanning
		// records sequentially from the BOF (BIFF substreams do not nest).
		const rest = readRecords(bytes, bof.headerOffset, bytes.length);
		const eof = rest.find((r) => r.opcode === OPCODE_EOF);
		if (eof) {
			ranges.push({ start: bof.headerOffset, end: eof.dataOffset + eof.length });
		}
	}
	return ranges;
}

/** Find the byte range `[start, end)` of the first worksheet substream. */
export function findFirstWorksheetRange(
	bytes: Uint8Array,
): { start: number; end: number } | undefined {
	return findAllWorksheetRanges(bytes)[0];
}

/** Parse a single-record `SST` (shared string table) for preview text. Does not stitch `CONTINUE` records. */
export function parseSstSingleRecord(bytes: Uint8Array): string[] {
	const records = readRecords(bytes, 0, bytes.length);
	const sst = records.find((r) => r.opcode === OPCODE_SST);
	if (!sst) {
		return [];
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const strings: string[] = [];
	let offset = sst.dataOffset + 8; // skip total/unique counts
	const end = sst.dataOffset + sst.length;
	try {
		while (offset + 3 <= end) {
			const charCount = view.getUint16(offset, true);
			const flags = view.getUint8(offset + 2);
			offset += 3;
			const isWide = (flags & 0x1) !== 0;
			const hasExt = (flags & 0x4) !== 0;
			const isRich = (flags & 0x8) !== 0;
			let richRuns = 0;
			let extLen = 0;
			if (isRich) {
				richRuns = view.getUint16(offset, true);
				offset += 2;
			}
			if (hasExt) {
				extLen = view.getUint32(offset, true);
				offset += 4;
			}
			let text = '';
			for (let i = 0; i < charCount; i++) {
				if (isWide) {
					text += String.fromCharCode(view.getUint16(offset, true));
					offset += 2;
				} else {
					text += String.fromCharCode(view.getUint8(offset));
					offset += 1;
				}
			}
			offset += richRuns * 4 + extLen;
			strings.push(text);
		}
	} catch {
		// Truncated / CONTINUE-spanning SST: return what parsed so far.
	}
	return strings;
}

const DEFAULT_MAX_ROWS = 50;
const DEFAULT_MAX_COLS = 26;

/**
 * Read a bounded preview grid from a legacy `.xls` (BIFF8) payload's first
 * worksheet. Best-effort: a shared string table split across `CONTINUE`
 * records may not resolve every `LABELSST` cell's text. Returns `undefined`
 * when no worksheet substream can be located.
 */
export function readOleXlsGrid(
	inputBytes: Uint8Array,
	maxRows = DEFAULT_MAX_ROWS,
	maxCols = DEFAULT_MAX_COLS,
): OleSheetGrid | undefined {
	const xlsBytes = unwrapXlsBytes(inputBytes).workbookBytes;
	const range = findFirstWorksheetRange(xlsBytes);
	if (!range) {
		return undefined;
	}
	const view = new DataView(xlsBytes.buffer, xlsBytes.byteOffset, xlsBytes.byteLength);
	const sharedStrings = parseSstSingleRecord(xlsBytes);
	const rows: OleSheetRow[] = Array.from({ length: maxRows }, () => ({
		cells: Array.from({ length: maxCols }, () => ({ value: '', isNumeric: false }) as OleSheetCell),
	}));

	for (const record of readRecords(xlsBytes, range.start, range.end)) {
		if (record.length < 6) {
			continue;
		}
		const row = view.getUint16(record.dataOffset, true);
		const col = view.getUint16(record.dataOffset + 2, true);
		if (row >= maxRows || col >= maxCols) {
			continue;
		}
		if (record.opcode === OPCODE_NUMBER && record.length >= 14) {
			const value = view.getFloat64(record.dataOffset + 6, true);
			rows[row]!.cells[col] = { value: String(value), isNumeric: true };
		} else if (record.opcode === OPCODE_RK && record.length >= 10) {
			const rk = view.getInt32(record.dataOffset + 6, true);
			rows[row]!.cells[col] = { value: String(decodeRk(rk)), isNumeric: true };
		} else if (record.opcode === OPCODE_LABELSST && record.length >= 10) {
			const sstIndex = view.getUint32(record.dataOffset + 6, true);
			rows[row]!.cells[col] = { value: sharedStrings[sstIndex] ?? '', isNumeric: false };
		} else if (record.opcode === OPCODE_LABEL && record.length >= 8) {
			const charCount = view.getUint16(record.dataOffset + 6, true);
			let text = '';
			for (
				let i = 0;
				i < charCount && record.dataOffset + 8 + i < record.dataOffset + record.length;
				i++
			) {
				text += String.fromCharCode(view.getUint8(record.dataOffset + 8 + i));
			}
			rows[row]!.cells[col] = { value: text, isNumeric: false };
		}
	}

	let lastNonEmpty = -1;
	for (let r = 0; r < rows.length; r++) {
		if (rows[r]!.cells.some((c) => c.value !== '')) {
			lastNonEmpty = r;
		}
	}
	return { sheetName: 'Sheet1', rows: rows.slice(0, Math.max(1, lastNonEmpty + 1)) };
}

/** Decode a BIFF `RK` compact numeric value (MS-XLS 2.5.122). Exported for `ole-sheet-xls-biff8-writer.ts`. */
export function decodeRk(rk: number): number {
	const isInt = (rk & 0x2) !== 0;
	const isDiv100 = (rk & 0x1) !== 0;
	let value: number;
	if (isInt) {
		value = rk >> 2;
	} else {
		const buffer = new ArrayBuffer(8);
		const view = new DataView(buffer);
		view.setUint32(0, rk & 0xfffffffc, false);
		view.setUint32(4, 0, false);
		value = view.getFloat64(0, false);
	}
	return isDiv100 ? value / 100 : value;
}

/** Encode a number as a BIFF `RK` value, accepting the format's precision loss for non-integers. */
export function encodeRk(value: number): number {
	if (Number.isInteger(value) && Math.abs(value) < 0x20000000) {
		return ((value << 2) | 0x2) >>> 0;
	}
	const buffer = new ArrayBuffer(8);
	const view = new DataView(buffer);
	view.setFloat64(0, value, false);
	const high32 = view.getUint32(0, false);
	return high32 & 0xfffffffc;
}

/**
 * Overwrite an existing `NUMBER` or `RK` cell's value in place within a
 * legacy `.xls` payload's first worksheet. Returns the original bytes
 * unchanged when the target cell does not already hold a `NUMBER`/`RK`
 * record (this module does not resize the stream) or the value is not a
 * finite number.
 */
export function writeOleXlsNumericCellEdit(
	inputBytes: Uint8Array,
	edit: { row: number; col: number; value: number },
): Uint8Array {
	if (!Number.isFinite(edit.value)) {
		return inputBytes;
	}
	const { workbookBytes: xlsBytes, rewrap } = unwrapXlsBytes(inputBytes);
	const range = findFirstWorksheetRange(xlsBytes);
	if (!range) {
		return inputBytes;
	}
	const out = new Uint8Array(xlsBytes);
	const view = new DataView(out.buffer, out.byteOffset, out.byteLength);

	for (const record of readRecords(out, range.start, range.end)) {
		if (record.length < 6) {
			continue;
		}
		const row = view.getUint16(record.dataOffset, true);
		const col = view.getUint16(record.dataOffset + 2, true);
		if (row !== edit.row || col !== edit.col) {
			continue;
		}
		if (record.opcode === OPCODE_NUMBER && record.length >= 14) {
			view.setFloat64(record.dataOffset + 6, edit.value, true);
			return rewrap ? rewrap(out) : out;
		}
		if (record.opcode === OPCODE_RK && record.length >= 10) {
			view.setInt32(record.dataOffset + 6, encodeRk(edit.value), true);
			return rewrap ? rewrap(out) : out;
		}
	}
	return inputBytes;
}
