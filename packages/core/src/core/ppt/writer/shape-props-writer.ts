/**
 * FOPT property table assembly for one shape: fill, line, name and rotation.
 *
 * Gradients are written as a real two-stop `msofillShadeShape` (fillType =
 * 4) gradient with an angle, not degraded to their first stop's solid
 * colour: `fillColor` carries the first stop, `fillBackColor` the last, and
 * `fillAngle` the direction. PowerPoint's own reader renders this as a true
 * gradient; the project's own `.ppt` IMPORTER does not yet read gradient
 * fill properties back (`extractFill` in `escher/shape-props.ts` only
 * inspects `fillColor`), so a round-trip through our own importer degrades
 * a gradient to its first stop's solid colour. That importer gap is
 * pre-existing and out of this writer's ownership.
 *
 * @module ppt/writer/shape-props-writer
 */

import { encodeColorRef } from './colors';
import type { FoptComplexEntry, FoptSimpleEntry } from './fopt-writer';
import { OPT, boolPropValue, encodeComplexString } from './fopt-writer';
import type { WFill, WLine } from './write-model';

const DASH_CODE: Record<string, number> = {
	solid: 0,
	dash: 1,
	dot: 2,
	dashDot: 3,
	lgDash: 7,
	lgDashDot: 9,
	lgDashDotDot: 4,
};

/** Build the FOPT entries describing a shape's fill. */
function fillEntries(fill: WFill | undefined): FoptSimpleEntry[] {
	if (!fill || fill.kind === 'none') {
		return [{ id: OPT.fNoFillHitTest, value: boolPropValue(false, 0x10, 0x100000) }];
	}
	if (fill.kind === 'solid') {
		return [
			{ id: OPT.fillColor, value: encodeColorRef(fill.rgb) },
			{ id: OPT.fNoFillHitTest, value: boolPropValue(true, 0x10, 0x100000) },
		];
	}
	// Gradient: msofillShadeShape (linear/radial shade), two-colour.
	const first = fill.stops[0]?.rgb ?? '000000';
	const last = fill.stops[fill.stops.length - 1]?.rgb ?? first;
	const angleFixed = Math.round(((fill.angleDeg % 360) + 360) % 360) * 65536;
	return [
		{ id: OPT.fillType, value: 4 },
		{ id: OPT.fillColor, value: encodeColorRef(first) },
		{ id: OPT.fillBackColor, value: encodeColorRef(last) },
		{ id: OPT.fillShadeType, value: angleFixed },
		{ id: OPT.fNoFillHitTest, value: boolPropValue(true, 0x10, 0x100000) },
	];
}

/** Build the FOPT entries describing a shape's outline. */
function lineEntries(line: WLine | undefined): FoptSimpleEntry[] {
	if (!line || line.kind === 'none') {
		return [{ id: OPT.fNoLineDrawDash, value: boolPropValue(false, 0x08, 0x080000) }];
	}
	const entries: FoptSimpleEntry[] = [
		{ id: OPT.lineColor, value: encodeColorRef(line.rgb) },
		{ id: OPT.lineWidth, value: Math.max(1, Math.round(line.widthEmu)) },
		{ id: OPT.fNoLineDrawDash, value: boolPropValue(true, 0x08, 0x080000) },
	];
	if (line.dash && DASH_CODE[line.dash] !== undefined) {
		entries.push({ id: OPT.lineDashing, value: DASH_CODE[line.dash] });
	}
	return entries;
}

/** Result of assembling a shape's FOPT properties. */
export interface ShapeFoptProps {
	simple: FoptSimpleEntry[];
	complex: FoptComplexEntry[];
}

/** Build the full set of FOPT entries for a shape (fill, line, name, rotation, pib). */
export function buildShapeFoptProps(input: {
	fill?: WFill;
	line?: WLine;
	name?: string;
	rotationDeg?: number;
	pib?: number;
}): ShapeFoptProps {
	const simple: FoptSimpleEntry[] = [...fillEntries(input.fill), ...lineEntries(input.line)];
	if (input.rotationDeg) {
		simple.push({ id: OPT.rotation, value: Math.round(input.rotationDeg * 65536) });
	}
	if (input.pib !== undefined) {
		simple.push({ id: OPT.pib, value: input.pib });
	}
	const complex: FoptComplexEntry[] = [];
	if (input.name) {
		complex.push({ id: OPT.wzName, bytes: encodeComplexString(input.name) });
	}
	return { simple, complex };
}
