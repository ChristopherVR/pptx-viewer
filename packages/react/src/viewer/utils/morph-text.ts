/**
 * Text tokenization and token matching for word/character-level morph transitions.
 *
 * @module utils/morph-text
 */
import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import type { MorphTextToken, MorphTextTokenPair } from './morph-types';

// ---------------------------------------------------------------------------
// Text tokenization
// ---------------------------------------------------------------------------

/**
 * Tokenize element text into word or character tokens with estimated positions.
 *
 * Character mode splits on individual characters (respecting multi-byte),
 * while word mode splits on whitespace boundaries. Positions are normalised
 * to the 0-1 range within the text frame.
 *
 * @param element - The element whose text content to tokenize.
 * @param mode - Whether to split by "word" or "character".
 * @returns An array of tokens with estimated positions and style metadata.
 */
export function tokenizeText(element: PptxElement, mode: 'word' | 'character'): MorphTextToken[] {
	if (!hasTextProperties(element) || !element.text) {
		return [];
	}

	const text = element.text;
	const style = element.textStyle;
	const fontSize = style?.fontSize ?? 14;
	const fontWeight = style?.bold ? 'bold' : 'normal';
	const color = style?.color ?? '#000000';

	const tokens: MorphTextToken[] = [];

	if (mode === 'character') {
		const chars = Array.from(text); // handle multi-byte characters
		const totalChars = chars.length;
		if (totalChars === 0) {
			return [];
		}

		// Estimate character layout: simple left-to-right single-line model
		// Normalise positions to 0-1 range within the text frame
		for (let i = 0; i < chars.length; i++) {
			if (chars[i] === '\n') {
				continue;
			} // skip newlines for position calculation
			tokens.push({
				text: chars[i],
				x: totalChars > 1 ? i / (totalChars - 1) : 0.5,
				y: 0.5,
				fontSize,
				fontWeight,
				color,
			});
		}
	} else {
		// Word mode: split on whitespace
		const words = text.split(/(\s+)/);
		const nonEmptyWords = words.filter((w) => w.trim().length > 0);
		const totalWords = nonEmptyWords.length;
		if (totalWords === 0) {
			return [];
		}

		let wordIndex = 0;
		for (const word of words) {
			if (word.trim().length === 0) {
				continue;
			}
			tokens.push({
				text: word,
				x: totalWords > 1 ? wordIndex / (totalWords - 1) : 0.5,
				y: 0.5,
				fontSize,
				fontWeight,
				color,
			});
			wordIndex++;
		}
	}

	return tokens;
}

// ---------------------------------------------------------------------------
// Token matching
// ---------------------------------------------------------------------------

/**
 * Match text tokens between source and destination for text morphing.
 *
 * Uses a simple LCS-like approach: match tokens with identical text first,
 * then pair remaining tokens by position proximity, and mark the rest as
 * appearing/disappearing (null on one side).
 *
 * @param fromTokens - Tokens from the outgoing element.
 * @param toTokens - Tokens from the incoming element.
 * @returns Paired tokens, including unmatched ones with null on one side.
 */
export function matchTextTokens(
	fromTokens: MorphTextToken[],
	toTokens: MorphTextToken[],
): MorphTextTokenPair[] {
	const pairs: MorphTextTokenPair[] = [];
	const usedFrom = new Set<number>();
	const usedTo = new Set<number>();

	// Pass 1: exact text matches (preserving order)
	for (let fi = 0; fi < fromTokens.length; fi++) {
		if (usedFrom.has(fi)) {
			continue;
		}
		for (let ti = 0; ti < toTokens.length; ti++) {
			if (usedTo.has(ti)) {
				continue;
			}
			if (fromTokens[fi].text === toTokens[ti].text) {
				pairs.push({ from: fromTokens[fi], to: toTokens[ti] });
				usedFrom.add(fi);
				usedTo.add(ti);
				break;
			}
		}
	}

	// Pass 2: match remaining tokens by position proximity
	for (let fi = 0; fi < fromTokens.length; fi++) {
		if (usedFrom.has(fi)) {
			continue;
		}
		let bestTi = -1;
		let bestDist = Infinity;
		for (let ti = 0; ti < toTokens.length; ti++) {
			if (usedTo.has(ti)) {
				continue;
			}
			const dx = fromTokens[fi].x - toTokens[ti].x;
			const dy = fromTokens[fi].y - toTokens[ti].y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < bestDist) {
				bestDist = dist;
				bestTi = ti;
			}
		}
		if (bestTi >= 0 && bestDist < 2) {
			pairs.push({ from: fromTokens[fi], to: toTokens[bestTi] });
			usedFrom.add(fi);
			usedTo.add(bestTi);
		}
	}

	// Unmatched from tokens: fade out
	for (let fi = 0; fi < fromTokens.length; fi++) {
		if (!usedFrom.has(fi)) {
			pairs.push({ from: fromTokens[fi], to: null });
		}
	}

	// Unmatched to tokens: fade in
	for (let ti = 0; ti < toTokens.length; ti++) {
		if (!usedTo.has(ti)) {
			pairs.push({ from: null, to: toTokens[ti] });
		}
	}

	return pairs;
}
