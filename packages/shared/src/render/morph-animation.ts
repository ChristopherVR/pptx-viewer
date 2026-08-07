/**
 * CSS keyframe generation for morph transitions.
 *
 * Generates per-element CSS keyframe animation data for matched and
 * unmatched elements, including fill colour interpolation, stroke
 * interpolation, and text morph animations.
 *
 * Pure: produces CSS keyframe strings only. DOM injection of the generated
 * keyframes (creating/removing `<style>` elements) is a binding concern and
 * stays in the consuming framework.
 *
 * @module render/morph-animation
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { hasTextProperties, hasShapeProperties } from 'pptx-viewer-core';

import { parseHexColor, lerpColor } from './morph-color';
import { flattenMorphElements } from './morph-flatten';
import { generateGeometryMorphAnimation } from './morph-geometry-keyframes';
import {
	generateImageCropGhostAnimations,
	generateImageCropMorphAnimations,
	morphImageCropChanged,
} from './morph-image-crop';
import { matchMorphElementsFull } from './morph-matching';
import type { MorphBox } from './morph-overlay-order';
import { boxesOverlap, travelledBox } from './morph-overlay-order';
import { tokenizeText } from './morph-text';
import { buildTokenMorphAnimations, diffTokens } from './morph-text-tokens';
import type { MorphAnimationStyle, MorphMode, MorphPair } from './morph-types';
import {
	MORPH_EASING,
	MORPH_FADE_IN_EASING,
	MORPH_FADE_IN_START_PERCENT,
	MORPH_FADE_OUT_END_PERCENT,
	MORPH_FADE_OUT_HOLD_PERCENT,
} from './morph-types';

// ---------------------------------------------------------------------------
// Build colour/stroke interpolation keyframes
// ---------------------------------------------------------------------------

/**
 * Generate CSS keyframe properties for fill colour interpolation between two elements.
 * Returns an object with `from` and `to` background-color declarations, or null
 * if both elements lack fill or are identical.
 *
 * @param fromElement - The outgoing element.
 * @param toElement - The incoming element.
 * @returns Fill colour keyframe properties, or null if no interpolation is needed.
 */
export function buildColorInterpolationProps(
	fromElement: PptxElement,
	toElement: PptxElement,
): { fromBg: string; toBg: string } | null {
	const fromFill = hasShapeProperties(fromElement) ? fromElement.shapeStyle?.fillColor : undefined;
	const toFill = hasShapeProperties(toElement) ? toElement.shapeStyle?.fillColor : undefined;

	if (!fromFill && !toFill) {
		return null;
	}
	if (fromFill === toFill) {
		return null;
	}

	const fromColor = parseHexColor(fromFill);
	const toColor = parseHexColor(toFill);

	if (!fromColor && !toColor) {
		return null;
	}

	const from = fromColor ?? { r: 255, g: 255, b: 255, a: 0 };
	const to = toColor ?? { r: 255, g: 255, b: 255, a: 0 };

	return {
		fromBg: lerpColor(from, from, 0),
		toBg: lerpColor(to, to, 0),
	};
}

/**
 * Generate CSS keyframe properties for stroke interpolation between two elements.
 *
 * @param fromElement - The outgoing element.
 * @param toElement - The incoming element.
 * @returns Stroke colour and width keyframe properties, or null if no interpolation is needed.
 */
export function buildStrokeInterpolationProps(
	fromElement: PptxElement,
	toElement: PptxElement,
): { fromStroke: string; toStroke: string; fromWidth: number; toWidth: number } | null {
	const fromStyle = hasShapeProperties(fromElement) ? fromElement.shapeStyle : undefined;
	const toStyle = hasShapeProperties(toElement) ? toElement.shapeStyle : undefined;

	const fromColor = fromStyle?.strokeColor;
	const toColor = toStyle?.strokeColor;
	const fromWidth = fromStyle?.strokeWidth ?? 0;
	const toWidth = toStyle?.strokeWidth ?? 0;

	if (!fromColor && !toColor && fromWidth === 0 && toWidth === 0) {
		return null;
	}
	if (fromColor === toColor && fromWidth === toWidth) {
		return null;
	}

	const fc = parseHexColor(fromColor) ?? { r: 0, g: 0, b: 0, a: 1 };
	const tc = parseHexColor(toColor) ?? { r: 0, g: 0, b: 0, a: 1 };

	return {
		fromStroke: lerpColor(fc, fc, 0),
		toStroke: lerpColor(tc, tc, 0),
		fromWidth,
		toWidth,
	};
}

