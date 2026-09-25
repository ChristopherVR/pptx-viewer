import type { ShapeStyle, XmlObject } from '../../types';
import { serializeColorChoiceWithRef } from '../../utils/color-xml-preservation';
import { applyDrawingLineDash } from '../../utils/drawing-line-dash';
import { mergeDrawingFillXml } from '../builders/drawing-fill-xml';
import type { ShapeStyleGate } from './authored-shape-style';
import { createLineStyleGate, fillIsPurelyStyleMatrix } from './authored-shape-style';
import { setFillChoice } from './fill-choice-group';
import { fillMatchesInheritedGroupFill } from './save-group-fill';
import { writeLineFill } from './save-line-fill';
import { resetSpPrFormattingForStyleMatrix } from './save-shape-style-reset';

/**
 * Everything the fill/stroke writer needs from the save runtime, supplied as
 * plain data + callbacks so the writer itself is a free function the unit
 * tests can import and drive directly.
 *
 * The colocated test used to declare its own copy of this logic ("we
 * reimplemented the core fill/stroke logic to test in isolation"), which meant
 * it could not fail when production drifted - and it duly stayed green through
 * the dual-fill defect this module now guards against.
 */
export interface ShapeFillStrokeContext {
	/** Pre-built `a:gradFill` node, or `undefined` when none can be built. */
	readonly gradientFillXml?: XmlObject;
	/** Pre-built `a:ln/a:effectLst` node, or `undefined` when there is none. */
	readonly lineEffectListXml?: XmlObject;
	/** EMU per CSS pixel (9525). */
	readonly emuPerPx: number;
	/**
	 * The fill this shape inherits from its enclosing group, when it is a group
	 * child (see {@link groupChildInheritedFill}). Supplied so a shape authored
	 * as `<a:grpFill/>`, whose fill the LOAD pass already resolved to a concrete
	 * one, can be written back as `<a:grpFill/>` instead of the resolved paint.
	 * `undefined` for a top-level shape, or for a group child with nothing to
	 * inherit.
	 */
	readonly inheritedGroupFill?: ShapeStyle;
	/** Resolve a preserved colour-choice node to a hex string. */
	parseColor(colorNode: XmlObject | undefined): string | undefined;
}

/** Get (creating if needed) the `a:ln` child of an `spPr`. */
function ensureLineNode(spPr: XmlObject): XmlObject {
	if (!spPr['a:ln']) {
		spPr['a:ln'] = {};
	}
	return spPr['a:ln'] as XmlObject;
}

/** Build the `a:pattFill` node for a pattern-filled shape. */
function buildPatternFill(shapeStyle: ShapeStyle, ctx: ShapeFillStrokeContext): XmlObject {
	const pattNode: XmlObject = {};
	const preset = shapeStyle.fillPatternPreset;
	if (preset) {
		pattNode['@_prst'] = preset;
	}
	// Prefer preserved raw XML colour nodes (retains color transforms).
	if (
		shapeStyle.fillPatternFgClrXml &&
		(shapeStyle.fillColor === undefined ||
			ctx.parseColor(shapeStyle.fillPatternFgClrXml) === shapeStyle.fillColor)
	) {
		pattNode['a:fgClr'] = shapeStyle.fillPatternFgClrXml;
	} else if (shapeStyle.fillColor) {
		pattNode['a:fgClr'] = {
			'a:srgbClr': { '@_val': shapeStyle.fillColor.replace('#', '') },
		};
	}
	if (
		shapeStyle.fillPatternBgClrXml &&
		(shapeStyle.fillPatternBackgroundColor === undefined ||
			ctx.parseColor(shapeStyle.fillPatternBgClrXml) === shapeStyle.fillPatternBackgroundColor)
	) {
		pattNode['a:bgClr'] = shapeStyle.fillPatternBgClrXml;
	} else if (shapeStyle.fillPatternBackgroundColor) {
		pattNode['a:bgClr'] = {
			'a:srgbClr': {
				'@_val': shapeStyle.fillPatternBackgroundColor.replace('#', ''),
			},
		};
	}
	return mergeDrawingFillXml(
		shapeStyle.fillPatternXml,
		pattNode,
		['fgClr', 'bgClr'],
		['fgClr', 'bgClr', 'extLst'],
	);
}

