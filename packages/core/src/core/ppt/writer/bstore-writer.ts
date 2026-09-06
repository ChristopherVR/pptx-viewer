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
import { encodeColorRef } from './colors';
import type { WPictureData } from './write-model';

/**
 * Build the `OfficeArtSplitMenuColorContainer` (4 default UI colours: fill,
 * line, shadow, 3D). Present in every real (COM-written) `DggContainer`
 * this project has inspected; this writer omitted it entirely before.
 */
function buildSplitMenuColors(): Uint8Array {
	const data = new ByteWriter()
		.u32(encodeColorRef('FFFFFF'))
		.u32(encodeColorRef('000000'))
		.u32(encodeColorRef('808080'))
		.u32(encodeColorRef('FFFFFF'))
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
 * drawing, each granting that drawing a `SHAPE_ID_CLUSTER_SIZE`-wide shape-id
 * range (`dgid` = drawing id, matching `drawing-writer.ts#buildDrawing`'s
 * `drawingId`; `numShapeIdsUsed` = the top of that drawing's own budget).
 * Real (COM-written) files cluster shape ids per drawing this way; a single
 * shared cluster (this writer's earlier behaviour, alongside every drawing
 * claiming the SAME `dgid`) failed real PowerPoint's Office File Validation
 * outright, confirmed fixed by COM re-verification.
 */
function buildDgg(shapesPerDrawing: number[], totalShapes: number): Uint8Array {
	const drawingCount = shapesPerDrawing.length;
	const maxShapeId = drawingCount * SHAPE_ID_CLUSTER_SIZE;
	const w = new ByteWriter().u32(maxShapeId).u32(drawingCount).u32(totalShapes).u32(drawingCount);
	shapesPerDrawing.forEach((_, i) => {
		const drawingId = i + 1;
		w.u32(drawingId).u32(drawingId * SHAPE_ID_CLUSTER_SIZE);
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
		.bytes(buildSplitMenuColors())
		.toBytes();
	return {
		dggContainer: record(OA.DggContainer, dggData, 0, true),
		picturesStream: picturesStream.toBytes(),
	};
}
