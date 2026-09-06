/**
 * OfficeArtDgContainer writer for one slide's (or the master's) shape tree,
 * the inverse of `escher/sp-container.ts`'s `parseDrawing`.
 *
 * @module ppt/writer/drawing-writer
 */

import { OA, RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';
import { encodeColorRef } from './colors';
import { buildFopt, OPT } from './fopt-writer';
import { buildAnyShapeContainer, buildCanvasPatriarch } from './group-writer';
import { ShapeIdAllocator } from './shape-id-allocator';
import type { WAnyShape, WRect } from './write-model';

const FSP_FLAG_BACKGROUND = 0x0400;
const BACKGROUND_RECT_SPT = 1;

function buildDg(drawingId: number, shapeCount: number, shapeIdBudget: number): Uint8Array {
	const data = new ByteWriter()
		.u32(shapeCount + 1) // + patriarch
		.u32(shapeIdBudget)
		.toBytes();
	return record(OA.Dg, data, drawingId, false, 0);
}

function buildBackgroundShape(rgb: string, allocator: ShapeIdAllocator): Uint8Array {
	const fsp = new ByteWriter().u32(allocator.next()).u32(FSP_FLAG_BACKGROUND).toBytes();
	const fspRecord = record(OA.FSP, fsp, BACKGROUND_RECT_SPT, false, 2);
	const foptRecord = buildFopt([{ id: OPT.fillColor, value: encodeColorRef(rgb) }]);
	const data = new ByteWriter().bytes(fspRecord).bytes(foptRecord).toBytes();
	return record(OA.SpContainer, data, 0, true);
}

/** Shape-id budget allocated per drawing, matching real PowerPoint's own clustering. */
export const SHAPE_ID_CLUSTER_SIZE = 1024;

/**
 * Build a framed `Drawing` record (`RT.Drawing`) containing one
 * `OfficeArtDgContainer` for a slide or master's shapes.
 *
 * @param drawingId - This drawing's unique id (`OfficeArtFDG.drawingId`,
 *   [MS-ODRAW] 2.2.24): every drawing (the master's own, and each slide's)
 *   in a document MUST have a distinct id, matching the `OfficeArtIDCL`
 *   cluster list built by `bstore-writer.ts#buildPictureStore`. Real
 *   (COM-written) files number them 1, 2, 3, ... in document order; giving
 *   every drawing the same id (this writer's earlier behaviour) triggered
 *   real PowerPoint's Office File Validation to hard-reject the file with
 *   no repair option, confirmed fixed by COM re-verification.
 */
export function buildDrawing(
	canvasRect: WRect,
	shapes: WAnyShape[],
	backgroundRgb: string | undefined,
	fonts: string[],
	drawingId: number,
): Uint8Array {
	const allocator = new ShapeIdAllocator(drawingId, SHAPE_ID_CLUSTER_SIZE);
	const spgrData = new ByteWriter().bytes(buildCanvasPatriarch(allocator));
	if (backgroundRgb) {
		spgrData.bytes(buildBackgroundShape(backgroundRgb, allocator));
	}
	for (const shape of shapes) {
		spgrData.bytes(buildAnyShapeContainer(shape, fonts, allocator));
	}
	const spgrContainer = record(OA.SpgrContainer, spgrData.toBytes(), 0, true);

	// Matches the corresponding OfficeArtIDCL cluster's numShapeIdsUsed in
	// bstore-writer.ts#buildDgg, so the two independently-computed values
	// stay consistent.
	const shapeIdBudget = drawingId * SHAPE_ID_CLUSTER_SIZE;
	const dgData = new ByteWriter()
		.bytes(buildDg(drawingId, shapes.length, shapeIdBudget))
		.bytes(spgrContainer)
		.toBytes();
	const dgContainer = record(OA.DgContainer, dgData, 0, true);

	return record(RT.Drawing, dgContainer, 0, true);
}