/**
 * Write the single `EG_FillProperties` child of an `spPr`.
 *
 * Every branch goes through {@link setFillChoice}, so whichever fill the
 * shape had before (including `a:pattFill` and `a:grpFill`, which the old
 * hand-written delete lists both missed) is removed before the new one lands.
 */
export function writeShapeFill(
	spPr: XmlObject,
	shapeStyle: ShapeStyle,
	ctx: ShapeFillStrokeContext,
): void {
	const requestedFillMode = shapeStyle.fillMode;

	if (shapeStyle.useBackgroundFill) {
		// `<p:sp useBgFill="1">` has no fill of its own: the fill fields hold
		// the slide background the load pipeline resolved onto it. Writing them
		// out would bake today's background into the shape and cut its link to
		// the slide, so leave `spPr`'s fill alone and let the attribute stand.
		return;
	}

	if (
		spPr['a:grpFill'] !== undefined &&
		fillMatchesInheritedGroupFill(shapeStyle, ctx.inheritedGroupFill)
	) {
		// The shape was AUTHORED as `<a:grpFill/>` and still paints with exactly
		// the fill its group handed down: the load pass resolved the link into a
		// concrete `fillMode`, and writing that back would sever it, so the child
		// stops following the group when the group is recoloured in PowerPoint.
		// Re-assert the marker instead (an explicit edit changes at least one
		// compared field and falls through to the concrete branches below).
		// `CT_GroupFillProperties` (§20.1.8.35) is empty, so nothing is lost by
		// rewriting the node rather than carrying the parsed value through.
		setFillChoice(spPr, 'a:grpFill', {});
		return;
	}

	if (fillIsPurelyStyleMatrix(shapeStyle)) {
		// The shape authored no fill: `<p:style><a:fillRef>` paints it, and the
		// fill the load pass resolved out of the theme's format scheme is
		// unchanged. An `spPr` fill OUTRANKS `a:fillRef`, so writing that
		// resolved colour back would pin the shape to today's theme colour and
		// stop Recolor / Reset / a theme change from moving it ever again.
		// `applyShapeStyleRefs` re-emits the reference itself.
		return;
	}

	if (requestedFillMode === 'image') {
		// A shape whose fill is `<a:blipFill>` (a photo-filled rectangle/ellipse/
		// custGeom, parsed by `parseShapeWithImageFill` as `type: 'picture'`, NOT
		// a `<p:pic>`). `extractShapeStyle` marks this mode with a placeholder
		// `fillColor: 'transparent'` (there is no single "fill colour" for an
		// image fill), which the `fillColor === 'transparent'` check below would
		// otherwise misread as an authored no-fill and overwrite with
		// `<a:noFill/>`, destroying the blip/crop/tile/stretch the element
		// carries. `applyImageProperties` (called before this, in
		// `processSlideElement`) already updates that `<a:blipFill>` node in
		// place for crop/effects edits, so the fill choice itself needs no
		// write here: leave `spPr`'s existing `<a:blipFill>` untouched.
		return;
	}

	if (requestedFillMode === 'none' || shapeStyle.fillColor === 'transparent') {
		setFillChoice(spPr, 'a:noFill', {});
		return;
	}

	if (requestedFillMode === 'gradient') {
		if (ctx.gradientFillXml) {
			setFillChoice(spPr, 'a:gradFill', ctx.gradientFillXml);
		}
		return;
	}

	if (requestedFillMode === 'pattern') {
		// Round-trip pattern fill: re-serialize from parsed fields.
		setFillChoice(spPr, 'a:pattFill', buildPatternFill(shapeStyle, ctx));
		return;
	}

	if (requestedFillMode === 'group') {
		// `<a:grpFill/>` inherits the parent group's fill. Re-emit the marker
		// rather than baking the resolved colour in, which would sever the
		// inheritance the same way writing out `useBgFill` would.
		setFillChoice(spPr, 'a:grpFill', {});
		return;
	}

	if (requestedFillMode === 'solid' || shapeStyle.fillColor !== undefined) {
		const fillColor = String(shapeStyle.fillColor || '').trim();
		if (fillColor.length === 0) {
			return;
		}
		// Prefer the original colour-choice XML when the resolved hex still
		// matches: preserves scheme/sys/prst identity and colour transforms
		// (lumMod/lumOff/tint/shade/satMod/alpha).
		const resolvedOriginal = shapeStyle.fillColorXml
			? ctx.parseColor(shapeStyle.fillColorXml)
			: undefined;
		setFillChoice(
			spPr,
			'a:solidFill',
			serializeColorChoiceWithRef(
				shapeStyle.fillColorRef,
				shapeStyle.fillColorXml,
				resolvedOriginal,
				fillColor,
				shapeStyle.fillOpacity,
			),
		);
	}
}

