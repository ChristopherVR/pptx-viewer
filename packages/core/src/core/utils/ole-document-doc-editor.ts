/**
 * In-place paragraph text editing for an embedded legacy binary Word
 * document (`Word.Document.8` / `.doc`, Word 97-2003) OLE payload.
 *
 * Companion to `ole-document-docx-editor.ts` (the modern `.docx` editor):
 * same public shape (`readOleDocParagraphs` / `writeOleDocParagraphEdit`,
 * `-Doc-` naming to keep the two apart), very different mechanics, because
 * `.doc` has no XML body to patch. Ground truth for every structure this
 * module reads or writes was a real Word-COM-authored `.doc`, dumped and
 * decoded byte-by-byte against [MS-DOC] (see module docs on
 * `ole-document-doc-fib.ts`, `-pieces.ts`, `-fkp.ts`, `-cfb.ts`).
 *
 * ## Write strategy (why it is safe)
 *
 * A `.doc` edit never rewrites existing bytes in place: it APPENDS the new
 * paragraph text (plus a fresh paragraph mark) as a brand-new "piece" at the
 * end of the `WordDocument` stream, together with a brand-new single-run
 * PAPX/CHPX formatting page copied VERBATIM from the edited paragraph's own
 * original formatting (so alignment/spacing/font survive, mirroring the
 * `.docx` editor's "keep `w:pPr`, reuse the first run's `w:rPr`" scope), then
 * rewrites the piece table (and only the piece table: FKP bookkeeping tables
 * are extended, not rewritten) so the OLD range is simply unreferenced. This
 * is exactly the shape of a real Word "fast save" and was chosen because it
 * never has to shift or reinterpret bytes it does not fully understand.
 *
 * ## Scope limits (checked, not assumed)
 *
 * Only edits a document whose only populated character-position-keyed table
 * is the (mandatory, always present) section table `PlcfSed`, which this
 * module updates correctly for any number of sections. A document that also
 * uses footnotes, comments/annotations, fields, or bookmarks is left
 * UNCHANGED (`writeOleDocParagraphEdit` returns the original bytes): those
 * features add their own character-position-keyed tables that a paragraph
 * edit's character-count shift would silently invalidate, and this module
 * has not been verified against a real Word round trip for that case. Reading
 * (`readOleDocParagraphs`) has no such restriction.
 *
 * @module ole-document-doc-editor
 */
import { unwrapDocBytes } from './ole-document-doc-cfb';
import { readDocFib, readFcLcbAt, patchDocFib } from './ole-document-doc-fib';
import type { DocFib, FcLcb } from './ole-document-doc-fib';
import {
	buildBteTableBytes,
	buildSingleRunChpxPage,
	buildSingleRunPapxPage,
	extractChpxBlob,
	extractPapxBlob,
	parseBteTable,
} from './ole-document-doc-fkp';
import {
	buildClxBytes,
	decodePiecesText,
	encodePieceText,
	parsePieceTable,
	replacePieceRange,
} from './ole-document-doc-pieces';
import type { DocPiece } from './ole-document-doc-pieces';

/** [MS-DOC] 2.5.3 `FibRgFcLcb97` indices for features this editor refuses to edit around (see module doc). */
const RISKY_PLCF_INDICES = [3, 4, 5, 16, 17, 18, 19, 20]; // fndTxt, andRef, andTxt, fld{Mom,Hdr,Ftn,Atn,Mcr}
const RISKY_STTB_INDICES = [21, 22, 23]; // bkmk sttb, bkf, bkl

function hasUnsupportedFeatures(wordDoc: Uint8Array, fib: DocFib): boolean {
	// A trivial/empty PLCF is still (n+1)*4 = 4 bytes (a single sentinel CP);
	// anything larger means the document actually uses the feature.
	for (const index of RISKY_PLCF_INDICES) {
		if (readFcLcbAt(wordDoc, fib, index).lcb > 4) {
			return true;
		}
	}
	for (const index of RISKY_STTB_INDICES) {
		if (readFcLcbAt(wordDoc, fib, index).lcb > 0) {
			return true;
		}
	}
	return false;
}

