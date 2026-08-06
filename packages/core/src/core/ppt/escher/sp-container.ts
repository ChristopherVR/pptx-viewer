/**
 * OfficeArt shape tree parsing ([MS-ODRAW] OfficeArtDgContainer /
 * OfficeArtSpgrContainer / OfficeArtSpContainer) with the MS-PPT flavored
 * client records (anchor, data, textbox).
 *
 * @module ppt/escher/sp-container
 */

import type { PptColorScheme } from '../color-scheme';
import { resolveEscherColor } from '../color-scheme';
import type { PptAnyShape, PptShape, PptTextBody } from '../ppt-model';
import { findChild, isContainer, iterateChildren } from '../record-stream';
import type { PptRecord } from '../record-stream';
import { OA, RT } from '../record-types';
import { collectTextBodies, findOutlineTextRef } from '../text/text-atoms';
import type { PptRawText } from '../text/text-atoms';
import { buildTextBody } from '../text/text-builder';
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

const PLACEHOLDER_TYPE_MAP: Record<number, string> = {
	13: 'title',
	14: 'body',
	15: 'ctrTitle',
	16: 'subTitle',
};

/** Extract the text body from a client textbox record. */
function extractText(ctx: DrawingContext, clientTextbox: PptRecord): PptTextBody | undefined {
	const start = clientTextbox.dataOffset;
	const end = clientTextbox.dataOffset + clientTextbox.recLen;
	const outlineRef = findOutlineTextRef(ctx.view, start, end);
	if (outlineRef !== undefined && ctx.rawOutlineText) {
		const raw = ctx.rawOutlineText[outlineRef];
		if (raw) {
			return buildTextBody(raw, ctx.fonts);
		}
	}
	const bodies = collectTextBodies(ctx.view, start, end, ctx.scheme);
	if (bodies.length === 0) {
		return undefined;
	}
	return buildTextBody(bodies[0], ctx.fonts);
}

/** Read the placeholder type from the client data, when present. */
function extractPlaceholder(ctx: DrawingContext, clientData: PptRecord): string | undefined {
	const placeholder = findChild(ctx.view, clientData, RT.OEPlaceholderAtom);
	if (!placeholder || placeholder.recLen < 5) {
		return undefined;
	}
	const placeholderId = ctx.view.getUint8(placeholder.dataOffset + 4);
	return PLACEHOLDER_TYPE_MAP[placeholderId];
}

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

	// Picture shape: pib references the picture collection (1-based).
	const pib = props.values.get(OPT.pib);
	if (pib !== undefined && pib > 0) {
		return { kind: 'picture', pictureIndex: pib - 1, name, anchor, rotationDeg, flipH, flipV };
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
	};

	const fill = extractFill(props, ctx.scheme, spt);
	if (fill) {
		shape.fill = fill;
	}
	const line = extractLine(props, ctx.scheme);
	if (line) {
		shape.line = line;
	}

	const clientData = findChild(ctx.view, container, OA.ClientData);
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