// ---------------------------------------------------------------------------
// Appearance comparison (drives the matched-pair crossfade)
// ---------------------------------------------------------------------------

/** Depth cap for the recursive signature; real decks never nest this far. */
const SIGNATURE_MAX_DEPTH = 8;

/**
 * A compact description of everything about an element that is actually
 * PAINTED, used to decide whether a matched morph pair has to crossfade.
 *
 * Two matched shapes that differ only in geometry can simply glide (the
 * incoming element is already the right colour). Two that differ in fill,
 * outline, picture or text look like a hard cut if we just swap them, because
 * the outgoing appearance is never drawn: the incoming element is rendered at
 * its final appearance from the very first frame.
 *
 * A GROUP carries none of that on itself: everything it paints lives in its
 * children, so the signature recurses. Without that the group holding a
 * slide's centre content matched its counterpart, compared equal, and its
 * ghost stayed fully opaque for the whole transition - then vanished with the
 * overlay, snapping the old text to the new one in a single frame at the very
 * END of the morph (issue #131).
 */
function appearanceSignature(element: PptxElement, depth = 0): string {
	const parts: string[] = [element.type];
	if (hasShapeProperties(element)) {
		const style = element.shapeStyle;
		parts.push(
			(element as { shapeType?: string }).shapeType ?? '',
			style?.fillMode ?? '',
			style?.fillColor ?? '',
			style?.fillGradient ?? '',
			String(style?.fillOpacity ?? ''),
			style?.strokeColor ?? '',
			String(style?.strokeWidth ?? ''),
		);
	}
	const image = element as { imagePath?: string; svgPath?: string };
	parts.push(image.imagePath ?? '', image.svgPath ?? '');
	if (hasTextProperties(element)) {
		parts.push(element.text ?? '', element.textStyle?.color ?? '');
	}
	const children = (element as { children?: PptxElement[] }).children;
	if (children && depth < SIGNATURE_MAX_DEPTH) {
		for (const child of children) {
			parts.push(appearanceSignature(child, depth + 1));
		}
	}
	return parts.join('');
}

/**
 * Whether a matched pair needs a crossfade rather than a plain glide.
 *
 * PowerPoint's Morph dissolves a shape's appearance into its counterpart's
 * while it travels. Without this, a deck whose slides are near-duplicates (the
 * usual Morph authoring pattern: duplicate the slide, then restyle one shape)
 * appeared to have no transition at all, because every persisting shape was
 * painted in its FINAL state on frame 1 and only the handful of genuinely new
 * or departing shapes faded (issue #131).
 */
export function morphPairNeedsCrossfade(fromElement: PptxElement, toElement: PptxElement): boolean {
	return appearanceSignature(fromElement) !== appearanceSignature(toElement);
}

/** Sub-pixel tolerance for calling a pair's geometry unchanged. */
const GEOMETRY_EPSILON = 0.5;

/**
 * Whether a matched pair is INERT: identical appearance, and neither moved,
 * resized, rotated nor flipped. Its ghost in the overlay is therefore a
 * pixel-perfect stand-in for the live element underneath.
 *
 * Most of a Morph deck is inert - the authoring pattern is to duplicate a slide
 * and restyle one thing, so 26 of 32 pairs on this deck's transitions are
 * untouched - which makes what we do with them the dominant visual effect.
 *
 * A picture's SOURCE CROP counts here even though it moves no box: PowerPoint's
 * "Scale Height"/"Scale Width" is an `a:srcRect` crop inside an unchanged frame,
 * so a picture rescaled between two slides compares equal on every other axis
 * and would otherwise be skipped entirely (issue #148).
 */
