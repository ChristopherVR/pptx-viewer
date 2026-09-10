/**
 * Reader-side counterpart to `writer/ole-writer.ts`: parses the
 * document-level `ExObjListContainer` into a lookup table of OLE embed
 * references keyed by `exObjId` (mirrors `hyperlink-parser.ts`'s
 * `parseHyperlinkStrings`), then resolves one reference's `ExOleObjStg`
 * persist object into the recovered storage bytes.
 *
 * Deliberately stops at "recovered storage bytes" rather than also
 * unwrapping a "Package" object's `Ole10Native` wrapper: those raw bytes are
 * written verbatim as the synthesized PPTX's OLE embedding part
 * (`pptx/package-writer.ts`), and the existing OOXML load pipeline
 * (`PptxHandlerRuntimeLoadSession.ts`'s `unwrapOleEmbedding` call) already
 * does that unwrap once, so this module does not need a second copy of it.
 *
 * @module ppt/ole-embed-parser
 */

import { isOle2CompoundFile } from '../utils/ole-embedded-extract';
import { ENTRY_TYPE_ROOT, parseOle2 } from '../utils/ole2-parser';
import { inflateZlib } from './deflate-utils';
import type { PersistDirectory } from './persist-directory';
import { readPersistRecord } from './persist-directory';
import type { PptAnyShape, PptOleEmbedData } from './ppt-model';
import { findChild, iterateChildren, recordBytes } from './record-stream';
import type { PptRecord } from './record-stream';
import { RT } from './record-types';
import { decodeTextChars } from './text/text-atoms';

/** One `ExOleEmbedContainer` entry, before its storage bytes are resolved. */
export interface OleEmbedRef {
	/** Persist id of this embed's `ExOleObjStg` (from `ExOleObjAtom`). */
	persistIdRef: number;
	/** `ProgIDAtom` string (recInstance 2 `CString`), when present. */
	progId?: string;
}

function readCString(view: DataView, rec: PptRecord): string {
	return decodeTextChars(view, rec.dataOffset, rec.recLen);
}

/** Parse one `ExOleEmbedContainer`'s `ExOleObjAtom` (recVer=1, 24 bytes) plus its `ProgIDAtom`. */
function parseOleEmbedContainer(
	view: DataView,
	container: PptRecord,
): { exObjId: number; ref: OleEmbedRef } | undefined {
	const atom = findChild(view, container, RT.ExternalOleObjectAtom);
	if (!atom || atom.recLen < 24) {
		return undefined;
	}
	// Field layout mirrors `ole-writer.ts#buildExOleObjAtom`: dvAspect(4),
	// oleType(4), exObjId(4), subType(4), persistIdRef(4), unused(4).
	const exObjId = view.getUint32(atom.dataOffset + 8, true);
	const persistIdRef = view.getUint32(atom.dataOffset + 16, true);
	const progIdRec = findChild(view, container, RT.CString, 2);
	const progId = progIdRec ? readCString(view, progIdRec) : undefined;
	return { exObjId, ref: { persistIdRef, progId } };
}

/**
 * Parse the document-level `ExObjListContainer`, if present, into a lookup
 * table of OLE embed references keyed by `exObjId`. Non-OLE
 * `ExObjListSubContainer` entries (hyperlinks, media, ActiveX) are skipped;
 * they are read elsewhere.
 */
export function parseOleEmbedRefs(
	view: DataView,
	docContainer: PptRecord,
): Map<number, OleEmbedRef> {
	const result = new Map<number, OleEmbedRef>();
	const exObjList = findChild(view, docContainer, RT.ExternalObjectList);
	if (!exObjList) {
		return result;
	}
	for (const child of iterateChildren(view, exObjList)) {
		if (child.recType !== RT.ExternalOleEmbed) {
			continue;
		}
		const parsed = parseOleEmbedContainer(view, child);
		if (parsed) {
			result.set(parsed.exObjId, parsed.ref);
		}
	}
	return result;
}

/** Format a 16-byte CLSID as `XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`, or undefined when all-zero/short. */
function clsidToString(clsid: Uint8Array): string | undefined {
	if (clsid.length < 16 || clsid.every((b) => b === 0)) {
		return undefined;
	}
	const view = new DataView(clsid.buffer, clsid.byteOffset, clsid.byteLength);
	const d1 = view.getUint32(0, true).toString(16).padStart(8, '0');
	const d2 = view.getUint16(4, true).toString(16).padStart(4, '0');
	const d3 = view.getUint16(6, true).toString(16).padStart(4, '0');
	let d4 = '';
	for (let i = 8; i < 16; i++) {
		d4 += clsid[i].toString(16).padStart(2, '0');
	}
	return `${d1}-${d2}-${d3}-${d4.slice(0, 4)}-${d4.slice(4)}`.toUpperCase();
}

/**
 * Resolve one OLE embed reference's `ExOleObjStg` persist object into the
 * recovered storage bytes (decompressing when `recInstance === 1`, i.e. an
 * `ExOleObjStgCompressedAtom`: a 4-byte decompressed-size prefix followed by
 * a zlib-wrapped DEFLATE stream, the same convention `pictures.ts` uses for
 * metafile BLIPs). Also recovers the nested storage's root CLSID when the
 * bytes are themselves a valid OLE2 compound file (true for both this
 * project's own "Package" wrapper and a real native embed like
 * `Excel.Sheet.8`), so the synthesized `<p:oleObj>` can carry a `classid`
 * even when the `ProgIDAtom` alone is not descriptive.
 *
 * @returns undefined when the persist id does not resolve to an
 *   `ExOleObjStg`, or decompression fails.
 */
export async function resolveOleEmbedStorage(
	view: DataView,
	data: Uint8Array,
	directory: PersistDirectory,
	ref: OleEmbedRef,
): Promise<PptOleEmbedData | undefined> {
	const rec = readPersistRecord(view, directory, ref.persistIdRef);
	if (!rec || rec.recType !== RT.ExternalOleObjectStg) {
		return undefined;
	}
	let bytes = recordBytes(data, rec);
	if (rec.recInstance === 1) {
		if (bytes.length < 4) {
			return undefined;
		}
		const inflated = await inflateZlib(bytes.subarray(4));
		if (!inflated) {
			return undefined;
		}
		bytes = inflated;
	} else {
		bytes = bytes.slice();
	}

	let clsId: string | undefined;
	if (isOle2CompoundFile(bytes)) {
		try {
			const buffer = bytes.buffer.slice(
				bytes.byteOffset,
				bytes.byteOffset + bytes.byteLength,
			) as ArrayBuffer;
			const nested = parseOle2(buffer);
			const root = nested.entries.find((e) => e.type === ENTRY_TYPE_ROOT);
			clsId = root ? clsidToString(root.clsid) : undefined;
		} catch {
			// Not a well-formed nested compound file; keep the raw bytes as-is.
		}
	}

	return { data: bytes, progId: ref.progId, clsId };
}

/** Recursively collect every distinct `exObjId` referenced by an `ole` shape in a shape tree. */
export function collectOleExObjIds(shapes: PptAnyShape[], into: Set<number>): void {
	for (const shape of shapes) {
		if (shape.kind === 'ole') {
			into.add(shape.exObjId);
		} else if (shape.kind === 'group') {
			collectOleExObjIds(shape.children, into);
		}
	}
}
