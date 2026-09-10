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
import type { HyperlinkCollector } from './hyperlink-writer';
import type { MediaCollector } from './media-writer';
import type { OleCollector } from './ole-writer';
import { ShapeIdAllocator } from './shape-id-allocator';
import type { WAnyShape, WRect } from './write-model';

const FSP_FLAG_BACKGROUND = 0x0400;
const BACKGROUND_RECT_SPT = 1;

function buildDg(drawingId: number, shapeCount: number, lastShapeId: number): Uint8Array {
	const data = new ByteWriter()
		.u32(shapeCount + 1) // + patriarch
		.u32(lastShapeId)
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
	hyperlinks: HyperlinkCollector,
	oleEmbeds: OleCollector,
	mediaEmbeds: MediaCollector,
): Uint8Array {
	const allocator = new ShapeIdAllocator(drawingId, SHAPE_ID_CLUSTER_SIZE);
	const spgrData = new ByteWriter().bytes(buildCanvasPatriarch(allocator));
	if (backgroundRgb) {
		spgrData.bytes(buildBackgroundShape(backgroundRgb, allocator));
	}
	for (const shape of shapes) {
		spgrData.bytes(
			buildAnyShapeContainer(shape, fonts, allocator, hyperlinks, oleEmbeds, mediaEmbeds),
		);
	}
	const spgrContainer = record(OA.SpgrContainer, spgrData.toBytes(), 0, true);

	// The Dg record's second field is the id of the LAST shape allocated in
	// this drawing (patriarch = drawingId * SHAPE_ID_CLUSTER_SIZE, see
	// `ShapeIdAllocator`), not the top of the drawing's 1024-wide budget:
	// confirmed against a COM-authored fixture. Read straight off the
	// allocator (now that every shape, including the optional background
	// rect, has been built) rather than recomputed from `shapes.length`, so
	// it can never drift out of sync with what was actually allocated.
	const lastShapeId = allocator.lastIssued;
	const dgData = new ByteWriter()
		.bytes(buildDg(drawingId, shapes.length, lastShapeId))
		.bytes(spgrContainer)
		.toBytes();
	const dgContainer = record(OA.DgContainer, dgData, 0, true);

	return record(RT.Drawing, dgContainer, 0, true);
}
