/**
 * OfficeArtSpgrContainer writer for a group of shapes, the inverse of
 * `escher/sp-container.ts`'s `parseGroup`.
 *
 * Group children carry ABSOLUTE EMU coordinates in this project's element
 * model (the same space as top-level slide shapes), so the patriarch's
 * FSPGR child-space rect is written identical to its own anchor: a 1:1
 * mapping, no coordinate remapping needed.
 *
 * @module ppt/writer/group-writer
 */

import { OA } from '../record-types';
import { buildChildAnchorData, buildClientAnchor } from './anchor-writer';
import { ByteWriter, record } from './byte-writer';
import type { HyperlinkCollector } from './hyperlink-writer';
import type { OleCollector } from './ole-writer';
import type { ShapeIdAllocator } from './shape-id-allocator';
import { buildClientData, buildPictureContainer, buildShapeContainer } from './shape-writer';
import type { WAnyShape, WGroup, WRect } from './write-model';

const FSP_FLAG_GROUP = 0x0001;
/** [MS-ODRAW] 2.2.9: this shape is the drawing's own top-level canvas group. */
const FSP_FLAG_PATRIARCH = 0x0004;

const ZERO_RECT: WRect = { x: 0, y: 0, w: 0, h: 0 };

function buildFspgr(childRect: WRect): Uint8Array {
	return record(OA.FSPGR, buildChildAnchorData(childRect), 0, false, 1);
}

function buildGroupFsp(spid: number, flags: number): Uint8Array {
	const data = new ByteWriter().u32(spid).u32(flags).toBytes();
	return record(OA.FSP, data, 0, false, 2);
}

/**
 * Build the drawing's own top-level canvas group ("patriarch"): `FSPGR` with
 * an all-zero child rect and `FSP` flagged `fGroup | fPatriarch`, with NO
 * `ClientAnchor` at all. Verified byte-for-byte against a real
 * (COM-written) file's patriarch; this writer previously also emitted a
 * `ClientAnchor` covering the whole slide and set extra unverified "hint"
 * flag bits, which real PowerPoint's Office File Validation rejected.
 */
export function buildCanvasPatriarch(allocator: ShapeIdAllocator): Uint8Array {
	const data = new ByteWriter()
		.bytes(buildFspgr(ZERO_RECT))
		.bytes(buildGroupFsp(allocator.next(), FSP_FLAG_GROUP | FSP_FLAG_PATRIARCH))
		.toBytes();
	return record(OA.SpContainer, data, 0, true);
}

/** Build a nested group's own patriarch: `FSPGR` (child rect) + `FSP` + `ClientAnchor` [+ `ClientData`]. */
function buildNestedGroupPatriarch(
	group: WGroup,
	allocator: ShapeIdAllocator,
	hyperlinks: HyperlinkCollector,
): Uint8Array {
	const data = new ByteWriter()
		.bytes(buildFspgr(group.anchor))
		.bytes(buildGroupFsp(allocator.next(), FSP_FLAG_GROUP))
		.bytes(buildClientAnchor(group.anchor));
	if (group.hyperlink) {
		data.bytes(buildClientData(undefined, group.hyperlink, hyperlinks));
	}
	return record(OA.SpContainer, data.toBytes(), 0, true);
}

/** Dispatch a single shape/picture/group to its framed OfficeArt container. */
export function buildAnyShapeContainer(
	shape: WAnyShape,
	fonts: string[],
	allocator: ShapeIdAllocator,
	hyperlinks: HyperlinkCollector,
	oleEmbeds: OleCollector,
): Uint8Array {
	if (shape.kind === 'shape') {
		return buildShapeContainer(shape, fonts, allocator, hyperlinks);
	}
	if (shape.kind === 'picture') {
		return buildPictureContainer(shape, allocator, hyperlinks, oleEmbeds);
	}
	return buildGroupContainer(shape, fonts, allocator, hyperlinks, oleEmbeds);
}

/** Build a framed OfficeArtSpgrContainer for a nested group. */
export function buildGroupContainer(
	group: WGroup,
	fonts: string[],
	allocator: ShapeIdAllocator,
	hyperlinks: HyperlinkCollector,
	oleEmbeds: OleCollector,
): Uint8Array {
	const data = new ByteWriter().bytes(buildNestedGroupPatriarch(group, allocator, hyperlinks));
	for (const child of group.children) {
		data.bytes(buildAnyShapeContainer(child, fonts, allocator, hyperlinks, oleEmbeds));
	}
	return record(OA.SpgrContainer, data.toBytes(), 0, true);
}
