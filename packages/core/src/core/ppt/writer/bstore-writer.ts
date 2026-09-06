/**
 * Picture store writer: the `Pictures` stream (raw BLIP records) plus the
 * `OfficeArtBStoreContainer` (FBSE list) that indexes it from the
 * `PowerPoint Document` stream's drawing group, the inverse of
 * `pictures.ts`.
 *
 * Only PNG and JPEG are embedded as-is; `element-to-write-model.ts` is
 * responsible for only ever placing those two extensions in
 * `WDeck.pictures` (anything else is degraded to a placeholder shape with a
 * compatibility warning before it reaches this module).
 *
 * @module ppt/writer/bstore-writer
 */

import { OA } from '../record-types';
import { ByteWriter, record } from './byte-writer';
import { buildFopt } from './fopt-writer';
import type { WPictureData } from './write-model';

/**
 * Build the `DggContainer`'s own default-properties `FOPT`, sitting between
 * `Dgg` and `SplitMenuColors`. Present in every real (COM-written)
 * `DggContainer` this project has inspected, with these exact six
 * properties and values; this writer omitted it entirely before, confirmed
 * required (not merely decorative) by reverse bisection against a
 * COM-authored fixture: splicing ONLY this record in, with every other byte
 * of an otherwise 100%-real file left untouched (a from-scratch `Dgg`
 * matching the real file's own per-drawing shape counts, everything else
 * A's own bytes), was what made `Presentations.Open` accept it. The exact
 * field semantics (each value's high byte looks like a "used" bit paired
 * with a boolean in the low word, matching this codebase's own
 * `boolPropValue` convention elsewhere) are plausible but unconfirmed;
 * treat the six entries as a fixed default this writer always emits, not a
 * per-document computation.
 */
function buildDggDefaultProperties(): Uint8Array {
	return buildFopt([
		{ id: 385, value: 0x08000004 }, // fillColor
		{ id: 387, value: 0x08000000 }, // fillBackColor
		{ id: 447, value: 0x00100010 }, // fNoFillHitTest
		{ id: 448, value: 0x08000001 }, // lineColor
		{ id: 511, value: 0x00080008 }, // fNoLineDrawDash
		{ id: 513, value: 0x08000002 }, // unidentified, not in this writer's OPT map
	]);
}

/**
 * Build the `OfficeArtSplitMenuColorContainer` (4 default UI colours: fill,
 * line, shadow, 3D). Present in every real (COM-written) `DggContainer`
 * this project has inspected; this writer omitted it entirely before.
 *
 * The four values are SCHEME-INDEXED colour references (high byte `0x08` /
 * `0x10` marks "this is a scheme colour index", not a literal RGB triple),
 * copied verbatim from a COM-authored fixture: this writer's earlier
 * literal-RGB encoding (via `encodeColorRef`) produced a different byte
 * pattern than every real file this project has inspected.
 */
function buildSplitMenuColors(): Uint8Array {
	const data = new ByteWriter()
		.u32(0x08000004)
		.u32(0x08000001)
		.u32(0x08000002)
		.u32(0x100000f7)
		.toBytes();
	return record(OA.SplitMenuColors, data, 4, false, 0);
}

const BLIP_INFO: Record<WPictureData['extension'], { recType: number; instance: number }> = {
	png: { recType: OA.BlipPng, instance: 0x6e0 },
	jpg: { recType: OA.BlipJpeg, instance: 0x46a },
};

function buildBlip(picture: WPictureData): Uint8Array {
	const info = BLIP_INFO[picture.extension];
	const data = new ByteWriter()
		.bytes(new Uint8Array(16)) // rgbUid: not spec-critical for opening/rendering
		.u8(0xff) // tag
		.bytes(picture.bytes)
		.toBytes();
	return record(info.recType, data, info.instance, false, 2);
}

function buildFbse(picture: WPictureData, foDelay: number, size: number): Uint8Array {
	const data = new ByteWriter()
		.u8(picture.extension === 'png' ? 0x06 : 0x05) // btWin32
		.u8(picture.extension === 'png' ? 0x06 : 0x05) // btMacOS
		.bytes(new Uint8Array(16)) // rgbUid
		.u16(0xff) // tag
		.u32(size)
		.u32(1) // cRef
		.u32(foDelay)
		.u8(0) // usage: default
		.u8(0) // cbName
		.u8(0)
		.u8(0)
		.toBytes();
	return record(OA.FBSE, data, 2, false, 2);
}

/** Shape-id budget allocated per drawing; must match `drawing-writer.ts`'s own constant. */
const SHAPE_ID_CLUSTER_SIZE = 1024;

