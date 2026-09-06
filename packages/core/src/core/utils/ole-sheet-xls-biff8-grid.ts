/**
 * The in-memory row/cell grid + region (re)serializer for
 * `ole-sheet-xls-biff8-writer.ts`'s resize path, split out purely to keep
 * that file under this codebase's 300-LOC limit.
 *
 * @module ole-sheet-xls-biff8-grid
 */
import {
	decodeRk,
	OPCODE_BLANK,
	OPCODE_DBCELL,
	OPCODE_LABEL,
	OPCODE_LABELSST,
	OPCODE_NUMBER,
	OPCODE_RK,
	OPCODE_ROW,
	readRecords,
} from './ole-sheet-xls-biff8';

/** Build one BIFF8 record's bytes: `[opcode:u16le][length:u16le][data]`. */
export function biffRecord(opcode: number, data: number[]): number[] {
	return [
		opcode & 0xff,
		(opcode >> 8) & 0xff,
		data.length & 0xff,
		(data.length >> 8) & 0xff,
		...data,
	];
}

export function u16le(value: number): number[] {
	return [value & 0xff, (value >> 8) & 0xff];
}

/** One resolved cell for the rebuild path. */
export interface GridCell {
	ixfe: number;
	kind: 'number' | 'sst' | 'blank';
	value: number;
}

/** One resolved row for the rebuild path: its original extra `ROW` bytes (height/flags), if it had one, plus its cells. */
export interface GridRow {
	extraRowBytes?: number[];
	cells: Map<number, GridCell>;
}

/** Parse the worksheet's existing rows/cells (skipping `DBCELL`, which is regenerated) into an editable grid. */
export function parseXlsGrid(
	bytes: Uint8Array,
	range: { start: number; end: number },
): Map<number, GridRow> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const grid = new Map<number, GridRow>();
	const rowFor = (r: number): GridRow => {
		let row = grid.get(r);
		if (!row) {
			row = { cells: new Map() };
			grid.set(r, row);
		}
		return row;
	};
	for (const rec of readRecords(bytes, range.start, range.end)) {
		if (rec.opcode === OPCODE_ROW && rec.length >= 16) {
			const rw = view.getUint16(rec.dataOffset, true);
			rowFor(rw).extraRowBytes = Array.from(
				bytes.subarray(rec.dataOffset + 6, rec.dataOffset + 16),
			);
			continue;
		}
		if (rec.length < 6) {
			continue;
		}
		const r = view.getUint16(rec.dataOffset, true);
		const c = view.getUint16(rec.dataOffset + 2, true);
		const ixfe = view.getUint16(rec.dataOffset + 4, true);
		if (rec.opcode === OPCODE_NUMBER && rec.length >= 14) {
			rowFor(r).cells.set(c, {
				ixfe,
				kind: 'number',
				value: view.getFloat64(rec.dataOffset + 6, true),
			});
		} else if (rec.opcode === OPCODE_RK && rec.length >= 10) {
			// `RK` is a compact encoding (MS-XLS 2.5.122): decode it to the real
			// number before storing, not the raw packed bits. A div-by-100 `RK`
			// (real Excel's encoding for an exact-looking decimal like `3.14`)
			// is NOT the value itself and must never be written back verbatim.
			rowFor(r).cells.set(c, {
				ixfe,
				kind: 'number',
				value: decodeRk(view.getInt32(rec.dataOffset + 6, true)),
			});
		} else if (rec.opcode === OPCODE_LABELSST && rec.length >= 10) {
			rowFor(r).cells.set(c, {
				ixfe,
				kind: 'sst',
				value: view.getUint32(rec.dataOffset + 6, true),
			});
		} else if (rec.opcode === OPCODE_LABEL) {
			// Legacy inline LABEL: dropped on rebuild (this module writes SST-based
			// LABELSST cells only); a caller editing this exact cell overwrites it below.
			rowFor(r).cells.set(c, { ixfe, kind: 'blank', value: 0 });
		} else if (rec.opcode === OPCODE_BLANK) {
			rowFor(r).cells.set(c, { ixfe, kind: 'blank', value: 0 });
		}
	}
	return grid;
}

/** Serialize the rebuilt row/cell/DBCELL region for one worksheet from `grid`. */
export function buildXlsRowCellRegion(grid: Map<number, GridRow>): Uint8Array {
	const rows = [...grid.keys()].sort((a, b) => a - b);
	const bytesOut: number[] = [];
	const rowRecordOffsets: number[] = [];
	const firstCellOffsetPerRow: number[] = [];

	for (const r of rows) {
		const row = grid.get(r)!;
		const cols = [...row.cells.keys()].sort((a, b) => a - b);
		const colFirst = cols[0] ?? 0;
		const colLast = cols.length > 0 ? cols[cols.length - 1]! + 1 : 0;
		rowRecordOffsets.push(bytesOut.length);
		const extra = row.extraRowBytes ?? [0xff, 0x00, 0, 0, 0x00, 0x01, 0x0f, 0x00];
		bytesOut.push(
			...biffRecord(OPCODE_ROW, [...u16le(r), ...u16le(colFirst), ...u16le(colLast), ...extra]),
		);
	}
	for (const r of rows) {
		const row = grid.get(r)!;
		const cols = [...row.cells.keys()].sort((a, b) => a - b);
		firstCellOffsetPerRow.push(bytesOut.length);
		for (const c of cols) {
			const cell = row.cells.get(c)!;
			if (cell.kind === 'sst') {
				bytesOut.push(
					...biffRecord(OPCODE_LABELSST, [
						...u16le(r),
						...u16le(c),
						...u16le(cell.ixfe),
						...u16le(cell.value),
						0,
						0,
					]),
				);
			} else if (cell.kind === 'number') {
				const buffer = new ArrayBuffer(8);
				new DataView(buffer).setFloat64(0, cell.value, true);
				bytesOut.push(
					...biffRecord(OPCODE_NUMBER, [
						...u16le(r),
						...u16le(c),
						...u16le(cell.ixfe),
						...Array.from(new Uint8Array(buffer)),
					]),
				);
			} else {
				bytesOut.push(...biffRecord(OPCODE_BLANK, [...u16le(r), ...u16le(c), ...u16le(cell.ixfe)]));
			}
		}
	}

	// One DBCELL per <=32-row block (small embedded sheets are always one block in practice).
	if (rows.length > 0) {
		const dbCellOffset = bytesOut.length;
		const dbData: number[] = [0, 0, 0, 0]; // placeholder for the back-offset to the first ROW, filled below
		for (const off of firstCellOffsetPerRow) {
			dbData.push(...u16le(dbCellOffset - off));
		}
		const backToFirstRow = dbCellOffset - rowRecordOffsets[0]!;
		dbData[0] = backToFirstRow & 0xff;
		dbData[1] = (backToFirstRow >> 8) & 0xff;
		dbData[2] = (backToFirstRow >> 16) & 0xff;
		dbData[3] = (backToFirstRow >> 24) & 0xff;
		bytesOut.push(...biffRecord(OPCODE_DBCELL, dbData));
	}

	return Uint8Array.from(bytesOut);
}
