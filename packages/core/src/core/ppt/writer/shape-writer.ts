/**
 * OfficeArtSpContainer writer for a single (non-group) shape or picture,
 * the inverse of `escher/sp-container.ts`'s `parseShape`.
 *
 * @module ppt/writer/shape-writer
 */

import { OA, RT } from '../record-types';
import { buildClientAnchor } from './anchor-writer';
import { ByteWriter, record } from './byte-writer';
import { buildFopt } from './fopt-writer';
import type { ShapeIdAllocator } from './shape-id-allocator';
import { buildShapeFoptProps } from './shape-props-writer';
import { buildTextAtoms } from './text-atom-writer';
import type { WPicture, WShape } from './write-model';

const FSP_FLAG_FLIPH = 0x0040;
const FSP_FLAG_FLIPV = 0x0080;

const PLACEHOLDER_ID: Record<NonNullable<WShape['placeholderType']>, number> = {
	title: 13,
	body: 14,
	ctrTitle: 15,
	subTitle: 16,
};

/**
 * Build an `OfficeArtFSP` atom: `spid` (this shape's unique id, see
 * `shape-id-allocator.ts`) followed by `grfPersistent` flags. Every shape in
 * a document needs a distinct, non-zero `spid` inside its drawing's shape-id
 * budget; writing `spid = 0` (this writer's earlier behaviour) failed real
 * PowerPoint's Office File Validation outright.
 */
function buildFsp(spid: number, spt: number, flags: number): Uint8Array {
	const data = new ByteWriter().u32(spid).u32(flags).toBytes();
	return record(OA.FSP, data, spt, false, 2);
}

function buildClientData(placeholderId: number): Uint8Array {
	const placeholderData = new ByteWriter()
		.u8(0) // placeholderId high byte unused
		.u8(placeholderId)
		.u8(0) // size
		.u8(0) // placementId
		.toBytes();
	const placeholderAtom = record(RT.OEPlaceholderAtom, placeholderData, 0, false, 0);
	return record(OA.ClientData, placeholderAtom, 0, true);
}

function buildClientTextbox(textAtoms: Uint8Array): Uint8Array {
	return record(OA.ClientTextbox, textAtoms, 0, true);
}

/** Build a framed OfficeArtSpContainer for a plain shape (autoshape / text box / connector). */
export function buildShapeContainer(
	shape: WShape,
	fonts: string[],
	allocator: ShapeIdAllocator,
): Uint8Array {
	let flags = 0;
	if (shape.flipH) {
		flags |= FSP_FLAG_FLIPH;
	}
	if (shape.flipV) {
		flags |= FSP_FLAG_FLIPV;
	}

	const props = buildShapeFoptProps({
		fill: shape.fill,
		line: shape.line,
		name: shape.name,
		rotationDeg: shape.rotationDeg,
	});

	const parts: Uint8Array[] = [
		buildFsp(allocator.next(), shape.spt, flags),
		buildFopt(props.simple, props.complex),
		buildClientAnchor(shape.anchor),
	];

	if (shape.placeholderType) {
		parts.push(buildClientData(PLACEHOLDER_ID[shape.placeholderType]));
	}
	if (shape.text && shape.text.paragraphs.some((p) => p.runs.some((r) => r.text.length > 0))) {
		parts.push(buildClientTextbox(buildTextAtoms(shape.text, fonts)));
	}

	const data = new ByteWriter();
	for (const part of parts) {
		data.bytes(part);
	}
	return record(OA.SpContainer, data.toBytes(), 0, true);
}

/** Build a framed OfficeArtSpContainer for a picture shape. */
export function buildPictureContainer(picture: WPicture, allocator: ShapeIdAllocator): Uint8Array {
	let flags = 0;
	if (picture.flipH) {
		flags |= FSP_FLAG_FLIPH;
	}
	if (picture.flipV) {
		flags |= FSP_FLAG_FLIPV;
	}
	// Pictures use MSOSPT "Picture Frame" (75) so PowerPoint treats FOPT's
	// pib as a picture reference rather than an autoshape fill blip.
	const props = buildShapeFoptProps({
		name: picture.name,
		rotationDeg: picture.rotationDeg,
		pib: picture.pictureIndex + 1,
	});
	const data = new ByteWriter()
		.bytes(buildFsp(allocator.next(), 75, flags))
		.bytes(buildFopt(props.simple, props.complex))
		.bytes(buildClientAnchor(picture.anchor))
		.toBytes();
	return record(OA.SpContainer, data, 0, true);
}