/**
 * Build one `a:headEnd` / `a:tailEnd` node, or `undefined` to omit it
 * entirely.
 *
 * A resolved arrow type of `'none'` is ambiguous on its own: it is both
 * `normalizeConnectorArrowType`'s reading of a genuinely authored
 * `type="none"` (PowerPoint's own connector tool writes
 * `<a:tailEnd len="med" w="med" type="none"/>`, all three attributes, even
 * for "no arrowhead") AND what an untouched connector with no arrow-end
 * element at all resolves to. Only the width/length tell them apart: they
 * parse independently of the type attribute, so they are defined if and
 * only if the source actually had the element. Dropping the node whenever
 * the type is "none" (the previous behaviour) matched PowerPoint's OWN
 * common convention of omitting an unstyled arrow end entirely, but it also
 * silently deleted an explicitly authored `type="none" len="med" w="med"`.
 */
function buildConnectorArrowEnd(
	type: string | undefined,
	width: string | undefined,
	length: string | undefined,
): XmlObject | undefined {
	if (type === undefined) {
		return undefined;
	}
	if (type === 'none' && width === undefined && length === undefined) {
		return undefined;
	}
	const end: XmlObject = { '@_type': type };
	if (width) {
		end['@_w'] = width;
	}
	if (length) {
		end['@_len'] = length;
	}
	return end;
}

/** Write the `a:ln` arrow ends (`a:headEnd` / `a:tailEnd`). */
function writeLineArrows(spPr: XmlObject, shapeStyle: ShapeStyle): void {
	if (
		shapeStyle.connectorEndArrow !== undefined &&
		(spPr['a:ln'] || shapeStyle.connectorEndArrow !== 'none')
	) {
		const lineNode = ensureLineNode(spPr);
		const tailEnd = buildConnectorArrowEnd(
			shapeStyle.connectorEndArrow,
			shapeStyle.connectorEndArrowWidth,
			shapeStyle.connectorEndArrowLength,
		);
		if (tailEnd) {
			lineNode['a:tailEnd'] = tailEnd;
		} else {
			delete lineNode['a:tailEnd'];
		}
	}
	if (
		shapeStyle.connectorStartArrow !== undefined &&
		(spPr['a:ln'] || shapeStyle.connectorStartArrow !== 'none')
	) {
		const lineNode = ensureLineNode(spPr);
		const headEnd = buildConnectorArrowEnd(
			shapeStyle.connectorStartArrow,
			shapeStyle.connectorStartArrowWidth,
			shapeStyle.connectorStartArrowLength,
		);
		if (headEnd) {
			lineNode['a:headEnd'] = headEnd;
		} else {
			delete lineNode['a:headEnd'];
		}
	}
}

/** Write the `a:ln` join child (`a:round` / `a:bevel` / `a:miter`). */
function writeLineJoin(spPr: XmlObject, shapeStyle: ShapeStyle, owns: ShapeStyleGate): void {
	if (shapeStyle.lineJoin === undefined || !owns('lineJoin', 'miterLimit')) {
		return;
	}
	const lineNode = ensureLineNode(spPr);
	delete lineNode['a:round'];
	delete lineNode['a:bevel'];
	delete lineNode['a:miter'];
	if (shapeStyle.lineJoin === 'round') {
		lineNode['a:round'] = {};
	} else if (shapeStyle.lineJoin === 'bevel') {
		lineNode['a:bevel'] = {};
	} else if (shapeStyle.lineJoin === 'miter') {
		const miterNode: XmlObject = {};
		// `miterLimit` is only ever set by the parser from a genuinely
		// authored `a:miter/@lim` (see `shape-style-line-helpers.ts`), so
		// once `owns(...)` above has confirmed the shape authored its own
		// join, an authored `lim="800000"` must round-trip like any other
		// authored value. 800000 is ALSO ECMA-376's schema default for
		// `CT_LineJoinMiterProperties/@lim`, but "equals the default" is not
		// "was never authored": a value the source explicitly wrote is not
		// ours to drop just because PowerPoint would have assumed the same
		// number anyway.
		if (typeof shapeStyle.miterLimit === 'number' && Number.isFinite(shapeStyle.miterLimit)) {
			miterNode['@_lim'] = String(Math.round(shapeStyle.miterLimit));
		}
		lineNode['a:miter'] = miterNode;
	}
}