/** Locate the piece covering CP `cp`, and its byte (FC) offset within `WordDocument`. */
function pieceAndFcAtCp(pieces: readonly DocPiece[], cp: number): { piece: DocPiece; fc: number } {
	for (const piece of pieces) {
		if (cp >= piece.cpStart && cp < piece.cpEnd) {
			const unit = piece.compressed ? 1 : 2;
			return { piece, fc: piece.fc + (cp - piece.cpStart) * unit };
		}
	}
	throw new Error(`CP ${cp} is not covered by any piece`);
}

/** Paragraph boundaries (CP just past each paragraph mark) within the main body text `[0, ccpText)`. */
function paragraphBoundaries(bodyText: string): number[] {
	const boundaries: number[] = [];
	for (let i = 0; i < bodyText.length; i++) {
		if (bodyText[i] === '\r') {
			boundaries.push(i + 1);
		}
	}
	if (boundaries[boundaries.length - 1] !== bodyText.length && bodyText.length > 0) {
		boundaries.push(bodyText.length);
	}
	return boundaries;
}

/** Read every main-body paragraph's plain text (paragraph mark excluded) from an embedded `.doc` payload. */
export function readOleDocParagraphs(docBytes: Uint8Array): string[] | undefined {
	try {
		const cfb = unwrapDocBytes(docBytes);
		if (!cfb) {
			return undefined;
		}
		const fib = readDocFib(cfb.wordDocBytes);
		const pieces = parsePieceTable(cfb.tableBytes, fib.clx);
		const fullText = decodePiecesText(cfb.wordDocBytes, pieces);
		const bodyText = fullText.slice(0, fib.ccpText);
		const boundaries = paragraphBoundaries(bodyText);
		let start = 0;
		const paragraphs: string[] = [];
		for (const end of boundaries) {
			const raw = bodyText.slice(start, end);
			paragraphs.push(raw.endsWith('\r') ? raw.slice(0, -1) : raw);
			start = end;
		}
		return paragraphs;
	} catch {
		return undefined;
	}
}

/** Shift (or leave alone) every CP in a `PlcfSed`'s boundary array in place, for a same-size character-count-changing edit. */
function shiftSectionTableCps(
	tableBytes: Uint8Array,
	sed: FcLcb,
	editEndCp: number,
	delta: number,
): void {
	const view = new DataView(tableBytes.buffer, tableBytes.byteOffset, tableBytes.byteLength);
	const n = Math.floor((sed.lcb - 4) / (4 + 12));
	for (let i = 0; i <= n; i++) {
		const off = sed.fc + i * 4;
		const cp = view.getInt32(off, true);
		if (cp >= editEndCp) {
			view.setInt32(off, cp + delta, true);
		}
	}
}

/**
 * Replace one main-body paragraph's text in an embedded `.doc` payload,
 * preserving that paragraph's own paragraph/character formatting (see module
 * doc). Returns the original bytes unchanged if the edit could not be safely
 * applied (unreadable payload, out-of-range paragraph index, or a document
 * feature this editor does not support around, per module doc).
 */
