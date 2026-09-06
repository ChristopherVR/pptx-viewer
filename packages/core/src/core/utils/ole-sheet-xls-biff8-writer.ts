/**
 * BIFF8 (legacy `Excel.Sheet.8` / `.xls`) STRING cell writer: the sibling
 * `ole-sheet-xls-biff8.ts` only overwrites an EXISTING `NUMBER`/`RK` record
 * in place (same byte length, no resize). This module adds the harder
 * case: writing a STRING value, which needs `SST` (shared string table)
 * maintenance and, when the target cell/row does not already exist, actual
 * stream resizing. The grid parser/serializer live in
 * `ole-sheet-xls-biff8-grid.ts` (split out for the 300-LOC limit).
 *
 * Two paths, in increasing order of risk:
 *
 * 1. **In-place** (no resize): `RK` and `LABELSST` are both exactly 10-byte
 *    records (`row, col, ixfe, 4-byte payload`). Converting one to the
 *    other just swaps the opcode and the last 4 bytes - the stream length
 *    never changes, so no DBCELL / BOUNDSHEET offset anywhere in the file
 *    needs updating. This covers "edit an existing short cell to text".
 * 2. **Rebuild** (resize): a `NUMBER` cell (14 bytes) becoming text, or a
 *    genuinely new cell/row, changes the worksheet substream's length. This
 *    rebuilds that ONE worksheet's row/cell/DBCELL region from a full
 *    in-memory grid (preserving every other record - `WSBOOL`, `WINDOW2`,
 *    etc. - verbatim), and, when the `SST`/`EXTSST` span (which lives in
 *    Globals, BEFORE every worksheet's `BOF`) also changes size, patches
 *    every `BOUNDSHEET.lbPlyPos` (MS-XLS 2.4.28, an absolute stream offset
 *    to that sheet's `BOF`) by the resulting delta. This fixup is required
 *    even for a single-worksheet file: `lbPlyPos` still points at that one
 *    sheet's own `BOF`, and COM verification (`Shapes.AddOLEObject` against
 *    a real `.xls`, opened again via Excel COM) showed that a stale
 *    `lbPlyPos` makes Excel silently render the sheet as blank rather than
 *    fail to open - the file "worked" by every check that did not
 *    specifically read cell values back through real Excel. Resizing is
 *    still only attempted when the file has exactly ONE worksheet: with
 *    more than one, a second/later sheet's OWN row/cell region also sits
 *    after the point being resized, which this module does not rebuild, so
 *    that case falls back to the in-place path only (or is a no-op if
 *    in-place does not apply either) rather than risk emitting a file where
 *    a later sheet's data is misread. Single-worksheet is the overwhelming
 *    majority of real "Insert Object > Excel Worksheet" embeds. Scoped to
 *    the file's FIRST worksheet, matching
 *    `readOleXlsGrid`/`writeOleXlsNumericCellEdit`'s existing scope.
 *
 * Reference: [MS-XLS] Excel Binary File Format, sections 2.4.107 (SST),
 * 2.4.148 (ROW), 2.4.42 (DBCELL), 2.4.28 (BOUNDSHEET).
 *
 * @module ole-sheet-xls-biff8-writer
 */
import {
	findAllWorksheetRanges,
	OPCODE_BLANK,
	OPCODE_BOUNDSHEET,
	OPCODE_DBCELL,
	OPCODE_DIMENSIONS,
	OPCODE_EXTSST,
	OPCODE_LABEL,
	OPCODE_LABELSST,
	OPCODE_NUMBER,
	OPCODE_RK,
	OPCODE_ROW,
	OPCODE_SST,
	parseSstSingleRecord,
	readRecords,
} from './ole-sheet-xls-biff8';
import { biffRecord, buildXlsRowCellRegion, parseXlsGrid, u16le } from './ole-sheet-xls-biff8-grid';
import type { GridCell } from './ole-sheet-xls-biff8-grid';
import { unwrapXlsBytes } from './ole-sheet-xls-cfb';

