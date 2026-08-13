/**
 * Stroke/dash normalisation, compound-line box-shadow generation, SVG
 * dasharray, element transform strings, and drawing-unit parsing. Pure
 * TypeScript shared by the React, Vue, and Angular bindings.
 */
import type { StrokeDashType, PptxElement } from 'pptx-viewer-core';

import { clampUnitInterval } from './fill-style';

/** CSS `border-style` keyword used for stroke rendering. */
export type CssBorderStyle = 'solid' | 'dotted' | 'dashed' | 'double';

/** A neutral CSS map (framework `CSSProperties` are structurally compatible). */
export type CssStyleMap = Record<string, string | number>;

/**
 * Normalizes a raw stroke dash type string to a valid `StrokeDashType` enum value.
 * Performs case-insensitive matching against all OOXML dash types.
 * @param value - Raw dash type string (e.g. "lgDash", "SysDot").
 * @returns The canonical `StrokeDashType`, or `undefined` if unrecognized.
 */
export function normalizeStrokeDashType(
	value: StrokeDashType | string | undefined,
): StrokeDashType | undefined {
	const normalized = String(value || '')
		.trim()
		.toLowerCase();
	if (!normalized) {
		return undefined;
	}

	const dashMap: Record<string, StrokeDashType> = {
		solid: 'solid',
		dot: 'dot',
		dash: 'dash',
		lgdash: 'lgDash',
		dashdot: 'dashDot',
		lgdashdot: 'lgDashDot',
		lgdashdotdot: 'lgDashDotDot',
		sysdot: 'sysDot',
		sysdash: 'sysDash',
		sysdashdot: 'sysDashDot',
		sysdashdotdot: 'sysDashDotDot',
		custom: 'custom',
	};
	return dashMap[normalized];
}

/**
 * Maps an OOXML stroke dash type to a CSS `border-style` value.
 *
 * A compound line (`a:ln/@cmpd`) maps to `double`, the one CSS border style that
 * paints more than one strand: it splits `border-width` into three equal parts
 * (line, gap, line), which is exactly ECMA-376's `dbl` ("Double Lines of equal
 * width"). `thickThin` / `thinThick` / `tri` have no CSS equivalent and are
 * approximated by the same `double`; the strand RATIO is lost but the line still
 * reads as compound, which a single solid stroke does not.
 *
 * This replaced an inset-`box-shadow` construction that could not work: inset
 * shadows paint front-to-back from the padding edge inward, and a `transparent`
 * ring paints nothing rather than punching a hole, so the "gap" ring was never
 * rendered and a compound outline came out as one THICKER solid line (verified
 * in Chromium). See {@link getCompoundLineBoxShadow}.
 *
 * A third strand for `tri` could be drawn with an `outline` + `outline-offset`
 * (which does leave a real see-through gap), but the outline is already spoken
 * for: every binding paints its selection / hover affordance with one, because
 * an affordance border would take part in layout. Correctness of the common
 * case beats a strand of the rarest one.
 *
 * @param dashType - The normalized dash type.
 * @param compoundLine - Optional compound line type (e.g. "dbl", "tri").
 * @returns A CSS border-style value, or `undefined`.
 */
export function getCssBorderDashStyle(
	dashType: StrokeDashType | undefined,
	compoundLine?: string,
): CssBorderStyle | undefined {
	// A compound line's strands outrank its dash pattern: CSS cannot express both
	// at once, and losing the multi-strand look is the more visible of the two.
	if (
		compoundLine === 'dbl' ||
		compoundLine === 'thickThin' ||
		compoundLine === 'thinThick' ||
		compoundLine === 'tri'
	) {
		return 'double';
	}
	if (!dashType || dashType === 'solid') {
		return 'solid';
	}
	if (dashType === 'dot' || dashType === 'sysDot') {
		return 'dotted';
	}
	return 'dashed';
}

