/**
 * OfficeArt shape tree parsing ([MS-ODRAW] OfficeArtDgContainer /
 * OfficeArtSpgrContainer / OfficeArtSpContainer) with the MS-PPT flavored
 * client records (anchor, data, textbox).
 *
 * @module ppt/escher/sp-container
 */

import type { PptColorScheme } from '../color-scheme';
import { resolveEscherColor } from '../color-scheme';
import { resolveShapeInteractiveInfo } from '../hyperlink-parser';
import type { RawHyperlinkStrings } from '../hyperlink-parser';
import type { PptAnyShape, PptShape } from '../ppt-model';
import { findChild, isContainer, iterateChildren } from '../record-stream';
import type { PptRecord } from '../record-stream';
import { OA } from '../record-types';
import type { PptRawText } from '../text/text-atoms';
import { extractExObjId, extractPlaceholder, extractText } from './client-data-extract';
import { CONNECTOR_TYPES, presetForShapeType } from './geometry-map';
import { OPT, decodeComplexString, parseProperties, rotationToDegrees } from './properties';
import type { EscherProperties } from './properties';
import { extractFill, extractLine, readChildAnchor, readClientAnchor } from './shape-props';

/** Shared parse context for one drawing. */
export interface DrawingContext {
	view: DataView;
	data: Uint8Array;
	scheme: PptColorScheme;
	fonts: string[];
	/** Raw outline texts for OutlineTextRefAtom resolution. */
	rawOutlineText: PptRawText[] | undefined;
	/** Document-wide hyperlink string lookup (see `hyperlink-parser.ts`). */
	hyperlinkStrings: Map<number, RawHyperlinkStrings>;
	/**
	 * `exObjId`s known to be OLE embeds (see `ole-embed-parser.ts`'s
	 * `parseOleEmbedRefs`), so a picture-frame shape whose `ExObjRefAtom`
	 * points at one of these is read as a `PptOleObject` instead of a plain
	 * `PptPicture`. The actual embedded bytes are resolved separately
	 * (async), after every shape is parsed; see `document-parser.ts`.
	 */
	oleExObjIds: Set<number>;
}

/** Result of parsing a drawing container. */
export interface ParsedDrawing {
	shapes: PptAnyShape[];
	/** Solid background fill from the background shape, when present. */
	backgroundRgb?: string;
}

const FSP_FLAG_GROUP = 0x0001;
const FSP_FLAG_DELETED = 0x0008;
const FSP_FLAG_FLIPH = 0x0040;
const FSP_FLAG_FLIPV = 0x0080;
const FSP_FLAG_BACKGROUND = 0x0400;

/** Parse a single (non-group) OfficeArtSpContainer. */
function parseShape(ctx: DrawingContext, container: PptRecord): PptAnyShape | undefined {
	const fsp = findChild(ctx.view, container, OA.FSP);
	if (!fsp || fsp.recLen < 8) {
		return undefined;
	}
	const spt = fsp.recInstance;
	const flags = ctx.view.getUint32(fsp.dataOffset + 4, true);
	if (flags & FSP_FLAG_DELETED) {
		return undefined;
	}

	const optRec = findChild(ctx.view, container, OA.FOPT);
	const props: EscherProperties = optRec
		? parseProperties(ctx.view, ctx.data, optRec)
		: { values: new Map(), complex: new Map() };

	const anchorRec = findChild(ctx.view, container, OA.ClientAnchor);
	const childAnchorRec = findChild(ctx.view, container, OA.ChildAnchor);
	const anchor = anchorRec
		? readClientAnchor(ctx.view, anchorRec)
		: childAnchorRec
			? readChildAnchor(ctx.view, childAnchorRec)
			: undefined;

	const namePayload = props.complex.get(OPT.wzName);
	const name = namePayload ? decodeComplexString(namePayload) : undefined;
	const rotationRaw = props.values.get(OPT.rotation);
	const rotationDeg = rotationRaw !== undefined ? rotationToDegrees(rotationRaw) : undefined;
	const flipH = (flags & FSP_FLAG_FLIPH) !== 0 ? true : undefined;
	const flipV = (flags & FSP_FLAG_FLIPV) !== 0 ? true : undefined;

	const clientData = findChild(ctx.view, container, OA.ClientData);
	const actionClick = clientData
		? resolveShapeInteractiveInfo(ctx.view, clientData, ctx.hyperlinkStrings)
		: undefined;

	// Picture shape: pib references the picture collection (1-based). One
	// carrying an ExObjRefAtom into a known OLE embed is read as an OLE
	// object instead of a plain picture (the pib is still its preview).
	const pib = props.values.get(OPT.pib);
	if (pib !== undefined && pib > 0) {
		const exObjId = clientData ? extractExObjId(ctx, clientData) : undefined;
		if (exObjId !== undefined && ctx.oleExObjIds.has(exObjId)) {
			return {
				kind: 'ole',
				pictureIndex: pib - 1,
				exObjId,
				name,
				anchor,
				rotationDeg,
				flipH,
				flipV,
				actionClick,
			};
		}
		return {
			kind: 'picture',
			pictureIndex: pib - 1,
			name,
			anchor,
			rotationDeg,
			flipH,
			flipV,
			actionClick,
		};
	}

	const shape: PptShape = {
		kind: 'shape',
		preset: presetForShapeType(spt),
		isConnector: CONNECTOR_TYPES.has(spt),
		name,
		anchor,
		rotationDeg,
		flipH,
		flipV,
		actionClick,
	};

	const fill = extractFill(props, ctx.scheme, spt);
	if (fill) {
		shape.fill = fill;
	}
	const line = extractLine(props, ctx.scheme);
	if (line) {
		shape.line = line;
	}

	if (clientData) {
		const placeholderType = extractPlaceholder(ctx, clientData);
		if (placeholderType) {
			shape.placeholderType = placeholderType;
		}
	}

	const clientTextbox = findChild(ctx.view, container, OA.ClientTextbox);
	if (clientTextbox) {
		const text = extractText(ctx, clientTextbox);
		if (text && text.paragraphs.some((p) => p.runs.length > 0)) {
			shape.text = text;
		}
	}

	// The background shape carries the slide background fill.
	if (flags & FSP_FLAG_BACKGROUND) {
		return undefined;
	}

	return shape;
}

