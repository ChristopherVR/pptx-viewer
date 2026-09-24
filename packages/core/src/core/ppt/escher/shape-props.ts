/**
 * Anchor rectangles and fill/line extraction for OfficeArt shapes.
 *
 * Anchors ([MS-PPT] OfficeArtClientAnchor / [MS-ODRAW] OfficeArtChildAnchor)
 * are stored in master units (1/576 inch) as (top, left, right, bottom)
 * edges and converted to EMU rectangles here.
 *
 * @module ppt/escher/shape-props
 */

import { resolveEscherColor } from '../color-scheme';
import type { PptColorScheme } from '../color-scheme';
import type { EmuRect, PptFill, PptLine } from '../ppt-model';
import type { PptRecord } from '../record-stream';
import { masterToEmu } from '../record-types';
import { isTextBoxType } from './geometry-map';
import { OPT, arrowType, boolProp, dashStyle } from './properties';
import type { EscherProperties } from './properties';

function rectFromEdges(top: number, left: number, right: number, bottom: number): EmuRect {
	return {
		x: masterToEmu(left),
		y: masterToEmu(top),
		w: masterToEmu(right - left),
		h: masterToEmu(bottom - top),
	};
}

function readSmallRect(view: DataView, offset: number): EmuRect {
	const top = view.getInt16(offset, true);
	const left = view.getInt16(offset + 2, true);
	const right = view.getInt16(offset + 4, true);
	const bottom = view.getInt16(offset + 6, true);
	return rectFromEdges(top, left, right, bottom);
}

/**
 * The 16-byte client-anchor form, in the order real PowerPoint 16.0 reads it
 * (left, top, right, bottom; measured over COM, see `anchor-writer.ts`'s
 * `buildClientAnchor`).
 */
function readRect(view: DataView, offset: number): EmuRect {
	const left = view.getInt32(offset, true);
	const top = view.getInt32(offset + 4, true);
	const right = view.getInt32(offset + 8, true);
	const bottom = view.getInt32(offset + 12, true);
	return rectFromEdges(top, left, right, bottom);
}

/** Read a client anchor (8-byte SmallRectStruct or 16-byte RectStruct). */
export function readClientAnchor(view: DataView, rec: PptRecord): EmuRect | undefined {
	if (rec.recLen === 8) {
		return readSmallRect(view, rec.dataOffset);
	}
	if (rec.recLen === 16) {
		return readRect(view, rec.dataOffset);
	}
	return undefined;
}

/** Read a child anchor / FSPGR rect (16 bytes: left, top, right, bottom). */
export function readChildAnchor(view: DataView, rec: PptRecord): EmuRect | undefined {
	if (rec.recLen !== 16) {
		return undefined;
	}
	const left = view.getInt32(rec.dataOffset, true);
	const top = view.getInt32(rec.dataOffset + 4, true);
	const right = view.getInt32(rec.dataOffset + 8, true);
	const bottom = view.getInt32(rec.dataOffset + 12, true);
	return rectFromEdges(top, left, right, bottom);
}

/**
 * `fillType` values ([MS-ODRAW] `MSOFILLTYPE`) that are two-colour shade
 * gradients rather than a plain solid: `msofillShade` (4), `msofillShadeCenter`
 * (5), `msofillShadeShape` (6, what this project's own writer emits),
 * `msofillShadeScale` (7) and `msofillShadeTitle` (8). Radial/rectangular
 * shade shapes lose their shape on import and become a straight two-stop
 * linear gradient; see `PptFill`'s `gradient` case doc.
 */
const GRADIENT_FILL_TYPES = new Set([4, 5, 6, 7, 8]);

/** Convert a 16.16 fixed-point angle to degrees in [0, 360). */
function fixedAngleToDegrees(raw: number | undefined): number {
	if (raw === undefined) {
		return 0;
	}
	const signed = raw > 0x7fffffff ? raw - 0x100000000 : raw;
	return (((signed / 65536) % 360) + 360) % 360;
}

/** Derive the shape fill from its FOPT properties. */
export function extractFill(
	props: EscherProperties,
	scheme: PptColorScheme,
	spt: number,
): PptFill | undefined {
	const filled = boolProp(props.values.get(OPT.fNoFillHitTest), 0x10, 0x100000);
	if (filled === false) {
		return { kind: 'none' };
	}
	const fillType = props.values.get(OPT.fillType);
	const fillColor = props.values.get(OPT.fillColor);
	const fillBackColor = props.values.get(OPT.fillBackColor);
	if (
		fillType !== undefined &&
		GRADIENT_FILL_TYPES.has(fillType) &&
		fillColor !== undefined &&
		fillBackColor !== undefined
	) {
		return {
			kind: 'gradient',
			angleDeg: fixedAngleToDegrees(props.values.get(OPT.fillAngle)),
			stops: [
				{ rgb: resolveEscherColor(fillColor, scheme), position: 0 },
				{ rgb: resolveEscherColor(fillBackColor, scheme), position: 1 },
			],
		};
	}
	if (fillColor !== undefined) {
		return { kind: 'solid', rgb: resolveEscherColor(fillColor, scheme) };
	}
	if (filled === true) {
		return { kind: 'solid', rgb: scheme[4] };
	}
	// No explicit fill info: text boxes default to no fill.
	return isTextBoxType(spt) ? { kind: 'none' } : undefined;
}

/** Derive the shape outline from its FOPT properties. */
export function extractLine(
	props: EscherProperties,
	scheme: PptColorScheme,
): PptLine | { kind: 'noLine' } | undefined {
	const hasLine = boolProp(props.values.get(OPT.fNoLineDrawDash), 0x08, 0x080000);
	if (hasLine === false) {
		return { kind: 'noLine' };
	}
	const lineColor = props.values.get(OPT.lineColor);
	const lineWidth = props.values.get(OPT.lineWidth);
	if (hasLine !== true && lineColor === undefined && lineWidth === undefined) {
		return undefined;
	}
	const line: PptLine = {
		kind: 'line',
		rgb: lineColor !== undefined ? resolveEscherColor(lineColor, scheme) : scheme[1],
		widthEmu: lineWidth ?? 9525,
	};
	const dash = dashStyle(props.values.get(OPT.lineDashing));
	if (dash) {
		line.dash = dash;
	}
	const head = arrowType(props.values.get(OPT.lineStartArrowhead));
	if (head) {
		line.headArrow = head;
	}
	const tail = arrowType(props.values.get(OPT.lineEndArrowhead));
	if (tail) {
		line.tailArrow = tail;
	}
	return line;
}
