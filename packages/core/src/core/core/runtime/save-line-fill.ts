import type { ShapeStyle, XmlObject } from '../../types';
import { serializeColorChoice } from '../../utils/color-xml-preservation';
import { setFillChoice } from './fill-choice-group';

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
		setFillChoice(lineNode, 'a:noFill', {});
		return;
	}

	if (shapeStyle.strokeFillMode === 'gradient' && shapeStyle.strokeGradientXml) {
		setFillChoice(lineNode, 'a:gradFill', shapeStyle.strokeGradientXml);
		return;
	}

	if (shapeStyle.strokeFillMode === 'pattern' && shapeStyle.strokePatternXml) {
		setFillChoice(lineNode, 'a:pattFill', shapeStyle.strokePatternXml);
		return;
	}

	const resolvedStrokeOriginal = shapeStyle.strokeColorXml
		? parseColor(shapeStyle.strokeColorXml)
		: undefined;
	setFillChoice(
		lineNode,
		'a:solidFill',
		serializeColorChoice(
			shapeStyle.strokeColorXml,
			resolvedStrokeOriginal,
			shapeStyle.strokeColor ?? '#000000',
			shapeStyle.strokeOpacity,
		),
	);
}
