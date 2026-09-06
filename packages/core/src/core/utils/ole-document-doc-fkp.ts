/**
 * [MS-DOC] paragraph/character formatting exceptions (PAPX/CHPX) via their
 * "fast keyword pages" (FKP) for the legacy binary `.doc` editor.
 *
 * A run's formatting is looked up by byte offset ("FC") into the
 * `WordDocument` stream, not by CP: a coarse `PlcBtePapx`/`PlcBteChpx` table
 * (in the table stream, `(fc,lcb)` from the FIB) maps an FC range onto a
 * 512-byte page NUMBER; that page (physically IN the `WordDocument` stream,
 * at `pageNumber * 512`) then holds its own, finer-grained FC boundaries for
 * each run it covers, plus a byte offset to that run's PAPX/CHPX "blob"
 * elsewhere in the same page.
 *
 * The editor never decodes a blob's contents (the `sprm` opcodes inside):
 * it only needs to COPY the exact bytes of the edited paragraph's own blob
 * into a brand-new page for the newly-appended text range, which preserves
 * that paragraph's own formatting (and, for PAPX specifically, the
 * paragraph MARK's properties, which is where `pPr`-equivalent state such as
 * alignment and spacing lives in this format) without interpreting it.
 *
 * @module ole-document-doc-fkp
 */

const PAGE_SIZE = 512;

/** A `PlcBtePapx`/`PlcBteChpx`: FC range boundaries and the page number covering each range. */
export interface BteTable {
	/** n+1 ascending FC boundaries for n ranges. */
	fcs: number[];
	/** n page numbers, one per range. */
	pns: number[];
}

/** Parse a `PlcBtePapx`/`PlcBteChpx` at `(fc, lcb)` in a table stream. */
export function parseBteTable(tableStream: Uint8Array, at: { fc: number; lcb: number }): BteTable {
	const view = new DataView(tableStream.buffer, tableStream.byteOffset, tableStream.byteLength);
	const n = Math.floor((at.lcb - 4) / (4 + 4));
	const fcs: number[] = [];
	for (let i = 0; i <= n; i++) {
		fcs.push(view.getInt32(at.fc + i * 4, true));
	}
	const pns: number[] = [];
	for (let i = 0; i < n; i++) {
		pns.push(view.getUint32(at.fc + (n + 1) * 4 + i * 4, true));
	}
	return { fcs, pns };
}

/** Serialize a `PlcBtePapx`/`PlcBteChpx` back to bytes. */
export function buildBteTableBytes(table: BteTable): Uint8Array {
	const n = table.pns.length;
	const bytes = new Uint8Array((n + 1) * 4 + n * 4);
	const view = new DataView(bytes.buffer);
	for (let i = 0; i <= n; i++) {
		view.setInt32(i * 4, table.fcs[i]!, true);
	}
	for (let i = 0; i < n; i++) {
		view.setUint32((n + 1) * 4 + i * 4, table.pns[i]!, true);
	}
	return bytes;
}

/** Find which range (and thus page) of a BTE table covers `fc`. */
function findBteRangeIndex(table: BteTable, fc: number): number {
	for (let i = 0; i < table.pns.length; i++) {
		if (fc >= table.fcs[i]! && fc < table.fcs[i + 1]!) {
			return i;
		}
	}
	throw new Error(`FC ${fc} is not covered by any BTE range`);
}

/** Length in bytes of a `PapxInFkp` blob (including its own `cb`/`cb_` prefix), per [MS-DOC] 2.9.163. */
function papxBlobLength(page: Uint8Array, byteOffset: number): number {
	const cb = page[byteOffset]!;
	if (cb === 0) {
		const cbUnderscore = page[byteOffset + 1]!;
		return 2 + 2 * cbUnderscore;
	}
	return 1 + (2 * cb - 1);
}