export function isInertMorphPair(fromElement: PptxElement, toElement: PptxElement): boolean {
	return (
		!morphImageCropChanged(fromElement, toElement) &&
		Math.abs(fromElement.x - toElement.x) <= GEOMETRY_EPSILON &&
		Math.abs(fromElement.y - toElement.y) <= GEOMETRY_EPSILON &&
		Math.abs(fromElement.width - toElement.width) <= GEOMETRY_EPSILON &&
		Math.abs(fromElement.height - toElement.height) <= GEOMETRY_EPSILON &&
		(fromElement.rotation ?? 0) === (toElement.rotation ?? 0) &&
		Boolean(fromElement.flipHorizontal) === Boolean(toElement.flipHorizontal) &&
		Boolean(fromElement.flipVertical) === Boolean(toElement.flipVertical) &&
		(fromElement.opacity ?? 1) === (toElement.opacity ?? 1) &&
		!morphPairNeedsCrossfade(fromElement, toElement)
	);
}

// ---------------------------------------------------------------------------
// Which outgoing shapes the overlay has to paint
// ---------------------------------------------------------------------------

/**
 * The outgoing shapes the transition overlay actually has to paint.
 *
 * The overlay is one flat layer ABOVE the live stage, so everything it paints
 * hides whatever the incoming slide is doing underneath - including the shapes
 * that only exist on the incoming slide and are dissolving IN. A ghost is
 * therefore only worth that cost when it shows something the live stage cannot:
 *
 * - a shape with **no counterpart** has nowhere else to be drawn;
 * - a pair whose **appearance changed** has to dissolve its old look away, and
 *   the live element underneath is already wearing the new one;
 * - a pair that merely moved (or did not move at all) is drawn identically by
 *   its live counterpart, which travels the very same path - the ghost is a
 *   duplicate, and an opaque one.
 *
 * The last kind is kept in exactly one case: when something painted BELOW it is
 * itself dissolving, whatever is left out of the overlay would be seen through
 * that dissolve instead of over it. That is the issue #131 case (a full-slide
 * backdrop crossfading between two photos, with the wheel drawn over it) and it
 * still gets a full set of ghosts. When the backdrop is UNCHANGED, as it is on
 * every jump into this deck's detail slides, nothing needs protecting and the
 * backdrop ghost is dropped - which is what stopped the incoming callouts from
 * appearing at all until the overlay was torn down (issue #144).
 *
 * @param outgoingElements - The outgoing slide, flattened, in document order.
 * @param pairs - The matched pairs; anything not in here has no counterpart.
 * @returns The ids of the outgoing elements to paint, in the same order.
 */
export function resolveMorphGhostIds(
	outgoingElements: PptxElement[],
	pairs: MorphPair[],
): Set<string> {
	const counterparts = new Map(pairs.map((pair) => [pair.fromElement.id, pair.toElement]));
	const painted = new Set<string>();
	const paintedBoxes: MorphBox[] = [];

	for (const element of outgoingElements) {
		const counterpart = counterparts.get(element.id);
		const box = travelledBox(element, counterpart);
		const required =
			!counterpart ||
			morphPairNeedsCrossfade(element, counterpart) ||
			paintedBoxes.some((below) => boxesOverlap(below, box));
		if (required) {
			painted.add(element.id);
			paintedBoxes.push(box);
		}
	}
	return painted;
}

/**
 * Whether a crossfading pair's INCOMING half may fade in over its ghost.
 *
 * Fading both halves of a dissolve leaves the middle of the transition
 * part-transparent, so a solid object goes see-through and the background shows
 * through it - the reason the incoming half is otherwise pinned at its final
 * opacity. That only matters when the element actually paints a body: a text
 * box over `noFill` has nothing to hollow out, and pinning it means the new
 * wording is at full strength from frame 1 while the old dissolves off it,
 * which reads as the new text simply appearing rather than cross-dissolving.
 */
function crossfadeIncomingMayFadeIn(element: PptxElement): boolean {
	const image = element as { imagePath?: string; svgPath?: string };
	if (image.imagePath || image.svgPath) {
		return false;
	}
	if (!hasShapeProperties(element)) {
		return true;
	}
	const style = element.shapeStyle;
	if (!style) {
		return true;
	}
	// An explicit `a:noFill`, or a fill turned fully transparent, paints nothing.
	if (style.fillMode === 'none' || (style.fillOpacity ?? 1) === 0) {
		return true;
	}
	// Otherwise anything that names a paint - solid colour, gradient, pattern or
	// image fill - is a body that would go see-through if both halves faded.
	// `fillMode` being absent is NOT on its own evidence of no fill: a style
	// carrying only `fillColor` still paints.
	return !(
		style.fillColor ||
		style.fillGradient ||
		style.fillGradientStops?.length ||
		style.fillPatternPreset ||
		style.fillImageUrl
	);
}

