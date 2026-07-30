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
import { generateGeometryMorphAnimation } from './morph-geometry-keyframes';
import { matchMorphElementsFull } from './morph-matching';
import { tokenizeText } from './morph-text';
import { buildTokenMorphAnimations, diffTokens } from './morph-text-tokens';
import type { MorphAnimationStyle, MorphMode, MorphPair } from './morph-types';
import { MORPH_EASING } from './morph-types';

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
 * @returns An array of animation style descriptors for each pair.
 */
export function generateMorphAnimations(
	pairs: MorphPair[],
	durationMs: number,
	_mode: MorphMode = 'object',
): MorphAnimationStyle[] {
	const animations: MorphAnimationStyle[] = [];

	for (let index = 0; index < pairs.length; index++) {
		const { fromElement, toElement } = pairs[index];
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

		// A restyled pair dissolves via its outgoing GHOST, which is painted in
		// the overlay directly above this element and fades 1 -> 0 (see
		// `generateMorphGhostAnimations`). This half therefore has to stay at its
		// final opacity for the whole flight: fading it IN as well left both
		// layers part-transparent in the middle of the transition, so the
		// background showed straight through what should be a solid object and
		// both states were legible at once (issue #131: the wheel's centre disc
		// went see-through mid-morph where PowerPoint keeps it solid and only
		// dissolves the content on top of it).

		// Build from/to property blocks
		const fromProps: string[] = [
			`\t\ttransform: translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(${fromRot}deg)${flips};`,
			`\t\topacity: ${fromOpacity};`,
		];
		const toProps: string[] = [
			`\t\ttransform: translate(0, 0) scale(1, 1) rotate(${toRot}deg)${flips};`,
			`\t\topacity: ${toOpacity};`,
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
 * @returns Ghost animation descriptors keyed by the OUTGOING element id.
 */
export function generateMorphGhostAnimations(
	pairs: MorphPair[],
	durationMs: number,
	startIndex: number,
): MorphAnimationStyle[] {
	const animations: MorphAnimationStyle[] = [];
	for (let index = 0; index < pairs.length; index++) {
		const { fromElement, toElement } = pairs[index];
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
 * A half turn is ambiguous; +180 (clockwise) is chosen so the direction is at
 * least deterministic.
 */
export function shortestRotationTarget(fromDeg: number, toDeg: number): number {
	let delta = (toDeg - fromDeg) % 360;
	if (delta > 180) {
		delta -= 360;
	} else if (delta <= -180) {
		delta += 360;
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
		const keyframes = `
@keyframes ${safeName} {
\tfrom {
\t\topacity: ${el.opacity ?? 1};
\t\ttransform: scale(1)${staticTransformSuffix(el)};
\t}
\tto {
\t\topacity: 0;
\t\ttransform: scale(0.95)${staticTransformSuffix(el)};
\t}
}`;
		return {
			elementId: el.id,
			animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
			keyframes,
		};
	});
}

/**
 * Generate fade-in animations for elements that only exist on the incoming slide.
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
		const keyframes = `
@keyframes ${safeName} {
\tfrom {
\t\topacity: 0;
\t\ttransform: scale(0.95)${staticTransformSuffix(el)};
\t}
\tto {
\t\topacity: ${el.opacity ?? 1};
\t\ttransform: scale(1)${staticTransformSuffix(el)};
\t}
}`;
		return {
			elementId: el.id,
			animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
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

	// Generate main element morph animations
	const pairAnims = generateMorphAnimations(matchResult.pairs, durationMs, mode);
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
	const ghosts = generateMorphGhostAnimations(matchResult.pairs, durationMs, pairAnims.length);
	allAnimations.push(...ghosts);

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