/** Extract the exact `PapxInFkp` blob bytes (verbatim, uninterpreted) covering `fc` in a PAPX BTE table. */
export function extractPapxBlob(wordDoc: Uint8Array, papxBte: BteTable, fc: number): Uint8Array {
	const rangeIndex = findBteRangeIndex(papxBte, fc);
	const pageOffset = papxBte.pns[rangeIndex]! * PAGE_SIZE;
	const page = wordDoc.subarray(pageOffset, pageOffset + PAGE_SIZE);
	const crun = page[PAGE_SIZE - 1]!;
	const pageView = new DataView(page.buffer, page.byteOffset, page.byteLength);
	const rgbxOffset = (crun + 1) * 4;
	for (let i = 0; i < crun; i++) {
		const runFcStart = pageView.getInt32(i * 4, true);
		const runFcEnd = pageView.getInt32((i + 1) * 4, true);
		if (fc >= runFcStart && fc < runFcEnd) {
			const bOffsetWord = page[rgbxOffset + i * 13]!;
			const blobOffset = bOffsetWord * 2;
			return page.slice(blobOffset, blobOffset + papxBlobLength(page, blobOffset));
		}
	}
	throw new Error(`FC ${fc} is not covered by any run in PAPX page ${papxBte.pns[rangeIndex]}`);
}

/** Extract the exact `ChpxInFkp` blob bytes covering `fc` in a CHPX BTE table (empty array = default/no exceptions). */
export function extractChpxBlob(wordDoc: Uint8Array, chpxBte: BteTable, fc: number): Uint8Array {
	const rangeIndex = findBteRangeIndex(chpxBte, fc);
	const pageOffset = chpxBte.pns[rangeIndex]! * PAGE_SIZE;
	const page = wordDoc.subarray(pageOffset, pageOffset + PAGE_SIZE);
	const crun = page[PAGE_SIZE - 1]!;
	const pageView = new DataView(page.buffer, page.byteOffset, page.byteLength);
	const rgbOffset = (crun + 1) * 4;
	for (let i = 0; i < crun; i++) {
		const runFcStart = pageView.getInt32(i * 4, true);
		const runFcEnd = pageView.getInt32((i + 1) * 4, true);
		if (fc >= runFcStart && fc < runFcEnd) {
			const bOffsetWord = page[rgbOffset + i]!;
			if (bOffsetWord === 0) {
				return new Uint8Array(0);
			}
			const blobOffset = bOffsetWord * 2;
			const cb = page[blobOffset]!;
			return page.slice(blobOffset, blobOffset + 1 + cb);
		}
	}
	throw new Error(`FC ${fc} is not covered by any run in CHPX page ${chpxBte.pns[rangeIndex]}`);
}

/** Build a brand-new, single-run PAPX FKP page covering `[fcStart, fcEnd)`, carrying `blob` verbatim. */
export function buildSingleRunPapxPage(
	fcStart: number,
	fcEnd: number,
	blob: Uint8Array,
): Uint8Array {
	const page = new Uint8Array(PAGE_SIZE);
	const view = new DataView(page.buffer);
	view.setInt32(0, fcStart, true);
	view.setInt32(4, fcEnd, true);
	const blobByteOffset = 22; // (crun+1)*4 + crun*13 = 21, rounded up to the next even (word) offset.
	page[8] = blobByteOffset / 2;
	page.set(blob, blobByteOffset);
	page[PAGE_SIZE - 1] = 1;
	return page;
}

/** Build a brand-new, single-run CHPX FKP page covering `[fcStart, fcEnd)`, carrying `blob` verbatim (empty = default formatting). */
export function buildSingleRunChpxPage(
	fcStart: number,
	fcEnd: number,
	blob: Uint8Array,
): Uint8Array {
	const page = new Uint8Array(PAGE_SIZE);
	const view = new DataView(page.buffer);
	view.setInt32(0, fcStart, true);
	view.setInt32(4, fcEnd, true);
	if (blob.length > 0) {
		const blobByteOffset = 10; // (crun+1)*4 + crun*1 = 9, rounded up to the next even (word) offset.
		page[8] = blobByteOffset / 2;
		page.set(blob, blobByteOffset);
	}
	page[PAGE_SIZE - 1] = 1;
	return page;
}
