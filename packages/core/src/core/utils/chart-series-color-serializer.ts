/**
 * Pure serialization helper for writing an edited series colour back into
 * `c:ser/c:spPr` on save.
 *
 * Area-filled chart families (bar/area/pie/doughnut/bubble/surface/...)
 * author a series' colour as a direct fill: `c:spPr/a:solidFill`. Line-drawn
 * families (line/line3D/scatter/radar/stock) have no fillable area and
 * author it on the outline instead: `c:spPr/a:ln/a:solidFill` (see
 * {@link ../types.PptxChartType} and `isLineDrawnChartType` in
 * `chart-container-type-map.ts`).
 *
 * Writing an edited colour into the wrong slot used to be worse than a
 * no-op: `CT_ShapeProperties` sequences its fill-group child BEFORE `a:ln`,
 * so unconditionally inserting a sibling `a:solidFill` after an existing
 * `a:ln` produced schema-invalid XML, and for a line-family series the
 * colour never reached the property PowerPoint actually reads
 * (`a:ln/a:solidFill`), so an inspector-edited colour looked applied in
 * memory but was invisible on reopen.
 *
 * Dependency-light (a `getLocalName` resolver + colour resolver only) so it
 * can be unit-tested directly and shared by every save-side write site.
 *
 * @module utils/chart-series-color-serializer
 */

import type { XmlObject } from '../types';
import { serializeColorChoice } from './color-xml-preservation';

type GetLocalName = (key: string) => string;
type ResolveColor = (node: XmlObject | undefined) => string | undefined;

function findKey(obj: XmlObject, local: string, getLocalName: GetLocalName): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === local);
}

/**
 * Insert `key` into `obj` immediately before its `a:ln` child (if any),
 * preserving every other key's relative order. `CT_ShapeProperties`'s
 * fill-group child must precede `a:ln`; appending a NEW fill key
 * unconditionally (the pre-fix behaviour) could land it after an existing
 * `a:ln`, which PowerPoint may reject or silently mangle.
 */
function insertBeforeLn(
	obj: XmlObject,
	key: string,
	value: XmlObject,
	getLocalName: GetLocalName,
): void {
	const keys = Object.keys(obj);
	const lnIdx = keys.findIndex((k) => getLocalName(k) === 'ln');
	const entries = keys.map((k) => [k, obj[k]] as const);
	const at = lnIdx === -1 ? entries.length : lnIdx;
	entries.splice(at, 0, [key, value] as const);
	for (const k of keys) {
		delete obj[k];
	}
	for (const [k, v] of entries) {
		obj[k] = v;
	}
}

/**
 * Insert `key` as the FIRST child of `obj`. `CT_LineProperties` (`a:ln`)
 * requires its fill choice (`a:noFill` | `a:solidFill` | `a:gradFill` |
 * `a:pattFill`) to be its first child, ahead of `a:prstDash` / `a:round` /
 * `a:headEnd` / `a:tailEnd` / etc.
 */
function insertFirst(obj: XmlObject, key: string, value: XmlObject): void {
	const keys = Object.keys(obj);
	const entries = keys.map((k) => [k, obj[k]] as const);
	for (const k of keys) {
		delete obj[k];
	}
	obj[key] = value;
	for (const [k, v] of entries) {
		obj[k] = v;
	}
}

/**
 * Write `hex` as a series' colour into an existing `c:ser/c:spPr`, in the
 * slot the chart family actually reads it from. When an authored colour
 * choice is already present in that slot, it is updated via
 * {@link serializeColorChoice} (re-emitting the original `a:schemeClr` /
 * etc. verbatim when the resolved colour is unchanged, same as the
 * direct-fill path has always done). When absent, a fresh `a:solidFill` is
 * inserted in schema order, and any sibling `a:noFill` in the same choice
 * group is removed (a fill choice group allows exactly one member).
 *
 * @param spPr - The series' `c:spPr` node (mutated in place). Callers are
 *   responsible for creating and attaching this node to `c:ser` first when
 *   the series had none.
 * @param hex - The new colour, 6-digit hex, with or without a leading `#`.
 * @param isLineFamily - Whether this series' chart family reads its colour
 *   from `a:ln/a:solidFill` (line/line3D/scatter/radar/stock) rather than a
 *   direct `a:solidFill`.
 * @param getLocalName - Namespace-prefix stripper.
 * @param resolveColor - Resolves an existing colour-choice node (e.g.
 *   `a:solidFill`) to a hex string, for the preserve-original comparison.
 */
export function writeSeriesColorToSpPr(
	spPr: XmlObject,
	hex: string,
	isLineFamily: boolean,
	getLocalName: GetLocalName,
	resolveColor: ResolveColor,
): void {
	const normalizedHex = hex.replace(/^#/u, '');

	if (isLineFamily) {
		const lnKey = findKey(spPr, 'ln', getLocalName) ?? 'a:ln';
		const ln = (spPr[lnKey] as XmlObject | undefined) ?? {};
		const hadLn = Boolean(spPr[lnKey]);

		const noFillKey = findKey(ln, 'noFill', getLocalName);
		if (noFillKey) {
			delete ln[noFillKey];
		}

		const lnFillKey = findKey(ln, 'solidFill', getLocalName) ?? 'a:solidFill';
		const authoredFill = ln[lnFillKey] as XmlObject | undefined;
		const fillNode = serializeColorChoice(
			authoredFill,
			authoredFill ? resolveColor(authoredFill) : undefined,
			normalizedHex,
		);
		if (authoredFill) {
			ln[lnFillKey] = fillNode;
		} else {
			insertFirst(ln, lnFillKey, fillNode);
		}

		if (!hadLn) {
			spPr[lnKey] = ln;
		}
		return;
	}

	const noFillKey = findKey(spPr, 'noFill', getLocalName);
	if (noFillKey) {
		delete spPr[noFillKey];
	}

	const fillKey = findKey(spPr, 'solidFill', getLocalName) ?? 'a:solidFill';
	const authoredFill = spPr[fillKey] as XmlObject | undefined;
	const fillNode = serializeColorChoice(
		authoredFill,
		authoredFill ? resolveColor(authoredFill) : undefined,
		normalizedHex,
	);
	if (authoredFill) {
		spPr[fillKey] = fillNode;
	} else {
		insertBeforeLn(spPr, fillKey, fillNode, getLocalName);
	}
}