/**
 * Build the `OfficeArtFDGGBlock` (Dgg atom): one `OfficeArtIDCL` cluster per
 * drawing (`dgid` = drawing id, matching `drawing-writer.ts#buildDrawing`'s
 * `drawingId`).
 *
 * A cluster's second field is the COUNT of shape ids actually used in that
 * drawing (patriarch included), NOT the top of its 1024-wide budget: real
 * (COM-written) files show small per-drawing counts (a master with 6 real
 * shapes writes 7, i.e. `shapesPerDrawing[i]`), confirmed by reverse
 * bisection against a COM-authored fixture (this writer's earlier behaviour,
 * `drawingId * SHAPE_ID_CLUSTER_SIZE`, wrote the full budget ceiling instead
 * and real PowerPoint's `Presentations.Open` rejected the result with a bare
 * COM HRESULT, no Office File Validation message, so no earlier COM
 * re-verification pass had caught it). `spidMax` (the header's own
 * one-past-the-highest-used shape id across the whole document) follows the
 * same convention for the LAST drawing: its patriarch is `drawingCount *
 * SHAPE_ID_CLUSTER_SIZE` (see `ShapeIdAllocator`), so one past its highest
 * used id is that plus its own shape count.
 */
function buildDgg(shapesPerDrawing: number[], totalShapes: number): Uint8Array {
	const drawingCount = shapesPerDrawing.length;
	const lastDrawingShapeCount = shapesPerDrawing[drawingCount - 1] ?? 0;
	const maxShapeId = drawingCount * SHAPE_ID_CLUSTER_SIZE + lastDrawingShapeCount;
	// cidcl ([MS-ODRAW] OfficeArtFDGGBlock.cidcl) is documented as the number
	// of OfficeArtIDCL cluster structures PLUS ONE (a conceptual cluster 0,
	// for drawing id 0, is counted but never written): confirmed against a
	// COM-authored fixture with 13 real clusters declaring cidcl=14. This
	// writer previously wrote the raw cluster count, off by one low.
	//
	// cspSaved (`totalShapes` here includes each drawing's patriarch) counts
	// only the REAL, non-patriarch shapes across the whole document: also
	// confirmed against the same fixture (74 for 12 masters x 6 real shapes +
	// 1 slide x 2 real shapes, not 87 = the patriarch-inclusive total this
	// writer previously wrote).
	const cidcl = drawingCount + 1;
	const cspSaved = totalShapes - drawingCount;
	const w = new ByteWriter().u32(maxShapeId).u32(cidcl).u32(cspSaved).u32(drawingCount);
	shapesPerDrawing.forEach((count, i) => {
		const drawingId = i + 1;
		w.u32(drawingId).u32(count);
	});
	return record(OA.Dgg, w.toBytes(), 0, false, 0);
}

/** Result of assembling the picture store. */
export interface PictureStore {
	/** `OfficeArtDggContainer` bytes, embedded in the document's DrawingGroup. */
	dggContainer: Uint8Array;
	/** Raw bytes of the "Pictures" stream, or undefined when there are none. */
	picturesStream: Uint8Array | undefined;
}

/**
 * Build the DggContainer + Pictures stream for the deck's picture list.
 *
 * @param shapesPerDrawing - Shape count (patriarch included) for each
 *   drawing, IN DRAWING-ID ORDER (index 0 = drawing id 1, the master; index
 *   `i` = drawing id `i + 1`). See {@link buildDgg}.
 */
export function buildPictureStore(
	pictures: WPictureData[],
	shapesPerDrawing: number[],
): PictureStore {
	const totalShapes = shapesPerDrawing.reduce((sum, n) => sum + n, 0);
	if (pictures.length === 0) {
		const dggData = new ByteWriter()
			.bytes(buildDgg(shapesPerDrawing, totalShapes))
			.bytes(buildDggDefaultProperties())
			.bytes(buildSplitMenuColors())
			.toBytes();
		return { dggContainer: record(OA.DggContainer, dggData, 0, true), picturesStream: undefined };
	}

	const picturesStream = new ByteWriter();
	const fbseEntries = new ByteWriter();
	for (const picture of pictures) {
		const foDelay = picturesStream.size;
		const blip = buildBlip(picture);
		picturesStream.bytes(blip);
		fbseEntries.bytes(buildFbse(picture, foDelay, blip.length));
	}
	const bstoreContainer = record(OA.BStoreContainer, fbseEntries.toBytes(), pictures.length, true);

	const dggData = new ByteWriter()
		.bytes(buildDgg(shapesPerDrawing, totalShapes))
		.bytes(bstoreContainer)
		.bytes(buildDggDefaultProperties())
		.bytes(buildSplitMenuColors())
		.toBytes();
	return {
		dggContainer: record(OA.DggContainer, dggData, 0, true),
		picturesStream: picturesStream.toBytes(),
	};
}