// ---------------------------------------------------------------------------
// Generate CSS keyframes for morph pairs
// ---------------------------------------------------------------------------

/**
 * Generate morph animation keyframes for matched element pairs.
 *
 * Produces CSS `@keyframes` blocks that animate position, size, rotation,
 * opacity, fill colour, and stroke between matched element states.
 *
 * @param pairs - Matched element pairs from the morph matching pass.
 * @param durationMs - Animation duration in milliseconds.
 * @param _mode - Morph granularity mode (reserved for future use in this function).
 * @param ghostIds - Outgoing ids the overlay will paint (see
 *   {@link resolveMorphGhostIds}). A pair whose ghost is NOT painted has no
 *   stand-in above it, so this half must stay visible. Defaults to "all", the
 *   behaviour before the ghost set existed.
 * @returns An array of animation style descriptors for each pair.
 */
export function generateMorphAnimations(
	pairs: MorphPair[],
	durationMs: number,
	_mode: MorphMode = 'object',
	ghostIds?: ReadonlySet<string>,
): MorphAnimationStyle[] {
	const animations: MorphAnimationStyle[] = [];

	for (let index = 0; index < pairs.length; index++) {
		const { fromElement, toElement } = pairs[index];
		const ghosted = ghostIds?.has(fromElement.id) ?? true;
		// Nothing moved, nothing changed, and no ghost is painted over it: the
		// element already looks exactly as it should, for the whole morph. Leaving
		// it alone (rather than animating it from itself to itself) also keeps it
		// out of the binding's animation state, so nothing has to unwind at the end.
		if (!ghosted && isInertMorphPair(fromElement, toElement)) {
			continue;
		}
		const safeName = `pptx-morph-${index}-${toElement.id.replace(/[^a-zA-Z0-9]/gu, '')}`;

		// Position and geometry interpolation. Deltas are CENTRE to centre:
		// scale/rotate pivot on the element's own centre (`transform-origin:
		// center`), so a top-left delta would land a resized pair off by half
		// the size difference.
		const dx = fromElement.x + fromElement.width / 2 - (toElement.x + toElement.width / 2);
		const dy = fromElement.y + fromElement.height / 2 - (toElement.y + toElement.height / 2);
		const sx = Math.max(fromElement.width, 1) / Math.max(toElement.width, 1);
		const sy = Math.max(fromElement.height, 1) / Math.max(toElement.height, 1);
		const fromOpacity = fromElement.opacity ?? 1;
		const toOpacity = toElement.opacity ?? 1;

		// The animation's `transform` REPLACES the element's static transform
		// (`rotate(θ) scaleX(±1) scaleY(±1)` from the container style), so every
		// keyframe must restate the element's own rotation/flips or they vanish
		// for the whole flight and snap back at the end. The issue #131 deck
		// rotates its ring graphic per slide so the arrow points at the selected
		// wedge; interpolating only the DELTA played the ring at `rotate(dr)->0`
		// instead of `rotate(from)->rotate(to)`, sweeping giant arcs across the
		// slide. Flips use the incoming element's, stated after the rotation to
		// match the static order (right-to-left: flip first, then rotate).
		// Animate FROM an equivalent start angle that reaches the element's own
		// authored rotation over the shorter arc; the `to` frame must keep the
		// authored value so the element lands exactly on its static transform.
		const toRot = toElement.rotation ?? 0;
		const fromRot = shortestRotationTarget(toRot, fromElement.rotation ?? 0);
		const flips = `${toElement.flipHorizontal ? ' scaleX(-1)' : ''}${
			toElement.flipVertical ? ' scaleY(-1)' : ''
		}`;

		// A GHOSTED inert pair is painted twice: its ghost is a pixel-identical
		// copy sitting in the overlay directly above it. For an opaque element
		// that is invisible, but a PART-TRANSPARENT one composites with itself and
		// reads noticeably more solid for the whole transition, then snaps back
		// when the overlay is torn down - "opacity animating on elements that
		// should be unchanged" (issue #131). Hold this half hidden and let the
		// ghost be the single visible copy; both are removed together when the
		// plan ends, so the element reappears in the same frame. Where the ghost
		// was dropped as redundant (see `resolveMorphGhostIds`) this half IS the
		// single copy and the loop above has already skipped it.
		const inert = ghosted && isInertMorphPair(fromElement, toElement);
		// A restyled pair dissolves via its outgoing GHOST, which fades 1 -> 0 in
		// the overlay above this element. Only a body-less element (a text box on
		// `noFill`) may fade IN underneath it - see `crossfadeIncomingMayFadeIn`.
		const crossfadesIn =
			!inert &&
			morphPairNeedsCrossfade(fromElement, toElement) &&
			crossfadeIncomingMayFadeIn(toElement);

		// Build from/to property blocks
		const fromProps: string[] = [
			`\t\ttransform: translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(${fromRot}deg)${flips};`,
			`\t\topacity: ${inert ? 0 : crossfadesIn ? 0 : fromOpacity};`,
		];
		const toProps: string[] = [
			`\t\ttransform: translate(0, 0) scale(1, 1) rotate(${toRot}deg)${flips};`,
			`\t\topacity: ${inert ? 0 : toOpacity};`,
		];

		// Fill color interpolation
		const colorInterp = buildColorInterpolationProps(fromElement, toElement);
		if (colorInterp) {
			fromProps.push(`\t\tbackground-color: ${colorInterp.fromBg};`);
			toProps.push(`\t\tbackground-color: ${colorInterp.toBg};`);
		}

		// Stroke interpolation via outline
		const strokeInterp = buildStrokeInterpolationProps(fromElement, toElement);
		if (strokeInterp) {
			fromProps.push(`\t\toutline: ${strokeInterp.fromWidth}px solid ${strokeInterp.fromStroke};`);
			toProps.push(`\t\toutline: ${strokeInterp.toWidth}px solid ${strokeInterp.toStroke};`);
		}

		const keyframes = `
@keyframes ${safeName} {
\tfrom {
${fromProps.join('\n')}
\t}
\tto {
${toProps.join('\n')}
\t}
}`;

		animations.push({
			elementId: toElement.id,
			animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
			keyframes,
		});
	}

	return animations;
}