/** Parse an OfficeArtSpgrContainer (group) into a group shape. */
function parseGroup(ctx: DrawingContext, container: PptRecord): PptAnyShape | undefined {
	const children: PptAnyShape[] = [];
	let groupShape: PptRecord | undefined;
	let first = true;

	for (const child of iterateChildren(ctx.view, container)) {
		if (child.recType === OA.SpContainer && first) {
			groupShape = child;
			first = false;
		} else if (child.recType === OA.SpContainer) {
			const shape = parseShape(ctx, child);
			if (shape) {
				children.push(shape);
			}
		} else if (child.recType === OA.SpgrContainer) {
			const group = parseGroup(ctx, child);
			if (group) {
				children.push(group);
			}
		}
	}

	if (!groupShape) {
		return undefined;
	}
	const fspgr = findChild(ctx.view, groupShape, OA.FSPGR);
	const anchorRec = findChild(ctx.view, groupShape, OA.ClientAnchor);
	const childAnchorRec = findChild(ctx.view, groupShape, OA.ChildAnchor);
	const anchor = anchorRec
		? readClientAnchor(ctx.view, anchorRec)
		: childAnchorRec
			? readChildAnchor(ctx.view, childAnchorRec)
			: undefined;
	const childRect = fspgr && fspgr.recLen >= 16 ? readChildAnchor(ctx.view, fspgr) : undefined;

	if (children.length === 0) {
		return undefined;
	}
	return {
		kind: 'group',
		anchor,
		childRect: childRect ?? anchor ?? { x: 0, y: 0, w: 0, h: 0 },
		children,
	};
}

/**
 * Parse an OfficeArtDgContainer into the slide's shape list.
 *
 * The top SpgrContainer's first SpContainer is the patriarch group (the
 * canvas itself) and is skipped; a shape flagged fBackground contributes
 * the background fill instead of an element.
 */
export function parseDrawing(ctx: DrawingContext, dgContainer: PptRecord): ParsedDrawing {
	const result: ParsedDrawing = { shapes: [] };
	const topGroup = findChild(ctx.view, dgContainer, OA.SpgrContainer);
	if (!topGroup) {
		return result;
	}

	let first = true;
	for (const child of iterateChildren(ctx.view, topGroup)) {
		if (child.recType === OA.SpContainer) {
			if (first) {
				first = false;
				continue; // patriarch
			}
			const backgroundRgb = extractBackground(ctx, child);
			if (backgroundRgb !== undefined) {
				result.backgroundRgb = backgroundRgb;
				continue;
			}
			const shape = parseShape(ctx, child);
			if (shape) {
				result.shapes.push(shape);
			}
		} else if (child.recType === OA.SpgrContainer) {
			const group = parseGroup(ctx, child);
			if (group) {
				result.shapes.push(group);
			}
		} else if (isContainer(child)) {
			// SolverContainer and friends: ignored.
		}
	}
	return result;
}

/** When the container is the background shape, return its fill color. */
function extractBackground(ctx: DrawingContext, container: PptRecord): string | undefined {
	const fsp = findChild(ctx.view, container, OA.FSP);
	if (!fsp || fsp.recLen < 8) {
		return undefined;
	}
	const flags = ctx.view.getUint32(fsp.dataOffset + 4, true);
	if ((flags & FSP_FLAG_BACKGROUND) === 0 || (flags & FSP_FLAG_GROUP) !== 0) {
		return undefined;
	}
	const optRec = findChild(ctx.view, container, OA.FOPT);
	if (!optRec) {
		return ctx.scheme[0];
	}
	const props = parseProperties(ctx.view, ctx.data, optRec);
	const fillColor = props.values.get(OPT.fillColor);
	return fillColor !== undefined ? resolveEscherColor(fillColor, ctx.scheme) : ctx.scheme[0];
}
