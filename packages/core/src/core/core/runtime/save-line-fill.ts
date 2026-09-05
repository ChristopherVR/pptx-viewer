import type { ShapeStyle, XmlObject } from '../../types';
import { serializeColorChoiceWithRef } from '../../utils/color-xml-preservation';
import type { FillChoiceElement } from './fill-choice-group';
import { setFillChoice } from './fill-choice-group';

/**
 * `CT_LineProperties` children that FOLLOW the fill choice group
 * (ECMA-376 §20.1.2.2.24): the dash group, the join group, the two line ends
 * and `extLst`.
 */
const AFTER_LINE_FILL = new Set([
	'prstDash',
	'custDash',
	'round',
	'bevel',
	'miter',
	'headEnd',
	'tailEnd',
	'extLst',
]);

const localName = (key: string): string => key.replace(/^@_/u, '').split(':').at(-1) ?? key;

/**
 * Write the one fill child of an `a:ln` IN SCHEMA POSITION.
 *
 * `setFillChoice` deletes the old member and assigns the new one, which puts
 * it last in key order, and fast-xml-parser serialises in key order. On a
 * preserved `<a:ln><a:noFill/><a:prstDash val="dash"/></a:ln>` that produced
 * `prstDash` before `noFill`: a sequence violation PowerPoint answers by
 * discarding the whole `a:ln`, so the shape fell back to its `<a:lnRef>` and
 * drew a themed outline where the author had asked for none. (Confirmed
 * through COM: `Shape.Line.Visible` flipped from 0 to -1.) The dash writer
 * already places itself this way; this is the same courtesy for the fill.
 */
function setOrderedLineFill(lineNode: XmlObject, name: FillChoiceElement, value: XmlObject): void {
	setFillChoice(lineNode, name, value);
	const entries = Object.entries(lineNode).filter(([key]) => key !== name);
	const at = entries.findIndex(([key]) => AFTER_LINE_FILL.has(localName(key)));
	if (at < 0) {
		return;
	}
	entries.splice(at, 0, [name, value]);
	for (const key of Object.keys(lineNode)) {
		delete lineNode[key];
	}
	for (const [key, entryValue] of entries) {
		lineNode[key] = entryValue;
	}
}

/**
 * Emit the single fill child of an `<a:ln>` node.
 *
 * `CT_LineProperties` (ECMA-376 §20.1.2.2.24) permits at most one of
 * `noFill`/`solidFill`/`gradFill`/`pattFill`. This clears every fill child
 * first and then writes exactly one, chosen from the modelled
 * {@link ShapeStyle.strokeFillMode}:
 *
 *  - `transparent`/zero-width outline -> `a:noFill`
 *  - `gradient` (with preserved {@link ShapeStyle.strokeGradientXml}) ->
 *    `a:gradFill` re-emitted verbatim
 *  - `pattern` (with preserved {@link ShapeStyle.strokePatternXml}) ->
 *    `a:pattFill` re-emitted verbatim
 *  - otherwise a single `a:solidFill`
 *
 * This is the fix for issue #87: previously a gradient/pattern outline was
 * downgraded to an averaged `a:solidFill` while any preserved `a:gradFill`/
 * `a:pattFill` was left in place, producing an invalid dual-fill `<a:ln>`.
 * The clearing itself now lives in {@link setFillChoice} so `a:ln` and
 * `a:spPr` cannot drift apart on which members they remember to remove.
 *
 * @param lineNode   - The `a:ln` XML object to mutate in place.
 * @param shapeStyle - Resolved shape style carrying the outline fill.
 * @param parseColor - Resolver used to test whether a preserved colour XML node
 *                     still matches the current hex (for verbatim re-emission).
 */
export function writeLineFill(
	lineNode: XmlObject,
	shapeStyle: ShapeStyle,
	parseColor: (colorNode: XmlObject | undefined) => string | undefined,
): void {
	if (shapeStyle.strokeColor === 'transparent' || shapeStyle.strokeWidth === 0) {
		setOrderedLineFill(lineNode, 'a:noFill', {});
		return;
	}

	if (shapeStyle.strokeFillMode === 'gradient' && shapeStyle.strokeGradientXml) {
		setOrderedLineFill(lineNode, 'a:gradFill', shapeStyle.strokeGradientXml);
		return;
	}

	if (shapeStyle.strokeFillMode === 'pattern' && shapeStyle.strokePatternXml) {
		setOrderedLineFill(lineNode, 'a:pattFill', shapeStyle.strokePatternXml);
		return;
	}

	const resolvedStrokeOriginal = shapeStyle.strokeColorXml
		? parseColor(shapeStyle.strokeColorXml)
		: undefined;
	setOrderedLineFill(
		lineNode,
		'a:solidFill',
		serializeColorChoiceWithRef(
			shapeStyle.strokeColorRef,
			shapeStyle.strokeColorXml,
			resolvedStrokeOriginal,
			shapeStyle.strokeColor ?? '#000000',
			shapeStyle.strokeOpacity,
		),
	);
}