/**
 * Generate the OUTGOING half of every matched pair.
 *
 * The returned animations target the outgoing element, which a binding paints
 * in its transition overlay above the live stage. Each ghost travels the same
 * path as its incoming counterpart - from its own geometry to the pair's final
 * geometry - so the overlay stays a faithful, moving copy of the outgoing
 * slide for the whole transition.
 *
 * A pair whose APPEARANCE changed fades to nothing on the way, dissolving into
 * the counterpart rendered underneath. A pair that only moved keeps its opacity
 * and simply lands on the incoming geometry, where the two are pixel-identical
 * and the overlay can be torn down without a visible seam. Emitting the second
 * kind matters because the overlay is a flat layer above the stage: a
 * full-slide background that IS crossfading would otherwise hide every
 * unchanged shape until it had faded, making them pop in mid-transition.
 *
 * Like every other morph animation, the frames are ELEMENT-LOCAL: they target
 * the node that carries the element's static transform, restate that transform
 * (see `generateMorphAnimations`), pivot on the element's own centre, and move
 * by centre deltas. A binding must therefore attach these to the outgoing
 * element's positioned container itself, never to a slide-sized wrapper.
 *
 * @param pairs - Matched pairs.
 * @param durationMs - Animation duration in milliseconds.
 * @param startIndex - Index offset for unique keyframe naming.
 * @param ghostIds - Outgoing ids the overlay will paint (see
 *   {@link resolveMorphGhostIds}); pairs outside it get no ghost. Defaults to
 *   "all", the behaviour before the ghost set existed.
 * @returns Ghost animation descriptors keyed by the OUTGOING element id.
 */