/**
 * Always `undefined`: a compound line needs NO box-shadow.
 *
 * This used to build concentric inset `box-shadow` rings ("outer strand is the
 * CSS border, inner strands are inset shadows"), and it did not work. Inset
 * shadows are painted front-to-back from the padding edge inward, and the ring
 * that was supposed to be the GAP was declared `transparent` - which paints
 * nothing at all rather than punching a hole in the ring underneath it. The
 * result, confirmed by rendering both constructions in Chromium, is a single
 * solid band as thick as the whole compound line, on every browser.
 *
 * Compound lines are now painted by `border-style: double`
 * ({@link getCssBorderDashStyle}) on a CSS-bordered shape, and by the real
 * parallel strands of `buildStrokeOutline` on a stroke-only preset / connector.
 *
 * @deprecated Kept only so existing call sites keep compiling; drop the call.
 */
export function getCompoundLineBoxShadow(
	_compoundLine: string | undefined,
	_strokeWidth: number,
	_strokeColor: string,
): string | undefined {
	return undefined;
}

/**
 * The CSS `border-width` a compound line is painted at: the FULL stroke width.
 *
 * `border-style: double` divides `border-width` between its two strands and the
 * gap, so the border must carry the whole `a:ln/@w`. (It previously returned a
 * fraction, because the remaining strands were supposed to come from
 * {@link getCompoundLineBoxShadow} - which never painted them, so a compound
 * line was drawn at a third of its authored weight.)
 *
 * @param compoundLine - The compound line type (e.g. "dbl", "tri").
 * @param strokeWidth - Total stroke width in pixels.
 * @returns The CSS border width in pixels.
 * @deprecated Prefer `getComputedStrokeStyle`, which resolves the whole outline.
 */
export function getCompoundLineBorderWidth(
	_compoundLine: string | undefined,
	strokeWidth: number,
): number {
	return strokeWidth;
}

/**
 * The CSS properties that paint a compound (`a:ln/@cmpd`) border: the full
 * stroke width with `border-style: double`.
 *
 * @param compoundLine - The compound line type from `a:ln/@cmpd`.
 * @param strokeColor - Resolved stroke colour (with opacity applied).
 * @param strokeWidth - Total stroke width in pixels.
 * @returns CSS properties to apply to the shape container element.
 * @deprecated Prefer `getComputedStrokeStyle`, which resolves the whole outline.
 */
export function getCompoundLineStyle(
	compoundLine: string | undefined,
	strokeColor: string,
	strokeWidth: number,
): CssStyleMap {
	if (!compoundLine || compoundLine === 'sng' || strokeWidth <= 0) {
		return {};
	}
	return {
		borderWidth: strokeWidth,
		borderColor: strokeColor,
		borderStyle: 'double',
	};
}

/**
 * Computes an SVG `stroke-dasharray` value for a given dash type and stroke width.
 * For custom dash types with parsed segments, segment values are expressed in
 * 1/1000 of the line width (per OOXML spec) and converted to pixel multiples.
 * @param dashType - The OOXML dash type.
 * @param strokeWidth - Stroke width in pixels (minimum 1).
 * @param customDashSegments - Optional array of `{dash, space}` segments for custom dashes.
 * @returns A space-separated dasharray string, or `undefined` for solid strokes.
 */
export function getSvgStrokeDasharray(
	dashType: StrokeDashType | undefined,
	strokeWidth: number,
	customDashSegments?: Array<{ dash: number; space: number }>,
): string | undefined {
	if (!dashType || dashType === 'solid') {
		return undefined;
	}
	const stroke = Math.max(strokeWidth, 1);

	// If custom dash with parsed segments, build dasharray from actual data.
	// Segment values are in 1/1000 of the line width, so divide by 1000
	// to get multiples of stroke-width.
	if (dashType === 'custom' && customDashSegments && customDashSegments.length > 0) {
		return customDashSegments
			.flatMap((seg) => [(seg.dash / 1000) * stroke, (seg.space / 1000) * stroke])
			.join(' ');
	}

	switch (dashType) {
		case 'dot':
		case 'sysDot':
			return `${stroke} ${stroke * 2}`;
		case 'dash':
		case 'sysDash':
			return `${stroke * 4} ${stroke * 2}`;
		case 'lgDash':
			return `${stroke * 7} ${stroke * 2.5}`;
		case 'dashDot':
		case 'sysDashDot':
			return `${stroke * 4} ${stroke * 2} ${stroke} ${stroke * 2}`;
		case 'lgDashDot':
			return `${stroke * 7} ${stroke * 2.5} ${stroke} ${stroke * 2.5}`;
		case 'lgDashDotDot':
		case 'sysDashDotDot':
			return `${stroke * 7} ${stroke * 2.5} ${stroke} ${stroke * 2} ${stroke} ${stroke * 2}`;
		case 'custom':
			return `${stroke * 3} ${stroke * 2}`;
		default:
			return undefined;
	}
}