/** Resolve (finding or appending) the SST index for `value`, and the rebuilt `SST` record bytes when it changed. */
function resolveSstIndex(
	sharedStrings: string[],
	value: string,
): { index: number; rebuilt?: number[] } {
	const existing = sharedStrings.indexOf(value);
	if (existing !== -1) {
		return { index: existing };
	}
	const next = [...sharedStrings, value];
	const data: number[] = [];
	data.push(...u16le(next.length & 0xffff), 0, 0); // total count (low 16 only; good enough for small sheets)
	data.push(...u16le(next.length & 0xffff), 0, 0); // unique count
	for (const s of next) {
		data.push(...u16le(s.length), 0x00); // charCount, flags=0 (narrow, no rich/ext)
		for (const ch of s) {
			data.push(ch.charCodeAt(0) & 0xff);
		}
	}
	return { index: next.length - 1, rebuilt: biffRecord(OPCODE_SST, data) };
}

/** Try the zero-resize path: swap an existing 10-byte `RK`/`LABELSST` cell record in place. */
function tryInPlaceStringEdit(
	bytes: Uint8Array,
	range: { start: number; end: number },
	edit: { row: number; col: number },
	sstIndex: number,
): Uint8Array | undefined {
	const out = new Uint8Array(bytes);
	const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
	for (const rec of readRecords(out, range.start, range.end)) {
		if ((rec.opcode !== OPCODE_RK && rec.opcode !== OPCODE_LABELSST) || rec.length < 10) {
			continue;
		}
		const row = view.getUint16(rec.dataOffset, true);
		const col = view.getUint16(rec.dataOffset + 2, true);
		if (row !== edit.row || col !== edit.col) {
			continue;
		}
		view.setUint16(rec.headerOffset, OPCODE_LABELSST, true);
		view.setUint32(rec.dataOffset + 6, sstIndex, true);
		return out;
	}
	return undefined;
}

function isCellOpcode(opcode: number): boolean {
	return (
		opcode === OPCODE_NUMBER ||
		opcode === OPCODE_RK ||
		opcode === OPCODE_LABELSST ||
		opcode === OPCODE_LABEL ||
		opcode === OPCODE_BLANK
	);
}

/** Locate the `[regionStart, regionEnd)` byte range covering every `ROW`/cell/`DBCELL` record in a worksheet. */
function findRowCellRegion(
	bytes: Uint8Array,
	range: { start: number; end: number },
): { start: number; end: number } {
	const records = readRecords(bytes, range.start, range.end);
	const dimensions = records.find((r) => r.opcode === OPCODE_DIMENSIONS);
	const first = records.find((r) => r.opcode === OPCODE_ROW || isCellOpcode(r.opcode));
	const start =
		first?.headerOffset ??
		(dimensions ? dimensions.dataOffset + dimensions.length : range.start + 4);
	const lastDbcell = [...records].reverse().find((r) => r.opcode === OPCODE_DBCELL);
	const lastCellOrRow = [...records]
		.reverse()
		.find((r) => r.opcode === OPCODE_ROW || isCellOpcode(r.opcode));
	const end = lastDbcell
		? lastDbcell.dataOffset + lastDbcell.length
		: (lastCellOrRow?.dataOffset ?? start) + (lastCellOrRow?.length ?? 0);
	return { start, end };
}

/**
 * Add `delta` to every `BOUNDSHEET.lbPlyPos` field in `bytes`, returning a
 * patched copy. `lbPlyPos` (MS-XLS 2.4.28) is an absolute offset from the
 * start of the `Workbook` stream to that sheet's own `BOF`; it must be
 * fixed up whenever a resize happening BEFORE a sheet's `BOF` (here, the
 * `SST`/`EXTSST` span in Globals) shifts that offset, or Excel silently
 * fails to locate the sheet's data (COM-verified: the file still opens, the
 * sheet just renders blank).
 */
function patchBoundsheetOffsets(bytes: Uint8Array, delta: number): Uint8Array {
	if (delta === 0) {
		return bytes;
	}
	const out = new Uint8Array(bytes);
	const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
	for (const rec of readRecords(out, 0, out.length)) {
		if (rec.opcode === OPCODE_BOUNDSHEET && rec.length >= 4) {
			view.setUint32(rec.dataOffset, view.getUint32(rec.dataOffset, true) + delta, true);
		}
	}
	return out;
}