export function generateMorphGhostAnimations(
	pairs: MorphPair[],
	durationMs: number,
	startIndex: number,
	ghostIds?: ReadonlySet<string>,
): MorphAnimationStyle[] {
	const animations: MorphAnimationStyle[] = [];
	for (let index = 0; index < pairs.length; index++) {
		const { fromElement, toElement } = pairs[index];
		if (ghostIds && !ghostIds.has(fromElement.id)) {
			continue;
		}
		const fadesOut = morphPairNeedsCrossfade(fromElement, toElement);
		const safeName = `pptx-morph-ghost-${startIndex + index}-${fromElement.id.replace(/[^a-zA-Z0-9]/gu, '')}`;
		const dx = toElement.x + toElement.width / 2 - (fromElement.x + fromElement.width / 2);
		const dy = toElement.y + toElement.height / 2 - (fromElement.y + fromElement.height / 2);
		const sx = Math.max(toElement.width, 1) / Math.max(fromElement.width, 1);
		const sy = Math.max(toElement.height, 1) / Math.max(fromElement.height, 1);
		// The ghost starts on its own authored rotation, so the SHORTEST-arc
		// adjustment goes on the target angle here (mirror of the incoming half).
		const fromRot = fromElement.rotation ?? 0;
		const toRot = shortestRotationTarget(fromRot, toElement.rotation ?? 0);
		const flips = `${fromElement.flipHorizontal ? ' scaleX(-1)' : ''}${
			fromElement.flipVertical ? ' scaleY(-1)' : ''
		}`;
		const keyframes = `
@keyframes ${safeName} {
\tfrom {
\t\ttransform-origin: center;
\t\ttransform: translate(0, 0) scale(1, 1) rotate(${fromRot}deg)${flips};
\t\topacity: ${fromElement.opacity ?? 1};
\t}
\tto {
\t\ttransform-origin: center;
\t\ttransform: translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(${toRot}deg)${flips};
\t\topacity: ${fadesOut ? 0 : (fromElement.opacity ?? 1)};
\t}
}`;
		animations.push({
			elementId: fromElement.id,
			animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
			keyframes,
		});
	}
	return animations;
}

/**
 * The target angle to animate TO so the element turns the short way round.
 *
 * CSS interpolates `rotate(a)` -> `rotate(b)` numerically, so a pair authored
 * at 315deg and 0deg spins -315deg (almost a full turn anti-clockwise) when
 * the shapes are only 45deg apart. PowerPoint always takes the shorter arc.
 * Returns `fromDeg` plus the delta wrapped into (-180, 180], which is the same
 * final orientation modulo 360 but the rotation a viewer expects: the issue
 * #131 deck's wheel points its arrow at the selected wedge by rotating a ring
 * in 45deg steps, so clicking the neighbouring wedge sent the arrow the long
 * way around the dial.
 *
 * An exact half turn has no shorter arc, and PowerPoint's choice there is not
 * a fixed sign: it turns CLOCKWISE when the shape starts anywhere in
 * [90, 270) and ANTI-clockwise otherwise. Measured on PowerPoint 16 by
 * sampling the rendered frames of a half-turn morph, both on the issue #131
 * wheel (0->180 anti, 45->225 anti, 90->270 clock, 135->315 clock, 180->360
 * clock, 270->90 anti) and on a synthetic two-slide deck built for the purpose
 * (0->180 anti, 45->225 anti, 90->270 clock, 270->90 anti), which agrees on
 * every case. Always taking +180 sent the wheel's arrow round the wrong side
 * for the wedge diametrically opposite the one on screen, so one click in
 * seven looked nothing like the others.
 */
export function shortestRotationTarget(fromDeg: number, toDeg: number): number {
	let delta = (toDeg - fromDeg) % 360;
	if (delta > 180) {
		delta -= 360;
	} else if (delta < -180) {
		delta += 360;
	}
	if (Math.abs(Math.abs(delta) - 180) < 1e-9) {
		const start = ((fromDeg % 360) + 360) % 360;
		delta = start >= 90 && start < 270 ? 180 : -180;
	}
	return fromDeg + delta;
}

/**
 * Restated static transform suffix (`rotate(N) scaleX(-1) scaleY(-1)`) for an
 * element. Keyframe `transform`s REPLACE the container's static transform, so
 * every frame must carry this or a rotated/flipped element loses its own
 * orientation for the duration of the animation and snaps back at the end.
 */
function staticTransformSuffix(el: PptxElement): string {
	const rot = el.rotation ?? 0;
	return ` rotate(${rot}deg)${el.flipHorizontal ? ' scaleX(-1)' : ''}${
		el.flipVertical ? ' scaleY(-1)' : ''
	}`;
}

