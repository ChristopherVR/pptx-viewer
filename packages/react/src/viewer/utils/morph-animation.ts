/**
 * CSS keyframe generation for morph transitions.
 *
 * Generates per-element CSS keyframe animation data for matched and
 * unmatched elements, including fill colour interpolation, stroke
 * interpolation, text morph animations, and DOM style injection.
 *
 * @module utils/morph-animation
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { hasTextProperties, hasShapeProperties } from 'pptx-viewer-core';

import { parseHexColor, lerpColor } from './morph-color';
import { matchMorphElementsFull } from './morph-matching';
import { tokenizeText, matchTextTokens } from './morph-text';
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
		const safeName = `pptx-morph-${index}-${toElement.id.replace(/[^a-zA-Z0-9]/g, '')}`;

		// Position and geometry interpolation
		const dx = fromElement.x - toElement.x;
		const dy = fromElement.y - toElement.y;
		const sx = Math.max(fromElement.width, 1) / Math.max(toElement.width, 1);
		const sy = Math.max(fromElement.height, 1) / Math.max(toElement.height, 1);
		const dr = (fromElement.rotation ?? 0) - (toElement.rotation ?? 0);
		const fromOpacity = fromElement.opacity ?? 1;
		const toOpacity = toElement.opacity ?? 1;

		// Build from/to property blocks
		const fromProps: string[] = [
			`\t\ttransform: translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(${dr}deg);`,
			`\t\topacity: ${fromOpacity};`,
		];
		const toProps: string[] = [
			'\t\ttransform: translate(0, 0) scale(1, 1) rotate(0deg);',
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
		const safeName = `pptx-morph-fadeout-${startIndex + i}-${el.id.replace(/[^a-zA-Z0-9]/g, '')}`;
		const keyframes = `
@keyframes ${safeName} {
\tfrom {
\t\topacity: ${el.opacity ?? 1};
\t\ttransform: scale(1);
\t}
\tto {
\t\topacity: 0;
\t\ttransform: scale(0.95);
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
		const safeName = `pptx-morph-fadein-${startIndex + i}-${el.id.replace(/[^a-zA-Z0-9]/g, '')}`;
		const keyframes = `
@keyframes ${safeName} {
\tfrom {
\t\topacity: 0;
\t\ttransform: scale(0.95);
\t}
\tto {
\t\topacity: ${el.opacity ?? 1};
\t\ttransform: scale(1);
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

	const tokenPairs = matchTextTokens(fromTokens, toTokens);
	const animations: MorphAnimationStyle[] = [];

	for (let ti = 0; ti < tokenPairs.length; ti++) {
		const tp = tokenPairs[ti];
		const safeName = `pptx-morph-text-${pairIndex}-${ti}`;

		if (tp.from && tp.to) {
			// Matched token: animate position, size, color
			const fromX = tp.from.x * 100;
			const toX = tp.to.x * 100;
			const fromColor = parseHexColor(tp.from.color);
			const toColor = parseHexColor(tp.to.color);
			const fromColorStr = fromColor ? lerpColor(fromColor, fromColor, 0) : tp.from.color;
			const toColorStr = toColor ? lerpColor(toColor, toColor, 0) : tp.to.color;

			const keyframes = `
@keyframes ${safeName} {
\tfrom {
\t\tleft: ${fromX}%;
\t\tfont-size: ${tp.from.fontSize}pt;
\t\tfont-weight: ${tp.from.fontWeight};
\t\tcolor: ${fromColorStr};
\t\topacity: 1;
\t}
\tto {
\t\tleft: ${toX}%;
\t\tfont-size: ${tp.to.fontSize}pt;
\t\tfont-weight: ${tp.to.fontWeight};
\t\tcolor: ${toColorStr};
\t\topacity: 1;
\t}
}`;
			animations.push({
				elementId: `${pair.toElement.id}__token_${ti}`,
				animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
				keyframes,
			});
		} else if (tp.from && !tp.to) {
			// Disappearing token: fade out
			const keyframes = `
@keyframes ${safeName} {
\tfrom { opacity: 1; }
\tto { opacity: 0; }
}`;
			animations.push({
				elementId: `${pair.fromElement.id}__token_${ti}`,
				animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
				keyframes,
			});
		} else if (!tp.from && tp.to) {
			// Appearing token: fade in
			const keyframes = `
@keyframes ${safeName} {
\tfrom { opacity: 0; }
\tto { opacity: 1; }
}`;
			animations.push({
				elementId: `${pair.toElement.id}__token_${ti}`,
				animation: `${safeName} ${durationMs}ms ${MORPH_EASING} forwards`,
				keyframes,
			});
		}
	}

	return animations;
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

	// Generate fade-out for unmatched from elements
	const fadeOuts = generateUnmatchedFadeOutAnimations(
		matchResult.unmatchedFrom,
		durationMs,
		pairAnims.length,
	);
	allAnimations.push(...fadeOuts);

	// Generate fade-in for unmatched to elements
	const fadeIns = generateUnmatchedFadeInAnimations(
		matchResult.unmatchedTo,
		durationMs,
		pairAnims.length + fadeOuts.length,
	);
	allAnimations.push(...fadeIns);

	return allAnimations;
}

// ---------------------------------------------------------------------------
// Inject morph keyframes into the document
// ---------------------------------------------------------------------------

let morphStyleElement: HTMLStyleElement | null = null;

/**
 * Inject morph keyframe CSS into the document's `<head>`.
 * Removes any previously injected morph styles first.
 *
 * @param animations - The animation style descriptors whose keyframes to inject.
 */
export function injectMorphKeyframes(animations: MorphAnimationStyle[]): void {
	if (morphStyleElement) {
		morphStyleElement.remove();
		morphStyleElement = null;
	}

	if (animations.length === 0) {
		return;
	}

	const css = animations.map((a) => a.keyframes).join('\n');
	morphStyleElement = document.createElement('style');
	morphStyleElement.textContent = css;
	document.head.appendChild(morphStyleElement);
}

/**
 * Remove any previously injected morph keyframe styles from the document.
 */
export function cleanupMorphKeyframes(): void {
	if (morphStyleElement) {
		morphStyleElement.remove();
		morphStyleElement = null;
	}
}
