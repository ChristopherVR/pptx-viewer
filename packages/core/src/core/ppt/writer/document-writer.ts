/**
 * DocumentContainer writer, the inverse of `document-parser.ts`.
 *
 * @module ppt/writer/document-writer
 */

import { RT, EMU_PER_MASTER } from '../record-types';
import { ByteWriter, record } from './byte-writer';
import { buildEnvironment } from './font-collection-writer';

function emuToMaster(emu: number): number {
	return Math.round(emu / EMU_PER_MASTER);
}

function buildDocumentAtom(widthEmu: number, heightEmu: number): Uint8Array {
	const w = emuToMaster(widthEmu);
	const h = emuToMaster(heightEmu);
	const data = new ByteWriter()
		.i32(w)
		.i32(h)
		.i32(h) // notes size: portrait, width = slide height
		.i32(w)
		.i32(1) // server zoom numerator
		.i32(2) // server zoom denominator
		.i32(0) // notesMasterPersistIdRef
		.i32(0) // handoutMasterPersistIdRef
		.i16(1) // firstSlideNum
		.i16(0) // slideSizeType: onscreen show
		.u8(0) // saveWithFonts
		.u8(0) // omitTitlePlace
		.u8(0) // rightToLeft
		.u8(0) // showComments
		.toBytes();
	return record(RT.DocumentAtom, data, 0, false, 1);
}

/**
 * Sentinel base for a MAIN MASTER's `SlidePersistAtom.slideId`. Real
 * (COM-written) files use this high-bit-set range for every master, kept
 * entirely disjoint from the small positive slide-id range (conventionally
 * starting at 256) that real slides use. This writer's earlier behaviour
 * gave the master the SAME `slideId` (256) as the first real slide: two
 * different persist objects sharing one slide id, which real PowerPoint's
 * COM `Presentations.Open` rejected with an unhelpful generic COM error
 * (confirmed by reverse bisection against a COM-authored fixture: pairing
 * 100% real Document/MainMaster/Slide content with this writer's own
 * persist-directory/user-edit/current-user layer still failed until the
 * master's colliding slideId was the only remaining difference).
 */
export const MASTER_SLIDE_ID_SENTINEL = 0x80000000;

/**
 * Build one SlidePersistAtom referencing `persistIdRef`.
 *
 * @param flags - Real (COM-written) files set bit 0x4 on a SLIDE's own entry
 *   (not a master's); this writer previously always wrote 0.
 */
export function buildSlidePersistAtom(
	persistIdRef: number,
	slideId: number,
	flags = 0,
): Uint8Array {
	const data = new ByteWriter().u32(persistIdRef).u32(flags).u32(0).u32(slideId).u32(0).toBytes();
	return record(RT.SlidePersistAtom, data, 0, false, 0);
}

/** Build a SlideListWithText container (instance 0 = slides, 1 = masters). */
export function buildSlideListWithText(persistAtoms: Uint8Array[], instance: 0 | 1): Uint8Array {
	const data = new ByteWriter();
	for (const atom of persistAtoms) {
		data.bytes(atom);
	}
	return record(RT.SlideListWithText, data.toBytes(), instance, true);
}

/** `[MS-PPT]` record types this module needs that `record-types.ts` doesn't
 * name (both confirmed against a COM-authored fixture's own real
 * `ProgTags` -> `ProgBinaryTag` -> `CString` + `BinaryTagDataBlob` chain,
 * used there for PowerPoint's own "___PPT10" compatibility tag). */
const RT_CSTRING = 0x0fba;
const RT_BINARY_TAG_DATA_BLOB = 0x138b;

/**
 * Build a padding `ProgTags` record of approximately `size` total bytes
 * (header included), used purely as content padding; see `paddingBytes`
 * below. `ProgTags` -> `ProgBinaryTag` -> `CString` (tag name) +
 * `BinaryTagDataBlob` (arbitrary payload) is PowerPoint's OWN documented
 * extensibility mechanism for attaching arbitrary named data to a document
 * (real files use it for their own compatibility tags, see above): reusing
 * it for padding reads as ordinary (if third-party/unrecognised) tag data
 * to PowerPoint, unlike two things this writer tried first and rejected
 * after direct COM testing: raw unreferenced trailing bytes past every
 * declared record (Office File Validation rejected the file outright), and
 * a zero-filled `List` record marked as either a container (its zero bytes
 * parse as a run of malformed zero-length child records) or an atom
 * (Office File Validation rejected it too, for a reason this project could
 * not further isolate).
 */