/**
 * Write the shape outline: `a:ln` width/fill, dash, arrow ends, join, cap,
 * compound type, alignment and line-level effects.
 */
export function writeShapeStroke(
	spPr: XmlObject,
	shapeStyle: ShapeStyle,
	ctx: ShapeFillStrokeContext,
): void {
	// Everything below is gated on ownership: a property that still holds what
	// `<p:style><a:lnRef>` resolved to was never authored on this shape, and
	// writing it into `spPr/a:ln` would freeze the theme's line style onto it.
	// Shapes with no `a:lnRef` (and SDK-built ones) have no baseline, so the
	// gate is open and every branch behaves exactly as it always did.
	const owns = createLineStyleGate(shapeStyle);
	if (
		(shapeStyle.strokeColor !== undefined ||
			shapeStyle.strokeFillMode === 'gradient' ||
			shapeStyle.strokeFillMode === 'pattern') &&
		// The width travels with the paint: `writeLineFill` turns a zero width
		// into `a:noFill`, so the two cannot be decided apart.
		owns('strokeColor', 'strokeOpacity', 'strokeFillMode', 'strokeWidth')
	) {
		const lineNode = ensureLineNode(spPr);
		// `owns('strokeWidth')` here, separately from the combined check above:
		// the combined check only decides whether THIS block runs at all (a
		// color/fill edit alone must still enter it), not whether the WIDTH
		// specifically was authored. A shape whose own `a:ln` carries just a
		// color (`<a:ln><a:solidFill>.../></a:ln>`, no `@w`, common when the
		// width is meant to keep following `<a:lnRef>`) had its purely
		// INHERITED width baked in as soon as the color made the block run,
		// because the combined gate does not distinguish "some property in
		// the group differs" from "this specific one does".
		if (shapeStyle.strokeWidth !== 0 && owns('strokeWidth')) {
			// A zero width is how `<a:ln><a:noFill/></a:ln>` parses. The `|| 1`
			// fallback below would turn it into `w="9525"`, inventing a 0.75pt
			// outline that reappears the moment the user re-enables the line.
			lineNode['@_w'] = String(Math.round((shapeStyle.strokeWidth || 1) * ctx.emuPerPx));
		}
		writeLineFill(lineNode, shapeStyle, ctx.parseColor);
	}
	if (shapeStyle.strokeDash !== undefined && owns('strokeDash')) {
		applyDrawingLineDash(ensureLineNode(spPr), shapeStyle);
	}

	writeLineArrows(spPr, shapeStyle);
	writeLineJoin(spPr, shapeStyle, owns);

	if (shapeStyle.lineCap !== undefined && owns('lineCap')) {
		ensureLineNode(spPr)['@_cap'] = shapeStyle.lineCap;
	}
	if (shapeStyle.compoundLine !== undefined && owns('compoundLine')) {
		ensureLineNode(spPr)['@_cmpd'] = shapeStyle.compoundLine;
	}
	// Line alignment (a:ln/@algn). `a:lnRef` never resolves one, so an
	// alignment on the flat style is always the shape's own.
	if (shapeStyle.lineAlignment !== undefined) {
		ensureLineNode(spPr)['@_algn'] = shapeStyle.lineAlignment;
	}

	// Line-level effects (a:ln/a:effectLst)
	if (ctx.lineEffectListXml && spPr['a:ln']) {
		(spPr['a:ln'] as XmlObject)['a:effectLst'] = ctx.lineEffectListXml;
	}
}

/**
 * Serialize shape fill, stroke, dash, arrows, line join/cap/compound and
 * line-level effects onto the given `spPr` XML object.
 */
export function writeShapeFillAndStroke(
	spPr: XmlObject,
	shapeStyle: ShapeStyle,
	ctx: ShapeFillStrokeContext,
): void {
	resetSpPrFormattingForStyleMatrix(spPr, shapeStyle);
	writeShapeFill(spPr, shapeStyle, ctx);
	writeShapeStroke(spPr, shapeStyle, ctx);
}