/**
 * Write a STRING value into a legacy `.xls` (BIFF8) payload's first
 * worksheet, at `[row, col]`. Handles the SST (adding the string if not
 * already present) and converts an existing short cell record in place
 * when possible; otherwise rebuilds the worksheet's row/cell/DBCELL region
 * (only when the file has exactly one worksheet - see module doc). Returns
 * the original bytes unchanged on any structural surprise this module does
 * not recognise, rather than risk emitting a corrupt file.
 */
export function writeOleXlsStringCellEdit(
	inputBytes: Uint8Array,
	edit: { row: number; col: number; value: string },
): Uint8Array {
	try {
		const { workbookBytes: xlsBytes, rewrap } = unwrapXlsBytes(inputBytes);
		const finish = (result: Uint8Array): Uint8Array => (rewrap ? rewrap(result) : result);

		const ranges = findAllWorksheetRanges(xlsBytes);
		const target = ranges[0];
		if (!target) {
			return inputBytes;
		}
		const sharedStrings = parseSstSingleRecord(xlsBytes);
		const { index: sstIndex, rebuilt: newSstRecord } = resolveSstIndex(sharedStrings, edit.value);

		if (!newSstRecord) {
			// The string already exists in the SST: try the free, zero-resize path first.
			const inPlace = tryInPlaceStringEdit(xlsBytes, target, edit, sstIndex);
			if (inPlace) {
				return finish(inPlace);
			}
		}

		// Resize is only safe when there is exactly one worksheet: a second
		// (or later) sheet's `BOUNDSHEET.lbPlyPos` would otherwise point at a
		// stale offset once this sheet's byte length changes (see module doc).
		if (ranges.length > 1) {
			return inputBytes;
		}

		// Rebuild path: replace the SST record (Globals) and this worksheet's
		// row/cell region, splicing everything else through unchanged.
		const allRecords = readRecords(xlsBytes, 0, xlsBytes.length);
		const sstRecord = allRecords.find((r) => r.opcode === OPCODE_SST);
		const extSstRecord = allRecords.find((r) => r.opcode === OPCODE_EXTSST);
		if (!sstRecord) {
			return inputBytes; // no SST at all is not a shape this module recognises
		}

		const grid = parseXlsGrid(xlsBytes, target);
		const row = grid.get(edit.row) ?? { cells: new Map<number, GridCell>() };
		row.cells.set(edit.col, {
			ixfe: row.cells.get(edit.col)?.ixfe ?? 15,
			kind: 'sst',
			value: sstIndex,
		});
		grid.set(edit.row, row);
		const newRegion = buildXlsRowCellRegion(grid);
		const region = findRowCellRegion(xlsBytes, target);

		const sstEnd = extSstRecord
			? extSstRecord.dataOffset + extSstRecord.length
			: sstRecord.dataOffset + sstRecord.length;

		// The SST/EXTSST span sits in Globals, BEFORE this worksheet's own
		// BOF: if replacing it changes its byte length, this sheet's
		// `BOUNDSHEET.lbPlyPos` (still the ONLY worksheet, per the guard
		// above) must shift by the same delta, or Excel cannot find this
		// sheet's data (see `patchBoundsheetOffsets`'s doc comment).
		const oldSstSpanLength = sstEnd - sstRecord.headerOffset;
		const newSstSpanLength = newSstRecord ? newSstRecord.length : oldSstSpanLength;
		const patchedXlsBytes = patchBoundsheetOffsets(xlsBytes, newSstSpanLength - oldSstSpanLength);

		const out: number[] = [
			...patchedXlsBytes.subarray(0, sstRecord.headerOffset),
			...(newSstRecord ??
				Array.from(
					patchedXlsBytes.subarray(sstRecord.headerOffset, sstRecord.dataOffset + sstRecord.length),
				)),
			// EXTSST is dropped; Excel recomputes it on open.
			...patchedXlsBytes.subarray(sstEnd, region.start),
			...newRegion,
			...patchedXlsBytes.subarray(region.end),
		];
		return finish(Uint8Array.from(out));
	} catch {
		return inputBytes;
	}
}