/**
 * Generate fade-out animations for elements that only exist on the outgoing slide.
 *
 * The shape dissolves in the FIRST quarter of the morph rather than across the
 * whole of it, and holds at zero from there (see
 * {@link MORPH_FADE_OUT_END_PERCENT} for the frames that were measured). Fading
 * it over the full duration left it half-visible at the midpoint, on top of an
 * incoming replacement that was itself half-visible, so the middle of every
 * morph read as a double exposure where PowerPoint shows a clean gap.
 *
 * Nothing scales: PowerPoint's dissolve keeps the box exactly where it is.
 *
 * @param elements - Unmatched elements from the outgoing slide.
 * @param durationMs - Animation duration in milliseconds.
 * @param startIndex - Index offset for unique keyframe naming.
 * @returns An array of fade-out animation style descriptors.
 */
export function generateUnmatchedFadeOutAnimations(
	elements: PptxElement[],
	durationMs: number,
	startIndex: number,
): MorphAnimationStyle[] {
	return elements.map((el, i) => {
		const safeName = `pptx-morph-fadeout-${startIndex + i}-${el.id.replace(/[^a-zA-Z0-9]/gu, '')}`;
		const transform = `\t\ttransform: scale(1)${staticTransformSuffix(el)};`;
		const keyframes = `
@keyframes ${safeName} {
\t0% {
\t\topacity: ${el.opacity ?? 1};
${transform}
\t}
\t${MORPH_FADE_OUT_HOLD_PERCENT}% {
\t\topacity: ${el.opacity ?? 1};
${transform}
\t}
\t${MORPH_FADE_OUT_END_PERCENT}% {
\t\topacity: 0;
${transform}
\t}
\t100% {
\t\topacity: 0;
${transform}
\t}
}`;
		return {
			elementId: el.id,
			animation: `${safeName} ${durationMs}ms linear forwards`,
			keyframes,
		};
	});
}

/**
 * Generate fade-in animations for elements that only exist on the incoming slide.
 *
 * The shape stays completely invisible until the morph is
 * {@link MORPH_FADE_IN_START_PERCENT}% through, then dissolves in on a
 * decelerating curve. See that constant for the frames that were measured.
 *
 * Nothing scales: PowerPoint's dissolve keeps the box exactly where it is.
 *
 * @param elements - Unmatched elements from the incoming slide.
 * @param durationMs - Animation duration in milliseconds.
 * @param startIndex - Index offset for unique keyframe naming.
 * @returns An array of fade-in animation style descriptors.
 */
export function generateUnmatchedFadeInAnimations(
	elements: PptxElement[],
	durationMs: number,
	startIndex: number,
): MorphAnimationStyle[] {
	return elements.map((el, i) => {
		const safeName = `pptx-morph-fadein-${startIndex + i}-${el.id.replace(/[^a-zA-Z0-9]/gu, '')}`;
		const transform = `\t\ttransform: scale(1)${staticTransformSuffix(el)};`;
		const keyframes = `
@keyframes ${safeName} {
\t0% {
\t\topacity: 0;
${transform}
\t}
\t${MORPH_FADE_IN_START_PERCENT}% {
\t\topacity: 0;
\t\tanimation-timing-function: ${MORPH_FADE_IN_EASING};
${transform}
\t}
\t100% {
\t\topacity: ${el.opacity ?? 1};
${transform}
\t}
}`;
		return {
			elementId: el.id,
			animation: `${safeName} ${durationMs}ms linear forwards`,
			keyframes,
		};
	});
}

/**
 * Generate text morph animations for a matched element pair with text content.
 *
 * Produces per-token (word or character) CSS keyframes that animate
 * position, font size, color, and opacity of individual text units.
 *
 * @param pair - The matched element pair containing text.
 * @param durationMs - Animation duration in milliseconds.
 * @param mode - Whether to animate by "word" or "character".
 * @param pairIndex - Index of this pair for unique keyframe naming.
 * @returns An array of per-token animation style descriptors.
 */
