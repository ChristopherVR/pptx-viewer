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

/** Build one SlidePersistAtom referencing `persistIdRef`. */
export function buildSlidePersistAtom(persistIdRef: number, slideId: number): Uint8Array {
	const data = new ByteWriter().u32(persistIdRef).u32(0).u32(0).u32(slideId).u32(0).toBytes();
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

/**
 * Build the framed `DocumentContainer`.
 *
 * @param dggContainer - The picture store's `OfficeArtDggContainer` bytes
 *   (see `bstore-writer.ts`), embedded inside a `DrawingGroup` record.
 */
export function buildDocumentContainer(input: {
	widthEmu: number;
	heightEmu: number;
	fonts: string[];
	masterPersistAtom: Uint8Array;
	slidePersistAtoms: Uint8Array[];
	dggContainer: Uint8Array;
}): Uint8Array {
	const drawingGroup = record(RT.DrawingGroup, input.dggContainer, 0, true);
	// A real (COM-written) DocumentContainer's LAST child is always a
	// (zero-length) EndDocumentAtom. Omitting it (this writer's earlier
	// behaviour) failed real PowerPoint's Office File Validation outright,
	// confirmed fixed by COM re-verification.
	const endDocumentAtom = record(RT.EndDocumentAtom, new Uint8Array(0), 0, false, 0);
	const data = new ByteWriter()
		.bytes(buildDocumentAtom(input.widthEmu, input.heightEmu))
		.bytes(buildEnvironment(input.fonts))
		.bytes(drawingGroup)
		.bytes(buildSlideListWithText([input.masterPersistAtom], 1))
		.bytes(buildSlideListWithText(input.slidePersistAtoms, 0))
		.bytes(endDocumentAtom)
		.toBytes();
	return record(RT.Document, data, 0, true);
}