/**
 * Builds a CSS `transform` string combining flip and rotation transforms for an element.
 * Flips are expressed as `scaleX(-1)` / `scaleY(-1)`, rotation as `rotate(Ndeg)`.
 *
 * Order matters: OOXML `a:xfrm` mirrors the shape *within* its bounding box
 * (`flipH`/`flipV`) and *then* rotates the box by `rot`. With CSS
 * `transform-origin: center`, transforms apply right-to-left, so the flips must
 * come AFTER the rotation in the string (`rotate(θ) scaleX(-1)`) to be applied
 * first. Emitting `scaleX(-1) rotate(θ)` instead reflects the rotation direction
 * for any shape that is both flipped and rotated (e.g. the "Balloons" freeforms
 * render mirrored/tilted the wrong way). This matches the Angular binding's
 * `getContainerStyle`, which already emits `rotate() scaleX() scaleY()`.
 * @param element - The element whose transforms are read.
 * @returns A CSS transform string, or `undefined` if no transforms apply.
 */
export function getElementTransform(element: PptxElement): string | undefined {
	const transforms: string[] = [];
	if (element.rotation) {
		transforms.push(`rotate(${element.rotation}deg)`);
	}
	if (element.flipHorizontal) {
		transforms.push('scaleX(-1)');
	}
	if (element.flipVertical) {
		transforms.push('scaleY(-1)');
	}
	if (element.skewX) {
		transforms.push(`skewX(${element.skewX}deg)`);
	}
	if (element.skewY) {
		transforms.push(`skewY(${element.skewY}deg)`);
	}
	return transforms.length > 0 ? transforms.join(' ') : undefined;
}

/**
 * Builds the element's CSS transform WITHOUT its rotation component
 * (flips + skews only). Used as the stable base while a live rotate-handle
 * drag appends its own `rotate(...)` for preview; recomputing the full
 * transform from {@link getElementTransform} ordering keeps flipped/skewed
 * shapes rendering correctly mid-rotation.
 * @param element - The element whose non-rotation transform is built.
 * @returns A CSS transform string, or `undefined` if none apply.
 */
export function getElementTransformWithoutRotation(element: PptxElement): string | undefined {
	const transforms: string[] = [];
	if (element.flipHorizontal) {
		transforms.push('scaleX(-1)');
	}
	if (element.flipVertical) {
		transforms.push('scaleY(-1)');
	}
	if (element.skewX) {
		transforms.push(`skewX(${element.skewX}deg)`);
	}
	if (element.skewY) {
		transforms.push(`skewY(${element.skewY}deg)`);
	}
	return transforms.length > 0 ? transforms.join(' ') : undefined;
}

/**
 * Builds a CSS transform that compensates for element flips so that text
 * inside a flipped shape renders in its natural reading direction.
 * Only includes `scaleX(-1)` / `scaleY(-1)`; rotation is not compensated.
 * @param element - The element whose flips are checked.
 * @returns A CSS transform string, or `undefined` if no flips are active.
 */
export function getTextCompensationTransform(element: PptxElement): string | undefined {
	const transforms: string[] = [];
	if (element.flipHorizontal) {
		transforms.push('scaleX(-1)');
	}
	if (element.flipVertical) {
		transforms.push('scaleY(-1)');
	}
	return transforms.length > 0 ? transforms.join(' ') : undefined;
}

/**
 * Parses an OOXML "drawing percent" value (expressed as hundredths-of-a-percent,
 * i.e. 100000 = 100%) into a 0-1 unit interval.
 * @param value - Raw value from OOXML (e.g. 50000 for 50%).
 * @returns A number between 0 and 1, or `undefined` if the value is not finite.
 */
export function parseDrawingPercent(value: unknown): number | undefined {
	const parsed = Number.parseFloat(String(value ?? '').trim());
	if (!Number.isFinite(parsed)) {
		return undefined;
	}
	return clampUnitInterval(parsed / 100000);
}