function buildPaddingTag(size: number): Uint8Array {
	const tagName = '___PPTXPAD'; // arbitrary, UTF-16LE encoded below
	const nameBytes = new Uint8Array(tagName.length * 2);
	const nameView = new DataView(nameBytes.buffer);
	for (let i = 0; i < tagName.length; i++) {
		nameView.setUint16(i * 2, tagName.charCodeAt(i), true);
	}
	const nameRecord = record(RT_CSTRING, nameBytes, 0, false, 0);
	const fixedOverhead = 8 + 8 + nameRecord.length + 8; // ProgTags + ProgBinaryTag + CString + BinaryTagDataBlob headers
	const blobData = new Uint8Array(Math.max(0, size - fixedOverhead));
	const blobRecord = record(RT_BINARY_TAG_DATA_BLOB, blobData, 0, false, 0);
	const progBinaryTag = record(
		RT.ProgBinaryTag,
		new ByteWriter().bytes(nameRecord).bytes(blobRecord).toBytes(),
		0,
		true,
	);
	return record(RT.ProgTags, progBinaryTag, 0, true);
}

/**
 * Build the framed `DocumentContainer`.
 *
 * @param dggContainer - The picture store's `OfficeArtDggContainer` bytes
 *   (see `bstore-writer.ts`), embedded inside a `DrawingGroup` record.
 * @param paddingBytes - Approximate total bytes to insert as a padding
 *   `ProgTags` record (0 to omit it entirely). See `document-stream-layout.ts`'s
 *   `ensureMinimumDocumentStreamSize` for why this exists: a from-scratch
 *   deck small enough that "PowerPoint Document" would tie or undercut
 *   "Current User"'s CFB sector count fails to open in real PowerPoint.
 * @param exObjList - The document-wide `ExObjListContainer` (see
 *   `hyperlink-writer.ts#buildExObjList`), when any hyperlink/click-action
 *   was written anywhere in the deck. Placed immediately after
 *   `DocumentAtom`, matching a COM-authored ground-truth fixture's own
 *   `DocumentContainer` child order (`DocumentAtom`, `ExObjListContainer`,
 *   `DocumentTextInfoContainer`/Environment, `SoundCollectionContainer`,
 *   `DrawingGroupContainer`, ...).
 * @param soundCollection - The document-wide `SoundCollectionContainer` (see
 *   `media-writer.ts#buildSoundCollection`), when any audio was embedded
 *   anywhere in the deck. Placed right after Environment, matching the same
 *   ground-truth fixture's child order.
 */
export function buildDocumentContainer(input: {
	widthEmu: number;
	heightEmu: number;
	fonts: string[];
	masterPersistAtom: Uint8Array;
	slidePersistAtoms: Uint8Array[];
	dggContainer: Uint8Array;
	paddingBytes?: number;
	exObjList?: Uint8Array;
	soundCollection?: Uint8Array;
}): Uint8Array {
	const drawingGroup = record(RT.DrawingGroup, input.dggContainer, 0, true);
	// A real (COM-written) DocumentContainer's LAST child is always a
	// (zero-length) EndDocumentAtom. Omitting it (this writer's earlier
	// behaviour) failed real PowerPoint's Office File Validation outright,
	// confirmed fixed by COM re-verification.
	const endDocumentAtom = record(RT.EndDocumentAtom, new Uint8Array(0), 0, false, 0);
	const w = new ByteWriter().bytes(buildDocumentAtom(input.widthEmu, input.heightEmu));
	if (input.exObjList) {
		w.bytes(input.exObjList);
	}
	w.bytes(buildEnvironment(input.fonts));
	if (input.soundCollection) {
		w.bytes(input.soundCollection);
	}
	w.bytes(drawingGroup).bytes(buildSlideListWithText([input.masterPersistAtom], 1));
	if (input.paddingBytes) {
		w.bytes(buildPaddingTag(input.paddingBytes));
	}
	w.bytes(buildSlideListWithText(input.slidePersistAtoms, 0)).bytes(endDocumentAtom);
	return record(RT.Document, w.toBytes(), 0, true);
}