export function writeOleDocParagraphEdit(
	docBytes: Uint8Array,
	paragraphIndex: number,
	text: string,
): Uint8Array {
	try {
		const cfb = unwrapDocBytes(docBytes);
		if (!cfb) {
			return docBytes;
		}
		const fib = readDocFib(cfb.wordDocBytes);
		if (hasUnsupportedFeatures(cfb.wordDocBytes, fib)) {
			return docBytes;
		}

		const pieces = parsePieceTable(cfb.tableBytes, fib.clx);
		const fullText = decodePiecesText(cfb.wordDocBytes, pieces);
		const bodyText = fullText.slice(0, fib.ccpText);
		const boundaries = paragraphBoundaries(bodyText);
		const paragraphEndCp = boundaries[paragraphIndex];
		if (paragraphEndCp === undefined) {
			return docBytes;
		}
		const paragraphStartCp = paragraphIndex === 0 ? 0 : boundaries[paragraphIndex - 1]!;

		const { piece: startPiece, fc: startFc } = pieceAndFcAtCp(pieces, paragraphStartCp);
		const papxBte = parseBteTable(cfb.tableBytes, fib.plcfbtePapx);
		const chpxBte = parseBteTable(cfb.tableBytes, fib.plcfbteChpx);
		const papxBlob = extractPapxBlob(cfb.wordDocBytes, papxBte, startFc);
		const chpxBlob = extractChpxBlob(cfb.wordDocBytes, chpxBte, startFc);

		const sanitizedText = text.replaceAll(/[\r\n]+/gu, ' ');
		const { bytes: textBytes, compressed } = encodePieceText(`${sanitizedText}\r`);

		const originalLen = cfb.wordDocBytes.length;
		const newTextFc = originalLen;
		const afterText = originalLen + textBytes.length;
		const padLen = (512 - (afterText % 512)) % 512;
		const papxPageOffset = afterText + padLen;
		const chpxPageOffset = papxPageOffset + 512;
		const newWordDocLen = chpxPageOffset + 512;

		const newWordDoc = new Uint8Array(newWordDocLen);
		newWordDoc.set(cfb.wordDocBytes, 0);
		newWordDoc.set(textBytes, originalLen);
		newWordDoc.set(buildSingleRunPapxPage(newTextFc, afterText, papxBlob), papxPageOffset);
		newWordDoc.set(buildSingleRunChpxPage(newTextFc, afterText, chpxBlob), chpxPageOffset);

		const newPapxPageNumber = papxPageOffset / 512;
		const newChpxPageNumber = chpxPageOffset / 512;
		// Extend the LAST existing range's boundary forward to `newTextFc`
		// (rather than inserting a separate filler range for the dead space
		// between the old text and the newly appended piece): a real
		// Word-COM round trip rejected the 3-range/filler-page form as
		// corrupt, while stretching the existing last range to reuse its own
		// page number for the now-larger, still just-two-ranges-longer table
		// opens cleanly. Nothing ever looks up an FC in the dead zone (no
		// piece maps there), so which page nominally "covers" it is moot;
		// what matters is which SHAPE of BTE table Word accepts.
		const newPapxBte = {
			fcs: [...papxBte.fcs.slice(0, -1), newTextFc, afterText],
			pns: [...papxBte.pns, newPapxPageNumber],
		};
		const newChpxBte = {
			fcs: [...chpxBte.fcs.slice(0, -1), newTextFc, afterText],
			pns: [...chpxBte.pns, newChpxPageNumber],
		};

		const newPieces = replacePieceRange(pieces, paragraphStartCp, paragraphEndCp, {
			fc: newTextFc,
			compressed,
			charLength: sanitizedText.length + 1,
			flagsWord: startPiece.flagsWord,
		});
		const delta = sanitizedText.length + 1 - (paragraphEndCp - paragraphStartCp);
		const newCcpText = fib.ccpText + delta;

		const clxBytes = buildClxBytes(newPieces);
		const papxBteBytes = buildBteTableBytes(newPapxBte);
		const chpxBteBytes = buildBteTableBytes(newChpxBte);

		const newTableBytes = new Uint8Array(
			cfb.tableBytes.length + clxBytes.length + papxBteBytes.length + chpxBteBytes.length,
		);
		newTableBytes.set(cfb.tableBytes, 0);
		let tableOff = cfb.tableBytes.length;
		const newClx: FcLcb = { fc: tableOff, lcb: clxBytes.length };
		newTableBytes.set(clxBytes, tableOff);
		tableOff += clxBytes.length;
		const newPapxBteFcLcb: FcLcb = { fc: tableOff, lcb: papxBteBytes.length };
		newTableBytes.set(papxBteBytes, tableOff);
		tableOff += papxBteBytes.length;
		const newChpxBteFcLcb: FcLcb = { fc: tableOff, lcb: chpxBteBytes.length };
		newTableBytes.set(chpxBteBytes, tableOff);

		shiftSectionTableCps(newTableBytes, fib.sed, paragraphEndCp, delta);

		patchDocFib(newWordDoc, fib, {
			ccpText: newCcpText,
			cbMac: newWordDocLen,
			clx: newClx,
			plcfbteChpx: newChpxBteFcLcb,
			plcfbtePapx: newPapxBteFcLcb,
		});

		return cfb.rewrap(newWordDoc, newTableBytes);
	} catch {
		return docBytes;
	}
}