export function generateTextMorphAnimations(
	pair: MorphPair,
	durationMs: number,
	mode: 'word' | 'character',
	pairIndex: number,
): MorphAnimationStyle[] {
	const fromTokens = tokenizeText(pair.fromElement, mode);
	const toTokens = tokenizeText(pair.toElement, mode);

	if (fromTokens.length === 0 && toTokens.length === 0) {
		return [];
	}

	// Order-preserving LCS diff: shared tokens slide/restyle between positions,
	// added tokens fade in, removed tokens fade out (intelligent token morph).
	const ops = diffTokens(fromTokens, toTokens);
	return buildTokenMorphAnimations(
		ops,
		pair.fromElement.id,
		pair.toElement.id,
		durationMs,
		pairIndex,
	);
}

// ---------------------------------------------------------------------------
// Full morph transition orchestrator
// ---------------------------------------------------------------------------

/**
 * Generate a complete morph transition animation set, including:
 * - Matched element morphs (position, size, rotation, opacity, color, stroke)
 * - Unmatched element fade-out / fade-in
 * - Optional text morph (word or character level)
 *
 * @param fromSlide - The outgoing slide.
 * @param toSlide - The incoming slide.
 * @param durationMs - Animation duration in milliseconds.
 * @param mode - Morph granularity: "object", "word", or "character".
 * @returns A complete array of animation style descriptors for the transition.
 */
export function generateFullMorphTransition(
	fromSlide: PptxSlide,
	toSlide: PptxSlide,
	durationMs: number,
	mode: MorphMode = 'object',
): MorphAnimationStyle[] {
	const matchResult = matchMorphElementsFull(fromSlide, toSlide);
	const allAnimations: MorphAnimationStyle[] = [];

	// Decide up front which outgoing shapes the overlay will paint: both halves
	// of a pair have to agree on it, since a hidden live element with no ghost
	// above it is an invisible shape, and a ghost with a visible element under it
	// is a double exposure.
	const ghostIds = resolveMorphGhostIds(
		flattenMorphElements(fromSlide.elements, toSlide.elements),
		matchResult.pairs,
	);

	// Generate main element morph animations
	const pairAnims = generateMorphAnimations(matchResult.pairs, durationMs, mode, ghostIds);
	allAnimations.push(...pairAnims);

	// Shape-geometry morph: for matched pairs whose shape outline changes
	// (different shape type or adjustment outline), interpolate the resolved
	// outlines instead of relying on a plain crossfade.
	for (let i = 0; i < matchResult.pairs.length; i++) {
		const geo = generateGeometryMorphAnimation(matchResult.pairs[i], durationMs, i);
		if (geo) {
			allAnimations.push(geo);
		}
	}

	// Picture crop morph: a pair whose `a:srcRect` changed zooms its source
	// region inside an otherwise unchanged frame (PowerPoint's "Scale
	// Height"/"Scale Width"). This rides the element's `<img>`, not its
	// container, so it is additive to whatever the pair does above.
	allAnimations.push(...generateImageCropMorphAnimations(matchResult.pairs, durationMs));

	// Generate text morph animations for text-bearing matched pairs
	if (mode === 'word' || mode === 'character') {
		for (let i = 0; i < matchResult.pairs.length; i++) {
			const pair = matchResult.pairs[i];
			if (hasTextProperties(pair.fromElement) && hasTextProperties(pair.toElement)) {
				const textAnims = generateTextMorphAnimations(pair, durationMs, mode, i);
				allAnimations.push(...textAnims);
			}
		}
	}

	// Outgoing half of every restyled pair's crossfade.
	const ghosts = generateMorphGhostAnimations(
		matchResult.pairs,
		durationMs,
		pairAnims.length,
		ghostIds,
	);
	allAnimations.push(...ghosts);

	// The same zoom on the painted ghosts, so a crop change that IS crossfading
	// dissolves from the region the outgoing slide actually showed.
	allAnimations.push(...generateImageCropGhostAnimations(matchResult.pairs, durationMs, ghostIds));

	// Generate fade-out for unmatched from elements
	const fadeOuts = generateUnmatchedFadeOutAnimations(
		matchResult.unmatchedFrom,
		durationMs,
		pairAnims.length + ghosts.length,
	);
	allAnimations.push(...fadeOuts);

	// Generate fade-in for unmatched to elements
	const fadeIns = generateUnmatchedFadeInAnimations(
		matchResult.unmatchedTo,
		durationMs,
		pairAnims.length + ghosts.length + fadeOuts.length,
	);
	allAnimations.push(...fadeIns);

	return allAnimations;
}
