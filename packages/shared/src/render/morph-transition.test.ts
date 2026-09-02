import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	generateMorphAnimations,
	isInertMorphPair,
	generateMorphGhostAnimations,
	shortestRotationTarget,
	generateUnmatchedFadeOutAnimations,
	generateUnmatchedFadeInAnimations,
	generateTextMorphAnimations,
	generateFullMorphTransition,
	buildColorInterpolationProps,
	buildStrokeInterpolationProps,
	morphPairNeedsCrossfade,
	computeZOrderSwaps,
} from './morph-animation';
import { parseHexColor, lerpColor, rgbaToHex } from './morph-color';
import { matchMorphElements, matchMorphElementsFull, getElementMorphName } from './morph-matching';
import { parseSvgPath, serializeSvgPath, equalizePaths, interpolatePaths } from './morph-svg-path';
import { tokenizeText, matchTextTokens } from './morph-text';
import {
	MORPH_CROSSFADE_EASING,
	MORPH_EASING,
	MORPH_FADE_IN_EASING,
	MORPH_FADE_IN_START_PERCENT,
	MORPH_FADE_OUT_END_PERCENT,
	MORPH_FADE_OUT_HOLD_PERCENT,
} from './morph-types';
import type { MorphPair, RgbaColor, SvgPathCommand } from './morph-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElement(
	overrides: Partial<PptxElement> & { id: string; type: PptxElement['type'] },
): PptxElement {
	return {
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

function makeSlide(elements: PptxElement[]): PptxSlide {
	return {
		id: 'slide-1',
		elements,
	} as PptxSlide;
}

// ==========================================================================
// parseHexColor
// ==========================================================================

describe('parseHexColor', () => {
	it('parses 6-digit hex', () => {
		const c = parseHexColor('#FF8800');
		expect(c).toStrictEqual({ r: 255, g: 136, b: 0, a: 1 });
	});

	it('parses 6-digit hex without #', () => {
		const c = parseHexColor('FF8800');
		expect(c).toStrictEqual({ r: 255, g: 136, b: 0, a: 1 });
	});

	it('parses 3-digit shorthand hex', () => {
		const c = parseHexColor('#F80');
		expect(c).toStrictEqual({ r: 255, g: 136, b: 0, a: 1 });
	});

	it('parses 8-digit hex with alpha', () => {
		const c = parseHexColor('#FF880080');
		expect(c).not.toBeNull();
		expect(c!.r).toBe(255);
		expect(c!.g).toBe(136);
		expect(c!.b).toBe(0);
		expect(c!.a).toBeCloseTo(128 / 255, 2);
	});

	it('parses 4-digit shorthand with alpha', () => {
		const c = parseHexColor('#F808');
		expect(c).not.toBeNull();
		expect(c!.r).toBe(255);
		expect(c!.g).toBe(136);
		expect(c!.b).toBe(0);
		expect(c!.a).toBeCloseTo(136 / 255, 2);
	});

	it('returns null for undefined', () => {
		expect(parseHexColor(undefined)).toBeNull();
	});

	it('returns null for empty string', () => {
		expect(parseHexColor('')).toBeNull();
	});

	it('returns null for invalid hex', () => {
		expect(parseHexColor('#ZZZZZZ')).toBeNull();
	});

	it('returns null for wrong length', () => {
		expect(parseHexColor('#12345')).toBeNull();
	});
});

// ==========================================================================
// lerpColor
// ==========================================================================

describe('lerpColor', () => {
	const black: RgbaColor = { r: 0, g: 0, b: 0, a: 1 };
	const white: RgbaColor = { r: 255, g: 255, b: 255, a: 1 };

	it('returns from color at t=0', () => {
		expect(lerpColor(black, white, 0)).toBe('rgba(0, 0, 0, 1)');
	});

	it('returns to color at t=1', () => {
		expect(lerpColor(black, white, 1)).toBe('rgba(255, 255, 255, 1)');
	});

	it('returns midpoint at t=0.5', () => {
		const result = lerpColor(black, white, 0.5);
		expect(result).toBe('rgba(128, 128, 128, 1)');
	});

	it('clamps t below 0', () => {
		expect(lerpColor(black, white, -1)).toBe('rgba(0, 0, 0, 1)');
	});

	it('clamps t above 1', () => {
		expect(lerpColor(black, white, 2)).toBe('rgba(255, 255, 255, 1)');
	});

	it('interpolates alpha channel', () => {
		const from = { r: 0, g: 0, b: 0, a: 0 };
		const to = { r: 0, g: 0, b: 0, a: 1 };
		const result = lerpColor(from, to, 0.5);
		expect(result).toBe('rgba(0, 0, 0, 0.5)');
	});
});

// ==========================================================================
// rgbaToHex
// ==========================================================================

describe('rgbaToHex', () => {
	it('converts opaque color to 6-digit hex', () => {
		expect(rgbaToHex({ r: 255, g: 136, b: 0, a: 1 })).toBe('#ff8800');
	});

	it('converts color with alpha to 8-digit hex', () => {
		const result = rgbaToHex({ r: 255, g: 0, b: 0, a: 0.5 });
		expect(result).toBe('#ff000080');
	});

	it('converts black', () => {
		expect(rgbaToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe('#000000');
	});

	it('converts white', () => {
		expect(rgbaToHex({ r: 255, g: 255, b: 255, a: 1 })).toBe('#ffffff');
	});
});

// ==========================================================================
// SVG path parsing
// ==========================================================================

describe('parseSvgPath', () => {
	it('parses simple M L Z path', () => {
		const cmds = parseSvgPath('M0 0 L100 0 L100 100 Z');
		expect(cmds).toHaveLength(4);
		expect(cmds[0]).toStrictEqual({ type: 'M', values: [0, 0] });
		expect(cmds[1]).toStrictEqual({ type: 'L', values: [100, 0] });
		expect(cmds[2]).toStrictEqual({ type: 'L', values: [100, 100] });
		expect(cmds[3]).toStrictEqual({ type: 'Z', values: [] });
	});

	it('parses cubic bezier commands', () => {
		const cmds = parseSvgPath('M0 0 C10 20 30 40 50 60');
		expect(cmds).toHaveLength(2);
		expect(cmds[1]).toStrictEqual({ type: 'C', values: [10, 20, 30, 40, 50, 60] });
	});

	it('handles negative values', () => {
		const cmds = parseSvgPath('M-10 -20 L-30 -40');
		expect(cmds[0].values).toStrictEqual([-10, -20]);
		expect(cmds[1].values).toStrictEqual([-30, -40]);
	});

	it('handles decimal values', () => {
		const cmds = parseSvgPath('M0.5 1.5 L2.25 3.75');
		expect(cmds[0].values).toStrictEqual([0.5, 1.5]);
		expect(cmds[1].values).toStrictEqual([2.25, 3.75]);
	});

	it('returns empty array for empty string', () => {
		expect(parseSvgPath('')).toStrictEqual([]);
	});

	it('returns empty array for undefined-like input', () => {
		expect(parseSvgPath(null as unknown as string)).toStrictEqual([]);
	});

	it('handles lowercase (relative) commands', () => {
		const cmds = parseSvgPath('m0 0 l10 10 z');
		expect(cmds).toHaveLength(3);
		expect(cmds[0].type).toBe('m');
		expect(cmds[1].type).toBe('l');
	});
});

describe('serializeSvgPath', () => {
	it('serializes commands back to string', () => {
		const cmds: SvgPathCommand[] = [
			{ type: 'M', values: [0, 0] },
			{ type: 'L', values: [100, 50] },
			{ type: 'Z', values: [] },
		];
		const result = serializeSvgPath(cmds);
		expect(result).toBe('M0 0 L100 50 Z');
	});

	it('rounds to 2 decimal places', () => {
		const cmds: SvgPathCommand[] = [{ type: 'M', values: [1.23456, 7.89012] }];
		const result = serializeSvgPath(cmds);
		expect(result).toBe('M1.23 7.89');
	});
});

// ==========================================================================
// SVG path equalisation
// ==========================================================================

describe('equalizePaths', () => {
	it('returns null for empty input', () => {
		expect(equalizePaths([], [{ type: 'M', values: [0, 0] }])).toBeNull();
		expect(equalizePaths([{ type: 'M', values: [0, 0] }], [])).toBeNull();
	});

	it('keeps same-length paths unchanged', () => {
		const a: SvgPathCommand[] = [
			{ type: 'M', values: [0, 0] },
			{ type: 'L', values: [100, 100] },
			{ type: 'Z', values: [] },
		];
		const b: SvgPathCommand[] = [
			{ type: 'M', values: [10, 10] },
			{ type: 'L', values: [200, 200] },
			{ type: 'Z', values: [] },
		];
		const result = equalizePaths(a, b);
		expect(result).not.toBeNull();
		expect(result![0]).toHaveLength(3);
		expect(result![1]).toHaveLength(3);
	});

	it('pads shorter path to match longer', () => {
		const a: SvgPathCommand[] = [
			{ type: 'M', values: [0, 0] },
			{ type: 'L', values: [100, 0] },
			{ type: 'Z', values: [] },
		];
		const b: SvgPathCommand[] = [
			{ type: 'M', values: [0, 0] },
			{ type: 'L', values: [50, 0] },
			{ type: 'L', values: [100, 50] },
			{ type: 'L', values: [100, 100] },
			{ type: 'Z', values: [] },
		];
		const result = equalizePaths(a, b);
		expect(result).not.toBeNull();
		expect(result![0]).toHaveLength(result![1].length);
	});

	it('promotes L to C when paired with C', () => {
		const a: SvgPathCommand[] = [
			{ type: 'M', values: [0, 0] },
			{ type: 'L', values: [100, 100] },
		];
		const b: SvgPathCommand[] = [
			{ type: 'M', values: [0, 0] },
			{ type: 'C', values: [10, 20, 30, 40, 100, 100] },
		];
		const result = equalizePaths(a, b);
		expect(result).not.toBeNull();
		// The L should have been converted to C with 6 values
		expect(result![0][1].type).toBe('C');
		expect(result![0][1].values).toHaveLength(6);
	});

	it('equalises value counts by padding with zeros', () => {
		const a: SvgPathCommand[] = [{ type: 'M', values: [0, 0] }];
		const b: SvgPathCommand[] = [{ type: 'M', values: [0, 0, 10, 20] }];
		const result = equalizePaths(a, b);
		expect(result).not.toBeNull();
		expect(result![0][0].values).toHaveLength(4);
		expect(result![1][0].values).toHaveLength(4);
	});
});

// ==========================================================================
// SVG path interpolation
// ==========================================================================

describe('interpolatePaths', () => {
	it('returns from path at t=0', () => {
		const from: SvgPathCommand[] = [
			{ type: 'M', values: [0, 0] },
			{ type: 'L', values: [100, 0] },
		];
		const to: SvgPathCommand[] = [
			{ type: 'M', values: [50, 50] },
			{ type: 'L', values: [200, 100] },
		];
		const result = interpolatePaths(from, to, 0);
		expect(result[0].values).toStrictEqual([0, 0]);
		expect(result[1].values).toStrictEqual([100, 0]);
	});

	it('returns to path at t=1', () => {
		const from: SvgPathCommand[] = [
			{ type: 'M', values: [0, 0] },
			{ type: 'L', values: [100, 0] },
		];
		const to: SvgPathCommand[] = [
			{ type: 'M', values: [50, 50] },
			{ type: 'L', values: [200, 100] },
		];
		const result = interpolatePaths(from, to, 1);
		expect(result[0].values).toStrictEqual([50, 50]);
		expect(result[1].values).toStrictEqual([200, 100]);
	});

	it('returns midpoint at t=0.5', () => {
		const from: SvgPathCommand[] = [{ type: 'M', values: [0, 0] }];
		const to: SvgPathCommand[] = [{ type: 'M', values: [100, 200] }];
		const result = interpolatePaths(from, to, 0.5);
		expect(result[0].values[0]).toBeCloseTo(50);
		expect(result[0].values[1]).toBeCloseTo(100);
	});

	it('clamps t below 0', () => {
		const from: SvgPathCommand[] = [{ type: 'M', values: [0, 0] }];
		const to: SvgPathCommand[] = [{ type: 'M', values: [100, 100] }];
		const result = interpolatePaths(from, to, -1);
		expect(result[0].values).toStrictEqual([0, 0]);
	});

	it('clamps t above 1', () => {
		const from: SvgPathCommand[] = [{ type: 'M', values: [0, 0] }];
		const to: SvgPathCommand[] = [{ type: 'M', values: [100, 100] }];
		const result = interpolatePaths(from, to, 2);
		expect(result[0].values).toStrictEqual([100, 100]);
	});

	it("preserves command types from 'to' array", () => {
		const from: SvgPathCommand[] = [
			{ type: 'M', values: [0, 0] },
			{ type: 'Z', values: [] },
		];
		const to: SvgPathCommand[] = [
			{ type: 'M', values: [10, 10] },
			{ type: 'Z', values: [] },
		];
		const result = interpolatePaths(from, to, 0.5);
		expect(result[1].type).toBe('Z');
	});
});

// ==========================================================================
// getElementMorphName
// ==========================================================================

describe('getElementMorphName', () => {
	it('returns !! prefixed text as morph name', () => {
		const el = makeElement({ id: 'a', type: 'text', text: '!!hero' });
		expect(getElementMorphName(el)).toBe('!!hero');
	});

	it('trims whitespace around !! name', () => {
		const el = makeElement({ id: 'a', type: 'text', text: '  !!title  ' });
		expect(getElementMorphName(el)).toBe('!!title');
	});

	it('returns undefined for text without !! prefix', () => {
		const el = makeElement({ id: 'a', type: 'text', text: 'Hello World' });
		expect(getElementMorphName(el)).toBeUndefined();
	});

	it('returns undefined for shape element without text', () => {
		const el = makeElement({ id: 'a', type: 'shape' });
		expect(getElementMorphName(el)).toBeUndefined();
	});

	it('returns undefined for image element', () => {
		const el = makeElement({ id: 'a', type: 'image' });
		expect(getElementMorphName(el)).toBeUndefined();
	});

	it('returns undefined for empty text', () => {
		const el = makeElement({ id: 'a', type: 'text', text: '' });
		expect(getElementMorphName(el)).toBeUndefined();
	});
});

// ==========================================================================
// matchMorphElements
// ==========================================================================

describe('matchMorphElements', () => {
	it('should match elements by !! naming convention', () => {
		const from = makeSlide([makeElement({ id: 'a', type: 'text', text: '!!title', x: 10, y: 10 })]);
		const to = makeSlide([makeElement({ id: 'b', type: 'text', text: '!!title', x: 50, y: 50 })]);
		const pairs = matchMorphElements(from, to);
		expect(pairs).toHaveLength(1);
		expect(pairs[0].fromElement.id).toBe('a');
		expect(pairs[0].toElement.id).toBe('b');
	});

	it('should match elements by ID when names do not match', () => {
		const from = makeSlide([makeElement({ id: 'elem1', type: 'shape', x: 0, y: 0 })]);
		const to = makeSlide([makeElement({ id: 'elem1', type: 'shape', x: 100, y: 100 })]);
		const pairs = matchMorphElements(from, to);
		expect(pairs).toHaveLength(1);
		expect(pairs[0].fromElement.id).toBe('elem1');
		expect(pairs[0].toElement.id).toBe('elem1');
	});

	it('should match by type and proximity as third pass', () => {
		const from = makeSlide([makeElement({ id: 'a', type: 'shape', x: 10, y: 10 })]);
		const to = makeSlide([makeElement({ id: 'b', type: 'shape', x: 20, y: 20 })]);
		const pairs = matchMorphElements(from, to);
		expect(pairs).toHaveLength(1);
		expect(pairs[0].fromElement.id).toBe('a');
		expect(pairs[0].toElement.id).toBe('b');
	});

	it('should not match by proximity when distance exceeds 300px', () => {
		const from = makeSlide([makeElement({ id: 'a', type: 'shape', x: 0, y: 0 })]);
		const to = makeSlide([makeElement({ id: 'b', type: 'shape', x: 500, y: 500 })]);
		const pairs = matchMorphElements(from, to);
		expect(pairs).toHaveLength(0);
	});

	it('should not match elements of different types by proximity', () => {
		const from = makeSlide([makeElement({ id: 'a', type: 'shape', x: 10, y: 10 })]);
		const to = makeSlide([makeElement({ id: 'b', type: 'image', x: 15, y: 15 })]);
		const pairs = matchMorphElements(from, to);
		expect(pairs).toHaveLength(0);
	});

	it('should prefer !! naming over ID matching', () => {
		const from = makeSlide([
			makeElement({
				id: 'shared',
				type: 'text',
				text: '!!hero',
				x: 0,
				y: 0,
			}),
		]);
		const to = makeSlide([
			makeElement({
				id: 'different',
				type: 'text',
				text: '!!hero',
				x: 50,
				y: 50,
			}),
			makeElement({
				id: 'shared',
				type: 'text',
				text: 'other',
				x: 100,
				y: 100,
			}),
		]);
		const pairs = matchMorphElements(from, to);
		const heroPair = pairs.find((p) => p.fromElement.id === 'shared');
		expect(heroPair).toBeDefined();
		expect(heroPair!.toElement.id).toBe('different');
	});

	it('should return empty array when both slides have no elements', () => {
		const from = makeSlide([]);
		const to = makeSlide([]);
		expect(matchMorphElements(from, to)).toStrictEqual([]);
	});

	it('should handle unmatched elements on both slides', () => {
		const from = makeSlide([makeElement({ id: 'a', type: 'shape', x: 0, y: 0 })]);
		const to = makeSlide([makeElement({ id: 'b', type: 'image', x: 500, y: 500 })]);
		const pairs = matchMorphElements(from, to);
		expect(pairs).toHaveLength(0);
	});

	it('should match multiple elements in order', () => {
		const from = makeSlide([
			makeElement({ id: 'a', type: 'text', text: '!!first', x: 10, y: 10 }),
			makeElement({ id: 'b', type: 'text', text: '!!second', x: 10, y: 100 }),
		]);
		const to = makeSlide([
			makeElement({ id: 'c', type: 'text', text: '!!second', x: 50, y: 100 }),
			makeElement({ id: 'd', type: 'text', text: '!!first', x: 50, y: 10 }),
		]);
		const pairs = matchMorphElements(from, to);
		expect(pairs).toHaveLength(2);
		expect(pairs[0].fromElement.id).toBe('a');
		expect(pairs[0].toElement.id).toBe('d');
		expect(pairs[1].fromElement.id).toBe('b');
		expect(pairs[1].toElement.id).toBe('c');
	});

	it('should not double-match elements', () => {
		const from = makeSlide([
			makeElement({ id: 'a', type: 'shape', x: 10, y: 10 }),
			makeElement({ id: 'b', type: 'shape', x: 15, y: 15 }),
		]);
		const to = makeSlide([makeElement({ id: 'c', type: 'shape', x: 12, y: 12 })]);
		const pairs = matchMorphElements(from, to);
		// Only one element on the to-side, so only one pair
		expect(pairs).toHaveLength(1);
	});
});

// ==========================================================================
// matchMorphElementsFull
// ==========================================================================

describe('matchMorphElementsFull', () => {
	it('returns unmatched from elements', () => {
		const from = makeSlide([
			makeElement({ id: 'a', type: 'shape', x: 0, y: 0 }),
			makeElement({ id: 'b', type: 'shape', x: 500, y: 500 }),
		]);
		const to = makeSlide([makeElement({ id: 'a', type: 'shape', x: 10, y: 10 })]);
		const result = matchMorphElementsFull(from, to);
		expect(result.pairs).toHaveLength(1);
		expect(result.unmatchedFrom).toHaveLength(1);
		expect(result.unmatchedFrom[0].id).toBe('b');
		expect(result.unmatchedTo).toHaveLength(0);
	});

	it('returns unmatched to elements', () => {
		const from = makeSlide([makeElement({ id: 'a', type: 'shape', x: 0, y: 0 })]);
		const to = makeSlide([
			makeElement({ id: 'a', type: 'shape', x: 10, y: 10 }),
			makeElement({ id: 'c', type: 'image', x: 200, y: 200 }),
		]);
		const result = matchMorphElementsFull(from, to);
		expect(result.pairs).toHaveLength(1);
		expect(result.unmatchedFrom).toHaveLength(0);
		expect(result.unmatchedTo).toHaveLength(1);
		expect(result.unmatchedTo[0].id).toBe('c');
	});

	it('returns all elements as unmatched when no matches found', () => {
		const from = makeSlide([makeElement({ id: 'a', type: 'shape', x: 0, y: 0 })]);
		const to = makeSlide([makeElement({ id: 'b', type: 'image', x: 500, y: 500 })]);
		const result = matchMorphElementsFull(from, to);
		expect(result.pairs).toHaveLength(0);
		expect(result.unmatchedFrom).toHaveLength(1);
		expect(result.unmatchedTo).toHaveLength(1);
	});
});

// ==========================================================================
// Text tokenization
// ==========================================================================

describe('tokenizeText', () => {
	it('tokenizes by character', () => {
		const el = makeElement({
			id: 'a',
			type: 'text',
			text: 'Hello',
			textStyle: { fontSize: 24 },
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const tokens = tokenizeText(el, 'character');
		expect(tokens).toHaveLength(5);
		expect(tokens[0].text).toBe('H');
		expect(tokens[4].text).toBe('o');
		expect(tokens[0].fontSize).toBe(24);
	});

	it('tokenizes by word', () => {
		const el = makeElement({
			id: 'a',
			type: 'text',
			text: 'Hello World',
			textStyle: { fontSize: 18 },
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const tokens = tokenizeText(el, 'word');
		expect(tokens).toHaveLength(2);
		expect(tokens[0].text).toBe('Hello');
		expect(tokens[1].text).toBe('World');
	});

	it('returns empty for non-text elements', () => {
		const el = makeElement({ id: 'a', type: 'image' });
		expect(tokenizeText(el, 'word')).toStrictEqual([]);
	});

	it('returns empty for element with no text', () => {
		const el = makeElement({ id: 'a', type: 'text' });
		expect(tokenizeText(el, 'character')).toStrictEqual([]);
	});

	it('assigns normalised x positions for characters', () => {
		const el = makeElement({
			id: 'a',
			type: 'text',
			text: 'ABC',
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const tokens = tokenizeText(el, 'character');
		expect(tokens[0].x).toBe(0);
		expect(tokens[1].x).toBe(0.5);
		expect(tokens[2].x).toBe(1);
	});

	it('handles single character', () => {
		const el = makeElement({
			id: 'a',
			type: 'text',
			text: 'X',
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const tokens = tokenizeText(el, 'character');
		expect(tokens).toHaveLength(1);
		expect(tokens[0].x).toBe(0.5);
	});

	it('uses default font size when not specified', () => {
		const el = makeElement({
			id: 'a',
			type: 'text',
			text: 'Hi',
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const tokens = tokenizeText(el, 'word');
		expect(tokens[0].fontSize).toBe(14);
	});

	it('detects bold weight', () => {
		const el = makeElement({
			id: 'a',
			type: 'text',
			text: 'Bold',
			textStyle: { bold: true },
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const tokens = tokenizeText(el, 'word');
		expect(tokens[0].fontWeight).toBe('bold');
	});

	it('skips newlines in character mode', () => {
		const el = makeElement({
			id: 'a',
			type: 'text',
			text: 'A\nB',
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const tokens = tokenizeText(el, 'character');
		expect(tokens).toHaveLength(2);
		expect(tokens[0].text).toBe('A');
		expect(tokens[1].text).toBe('B');
	});
});

// ==========================================================================
// matchTextTokens
// ==========================================================================

describe('matchTextTokens', () => {
	it('matches identical tokens by text', () => {
		const from = [
			{ text: 'Hello', x: 0, y: 0.5, fontSize: 14, fontWeight: 'normal', color: '#000' },
			{ text: 'World', x: 1, y: 0.5, fontSize: 14, fontWeight: 'normal', color: '#000' },
		];
		const to = [
			{ text: 'Hello', x: 0.2, y: 0.5, fontSize: 18, fontWeight: 'bold', color: '#F00' },
			{ text: 'World', x: 0.8, y: 0.5, fontSize: 18, fontWeight: 'bold', color: '#F00' },
		];
		const pairs = matchTextTokens(from, to);
		// Both matched
		const matched = pairs.filter((p) => p.from && p.to);
		expect(matched).toHaveLength(2);
		expect(matched[0].from!.text).toBe('Hello');
		expect(matched[0].to!.text).toBe('Hello');
	});

	it('marks disappearing tokens with null to', () => {
		const from = [
			{ text: 'Gone', x: 0, y: 0.5, fontSize: 14, fontWeight: 'normal', color: '#000' },
		];
		const to: typeof from = [];
		const pairs = matchTextTokens(from, to);
		expect(pairs).toHaveLength(1);
		expect(pairs[0].from).not.toBeNull();
		expect(pairs[0].to).toBeNull();
	});

	it('marks appearing tokens with null from', () => {
		const from: {
			text: string;
			x: number;
			y: number;
			fontSize: number;
			fontWeight: string;
			color: string;
		}[] = [];
		const to = [{ text: 'New', x: 0, y: 0.5, fontSize: 14, fontWeight: 'normal', color: '#000' }];
		const pairs = matchTextTokens(from, to);
		expect(pairs).toHaveLength(1);
		expect(pairs[0].from).toBeNull();
		expect(pairs[0].to).not.toBeNull();
	});

	it('handles partial overlap', () => {
		const from = [
			{ text: 'A', x: 0, y: 0.5, fontSize: 14, fontWeight: 'normal', color: '#000' },
			{ text: 'B', x: 0.5, y: 0.5, fontSize: 14, fontWeight: 'normal', color: '#000' },
			{ text: 'C', x: 1, y: 0.5, fontSize: 14, fontWeight: 'normal', color: '#000' },
		];
		const to = [
			{ text: 'B', x: 0.3, y: 0.5, fontSize: 14, fontWeight: 'normal', color: '#000' },
			{ text: 'D', x: 0.7, y: 0.5, fontSize: 14, fontWeight: 'normal', color: '#000' },
		];
		const pairs = matchTextTokens(from, to);
		const matched = pairs.filter((p) => p.from && p.to);
		const disappeared = pairs.filter((p) => p.from && !p.to);
		// B matches by text; D gets proximity-matched with A or C.
		// At least 1 token is matched by text, and at least 1 from-token disappears.
		expect(matched.length).toBeGreaterThanOrEqual(1);
		expect(disappeared.length).toBeGreaterThanOrEqual(1);
		// Total pairs = from count + appeared tokens
		expect(pairs.length).toBeGreaterThanOrEqual(from.length);
	});
});

// ==========================================================================
// buildColorInterpolationProps
// ==========================================================================

describe('buildColorInterpolationProps', () => {
	it('returns null when no fills present', () => {
		const a = makeElement({ id: 'a', type: 'text' });
		const b = makeElement({ id: 'b', type: 'text' });
		expect(buildColorInterpolationProps(a, b)).toBeNull();
	});

	it('returns null when fills are identical', () => {
		const a = makeElement({
			id: 'a',
			type: 'shape',
			shapeStyle: { fillColor: '#FF0000' },
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const b = makeElement({
			id: 'b',
			type: 'shape',
			shapeStyle: { fillColor: '#FF0000' },
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		expect(buildColorInterpolationProps(a, b)).toBeNull();
	});

	it('returns color strings when fills differ', () => {
		const a = makeElement({
			id: 'a',
			type: 'shape',
			shapeStyle: { fillColor: '#FF0000' },
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const b = makeElement({
			id: 'b',
			type: 'shape',
			shapeStyle: { fillColor: '#0000FF' },
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const result = buildColorInterpolationProps(a, b);
		expect(result).not.toBeNull();
		expect(result!.fromBg).toContain('rgba');
		expect(result!.toBg).toContain('rgba');
	});
});

// ==========================================================================
// buildStrokeInterpolationProps
// ==========================================================================

describe('buildStrokeInterpolationProps', () => {
	it('returns null when no strokes present', () => {
		const a = makeElement({ id: 'a', type: 'text' });
		const b = makeElement({ id: 'b', type: 'text' });
		expect(buildStrokeInterpolationProps(a, b)).toBeNull();
	});

	it('returns null when strokes are identical', () => {
		const a = makeElement({
			id: 'a',
			type: 'shape',
			shapeStyle: { strokeColor: '#000', strokeWidth: 2 },
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const b = makeElement({
			id: 'b',
			type: 'shape',
			shapeStyle: { strokeColor: '#000', strokeWidth: 2 },
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		expect(buildStrokeInterpolationProps(a, b)).toBeNull();
	});

	it('returns stroke data when strokes differ', () => {
		const a = makeElement({
			id: 'a',
			type: 'shape',
			shapeStyle: { strokeColor: '#FF0000', strokeWidth: 1 },
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const b = makeElement({
			id: 'b',
			type: 'shape',
			shapeStyle: { strokeColor: '#0000FF', strokeWidth: 3 },
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const result = buildStrokeInterpolationProps(a, b);
		expect(result).not.toBeNull();
		expect(result!.fromWidth).toBe(1);
		expect(result!.toWidth).toBe(3);
	});
});

// ==========================================================================
// generateMorphAnimations (enhanced)
// ==========================================================================

describe('generateMorphAnimations', () => {
	it('should generate animation for each pair', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({
					id: 'a',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
				}),
				toElement: makeElement({
					id: 'b',
					type: 'shape',
					x: 50,
					y: 50,
					width: 200,
					height: 100,
				}),
			},
		];
		const anims = generateMorphAnimations(pairs, 1000);
		expect(anims).toHaveLength(1);
		expect(anims[0].elementId).toBe('b');
	});

	it('should include translate transform from position delta', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({
					id: 'a',
					type: 'shape',
					x: 10,
					y: 20,
					width: 100,
					height: 50,
				}),
				toElement: makeElement({
					id: 'b',
					type: 'shape',
					x: 50,
					y: 70,
					width: 100,
					height: 50,
				}),
			},
		];
		const anims = generateMorphAnimations(pairs, 500);
		expect(anims[0].keyframes).toContain('translate(-40px, -50px)');
	});

	it('turns the SHORT way round instead of unwinding a near-full circle', () => {
		// The issue #131 wheel points its arrow at the selected wedge by rotating
		// a ring in 45deg steps. Going from Trust & Sovereignty (315deg) to
		// Secure Data Movement (0deg) is 45deg clockwise, but CSS interpolates
		// `rotate(315deg)` -> `rotate(0deg)` numerically and spun the arrow
		// 315deg anti-clockwise, all the way round the dial.
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({ id: 'a', type: 'image', rotation: 315 }),
				toElement: makeElement({ id: 'b', type: 'image', rotation: 0 }),
			},
		];
		const anims = generateMorphAnimations(pairs, 1000);
		// -45deg is the same orientation as the authored 315deg, but travelling
		// from it to 0deg is 45deg CLOCKWISE. The `to` frame keeps the authored
		// angle so the element lands exactly on its own static transform.
		expect(anims[0].keyframes).toContain('rotate(-45deg)');
		expect(anims[0].keyframes).toContain('rotate(0deg)');
		expect(anims[0].keyframes).not.toContain('rotate(315deg)');
	});

	it('animates a flip change through edge-on instead of snapping it', () => {
		// A small photo is mirror-flipped and upside down; its grown counterpart
		// on the next slide is upright. Stating one endpoint's flips on BOTH
		// frames either flew an upright copy (losing the authored mirror) or
		// snapped it at landing. Per-frame factors with a constant function
		// list let CSS interpolate scaleX -1 -> 1 through 0, which is the
		// edge-on card flip PowerPoint plays, while rotation runs its own arc
		// alongside.
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({
					id: 'a',
					type: 'picture',
					imagePath: 'ppt/media/photo.jpeg',
					rotation: 183.5,
					flipHorizontal: true,
				}),
				toElement: makeElement({
					id: 'b',
					type: 'picture',
					imagePath: 'ppt/media/photo.jpeg',
				}),
			},
		];
		const anims = generateMorphAnimations(pairs, 1000);
		const frames = anims[0].keyframes;
		expect(frames).toContain('scaleX(-1)');
		expect(frames).toContain('scaleX(1)');
		// The unflipped axis stays explicit on both frames too, so the transform
		// lists pair up and interpolate numerically rather than by matrix.
		expect(frames.match(/scaleY\(1\)/gu)?.length).toBe(2);
		expect(frames).toContain('rotate(-176.5deg)');
		expect(frames).toContain('rotate(0deg)');

		// The ghost mirrors the same journey in reverse.
		const ghosts = generateMorphGhostAnimations(pairs, 1000, 0);
		expect(ghosts[0].keyframes).toContain('scaleX(-1)');
		expect(ghosts[0].keyframes).toContain('scaleX(1)');
	});

	it('keeps a shared flip stated on every frame', () => {
		// Both endpoints mirrored horizontally: the factor must survive on both
		// frames or the flight loses the authored mirror and snaps at the end.
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({ id: 'a', type: 'shape', flipHorizontal: true }),
				toElement: makeElement({ id: 'b', type: 'shape', flipHorizontal: true }),
			},
		];
		const anims = generateMorphAnimations(pairs, 1000);
		expect(anims[0].keyframes.match(/scaleX\(-1\)/gu)?.length).toBe(2);
	});

	it('steps an inert counterpart of a stacking swap together with the mover', () => {
		// The outgoing slide stacks the photo UNDER a full-frame graphic and the
		// incoming slide stacks it ABOVE; the graphic itself is visually
		// unchanged (an inert pair). The z-index journey only works if BOTH
		// sides of the flip are stepped together: skipping the inert half
		// leaves it at its static (incoming) layer, where the DOM-order
		// tie-break already favours the mover, and the swap renders
		// immediately instead of at the animation midpoint.
		const inertFrom = makeElement({
			id: 'inert-a',
			type: 'picture',
			imagePath: 'ppt/media/g.png',
			x: 345,
			y: 65,
			width: 590,
			height: 590,
		});
		const inertTo = makeElement({
			id: 'inert-b',
			type: 'picture',
			imagePath: 'ppt/media/g.png',
			x: 345,
			y: 65,
			width: 590,
			height: 590,
		});
		const moverFrom = makeElement({
			id: 'a',
			type: 'picture',
			imagePath: 'ppt/media/p.jpeg',
			x: 601,
			y: 282,
			width: 79,
			height: 76,
		});
		const moverTo = makeElement({
			id: 'b',
			type: 'picture',
			imagePath: 'ppt/media/p.jpeg',
			x: 307,
			y: 37,
			width: 667,
			height: 645,
		});
		const pairs: MorphPair[] = [
			{ fromElement: inertFrom, toElement: inertTo },
			{ fromElement: moverFrom, toElement: moverTo },
		];
		// Outgoing doc order: mover first (under the graphic); incoming: mover
		// last (above it).
		const zSwaps = computeZOrderSwaps(pairs, [moverFrom, inertFrom], [inertTo, moverTo]);
		expect(zSwaps.get('b')).toStrictEqual({ from: 0, to: 1 });
		expect(zSwaps.get('inert-b')).toStrictEqual({ from: 1, to: 0 });

		const anims = generateMorphAnimations(pairs, 1000, 'object', new Set(), zSwaps);
		const inertAnim = anims.find((a) => a.elementId === 'inert-b');
		expect(inertAnim).toBeDefined();
		expect(inertAnim!.keyframes).toContain('z-index: 1');
		expect(inertAnim!.keyframes).toContain('z-index: 0');
		expect(inertAnim!.keyframes).not.toContain('transform');
		const moverAnim = anims.find((a) => a.elementId === 'b');
		expect(moverAnim!.keyframes).toContain('z-index: 0');
		expect(moverAnim!.keyframes).toContain('z-index: 1');
	});

	it('keeps a short forward turn untouched', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({ id: 'a', type: 'image', rotation: 0 }),
				toElement: makeElement({ id: 'b', type: 'image', rotation: 45 }),
			},
		];
		const anims = generateMorphAnimations(pairs, 1000);
		expect(anims[0].keyframes).toContain('rotate(0deg)');
		expect(anims[0].keyframes).toContain('rotate(45deg)');
	});

	it('lands the ghost on the same short arc as its incoming half', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({ id: 'a', type: 'image', rotation: 315 }),
				toElement: makeElement({ id: 'b', type: 'image', rotation: 0 }),
			},
		];
		const ghosts = generateMorphGhostAnimations(pairs, 1000, 0);
		// Ghost starts on its authored 315 and travels forward to 360 (= 0).
		expect(ghosts[0].keyframes).toContain('rotate(315deg)');
		expect(ghosts[0].keyframes).toContain('rotate(360deg)');
	});

	it('resolves the shortest arc for any pair of angles', () => {
		expect(shortestRotationTarget(315, 0)).toBe(360);
		expect(shortestRotationTarget(0, 315)).toBe(-45);
		expect(shortestRotationTarget(0, 45)).toBe(45);
		expect(shortestRotationTarget(350, 10)).toBe(370);
		expect(shortestRotationTarget(10, 350)).toBe(-10);
	});

	it('turns a half turn the way PowerPoint does, which is not a fixed sign', () => {
		// A half turn has no shorter arc. PowerPoint 16 goes CLOCKWISE from a
		// start angle in [90, 270) and anti-clockwise otherwise, measured off
		// the rendered frames of both the issue #131 wheel and a synthetic
		// two-slide deck; the two agree on every case below. Always taking +180
		// sent the wheel's arrow round the wrong side for the wedge diametrically
		// opposite the one on screen.
		expect(shortestRotationTarget(0, 180)).toBe(-180);
		expect(shortestRotationTarget(45, 225)).toBe(-135);
		expect(shortestRotationTarget(90, 270)).toBe(270);
		expect(shortestRotationTarget(135, 315)).toBe(315);
		expect(shortestRotationTarget(180, 0)).toBe(360);
		expect(shortestRotationTarget(270, 90)).toBe(90);
		// Still a half turn once the raw angles are reduced mod 360.
		expect(shortestRotationTarget(360, 180)).toBe(180);
	});

	it('should include scale transform from size delta', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({
					id: 'a',
					type: 'shape',
					x: 0,
					y: 0,
					width: 200,
					height: 100,
				}),
				toElement: makeElement({
					id: 'b',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
				}),
			},
		];
		const anims = generateMorphAnimations(pairs, 500);
		expect(anims[0].keyframes).toContain('scale(2, 2)');
	});

	it('should include rotation transform from rotation delta', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({
					id: 'a',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					rotation: 45,
				}),
				toElement: makeElement({
					id: 'b',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					rotation: 0,
				}),
			},
		];
		const anims = generateMorphAnimations(pairs, 500);
		expect(anims[0].keyframes).toContain('rotate(45deg)');
	});

	it('should include duration in animation string', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({
					id: 'a',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
				}),
				toElement: makeElement({
					id: 'b',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
				}),
			},
		];
		const anims = generateMorphAnimations(pairs, 750);
		expect(anims[0].animation).toContain('750ms');
	});

	it('should use morph-specific cubic-bezier easing', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({
					id: 'a',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
				}),
				toElement: makeElement({
					id: 'b',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
				}),
			},
		];
		const anims = generateMorphAnimations(pairs, 500);
		expect(anims[0].animation).toContain(MORPH_EASING);
	});

	it('should return empty array for empty pairs', () => {
		expect(generateMorphAnimations([], 500)).toStrictEqual([]);
	});

	it('should generate unique keyframe names for each pair', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({
					id: 'a',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
				}),
				toElement: makeElement({
					id: 'b',
					type: 'shape',
					x: 50,
					y: 50,
					width: 100,
					height: 50,
				}),
			},
			{
				fromElement: makeElement({
					id: 'c',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
				}),
				toElement: makeElement({
					id: 'd',
					type: 'shape',
					x: 50,
					y: 50,
					width: 100,
					height: 50,
				}),
			},
		];
		const anims = generateMorphAnimations(pairs, 500);
		const name0 = anims[0].animation.split(' ')[0];
		const name1 = anims[1].animation.split(' ')[0];
		expect(name0).not.toBe(name1);
	});

	it('should handle opacity in keyframes', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({
					id: 'a',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					opacity: 0.5,
				}),
				toElement: makeElement({
					id: 'b',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					opacity: 1,
				}),
			},
		];
		const anims = generateMorphAnimations(pairs, 500);
		expect(anims[0].keyframes).toContain('opacity: 0.5');
		expect(anims[0].keyframes).toContain('opacity: 1');
	});

	it('never fades a restyled pair IN: the ghost above it does the dissolve', () => {
		// Fading both halves left the middle of the transition part-transparent,
		// so the slide background showed through a solid object and both states
		// were legible at once (issue #131: the wheel's centre disc went
		// see-through). PowerPoint keeps the object solid and dissolves the old
		// appearance on top of it, which is what the ghost animation does.
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({
					id: 'a',
					type: 'shape',
					shapeStyle: { fillColor: '#ff0000' },
				} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
				toElement: makeElement({
					id: 'b',
					type: 'shape',
					shapeStyle: { fillColor: '#00ff00' },
				} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
			},
		];
		expect(morphPairNeedsCrossfade(pairs[0].fromElement, pairs[0].toElement)).toBeTruthy();
		const anims = generateMorphAnimations(pairs, 500);
		expect(anims[0].keyframes).not.toContain('opacity: 0;');
		// ...while the ghost still fades right out over the top of it.
		const ghosts = generateMorphGhostAnimations(pairs, 500, 0);
		expect(ghosts[0].keyframes).toContain('opacity: 0;');
	});

	it('should include background-color for fill color changes', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({
					id: 'a',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					shapeStyle: { fillColor: '#FF0000' },
				} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
				toElement: makeElement({
					id: 'b',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					shapeStyle: { fillColor: '#0000FF' },
				} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
			},
		];
		const anims = generateMorphAnimations(pairs, 500);
		expect(anims[0].keyframes).toContain('background-color:');
	});

	it('should include outline for stroke changes', () => {
		const pairs: MorphPair[] = [
			{
				fromElement: makeElement({
					id: 'a',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					shapeStyle: { strokeColor: '#FF0000', strokeWidth: 1 },
				} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
				toElement: makeElement({
					id: 'b',
					type: 'shape',
					x: 0,
					y: 0,
					width: 100,
					height: 50,
					shapeStyle: { strokeColor: '#0000FF', strokeWidth: 3 },
				} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
			},
		];
		const anims = generateMorphAnimations(pairs, 500);
		expect(anims[0].keyframes).toContain('outline:');
	});
});

// ==========================================================================
// Unmatched element animations
// ==========================================================================

describe('generateUnmatchedFadeOutAnimations', () => {
	it('generates fade-out animations for each element', () => {
		const elements = [
			makeElement({ id: 'a', type: 'shape' }),
			makeElement({ id: 'b', type: 'text' }),
		];
		const anims = generateUnmatchedFadeOutAnimations(elements, 500, 0);
		expect(anims).toHaveLength(2);
		expect(anims[0].keyframes).toContain('opacity: 0');
		// Percentage stops carry the shape of the ramp, so the animation itself
		// runs linear rather than on the whole-morph easing.
		expect(anims[0].animation).toContain('500ms linear forwards');
	});

	it('dissolves out inside the first quarter and holds at zero (measured)', () => {
		// PowerPoint clears an unmatched shape well before its replacement
		// appears: alpha 0.98 at 3ms, 0.62 at 112ms, 0.13 at 210ms and gone by
		// 238ms of a 1s morph. Fading across the whole duration instead left the
		// midpoint a double exposure of both slides.
		const anims = generateUnmatchedFadeOutAnimations([makeElement({ id: 'a' })], 1000, 0);
		expect(anims[0].keyframes).toContain(`${MORPH_FADE_OUT_HOLD_PERCENT}% {`);
		expect(anims[0].keyframes).toContain(`${MORPH_FADE_OUT_END_PERCENT}% {`);
		expect(MORPH_FADE_OUT_END_PERCENT).toBeLessThan(MORPH_FADE_IN_START_PERCENT);
		// Zero from the end of the ramp all the way to 100%.
		const after = anims[0].keyframes.slice(
			anims[0].keyframes.indexOf(`${MORPH_FADE_OUT_END_PERCENT}% {`),
		);
		expect(after).toContain('opacity: 0');
		expect(after).not.toContain('opacity: 1');
	});

	it('never scales an unmatched element, in or out', () => {
		// The measured box neither moves nor changes size: 427.1 x 241.4 slide
		// px on every sampled frame of both a fade-out and a fade-in.
		const el = makeElement({ id: 'a' });
		expect(generateUnmatchedFadeOutAnimations([el], 500, 0)[0].keyframes).not.toContain('0.95');
		expect(generateUnmatchedFadeInAnimations([el], 500, 0)[0].keyframes).not.toContain('0.95');
	});

	it('preserves element opacity in from state', () => {
		const elements = [makeElement({ id: 'a', type: 'shape', opacity: 0.8 })];
		const anims = generateUnmatchedFadeOutAnimations(elements, 500, 0);
		expect(anims[0].keyframes).toContain('opacity: 0.8');
	});

	it('returns empty array for empty input', () => {
		expect(generateUnmatchedFadeOutAnimations([], 500, 0)).toStrictEqual([]);
	});
});

describe('generateUnmatchedFadeInAnimations', () => {
	it('generates fade-in animations for each element', () => {
		const elements = [makeElement({ id: 'a', type: 'shape' })];
		const anims = generateUnmatchedFadeInAnimations(elements, 500, 0);
		expect(anims).toHaveLength(1);
		expect(anims[0].keyframes).toContain('opacity: 0');
		expect(anims[0].keyframes).toContain('opacity: 1');
	});

	it('uses target element opacity in to state', () => {
		const elements = [makeElement({ id: 'a', type: 'shape', opacity: 0.6 })];
		const anims = generateUnmatchedFadeInAnimations(elements, 500, 0);
		expect(anims[0].keyframes).toContain('opacity: 0.6');
	});

	it('stays invisible until the morph is nearly half done (measured)', () => {
		// Nothing of the incoming shape is on screen before 401ms of a 1s morph;
		// alpha is 0.18 at 464ms, 0.72 at 652ms and 0.99 at 935ms. Holding at
		// zero for the first 42% is what leaves a clean gap between an
		// unmatched shape leaving and its replacement arriving.
		const anims = generateUnmatchedFadeInAnimations([makeElement({ id: 'a' })], 1000, 0);
		const css = anims[0].keyframes;
		expect(css).toContain(`${MORPH_FADE_IN_START_PERCENT}% {`);
		// Zero at 0% AND at the start of the ramp; the ramp itself decelerates.
		const upToRamp = css.slice(0, css.indexOf(`${MORPH_FADE_IN_START_PERCENT}% {`));
		expect(upToRamp).toContain('opacity: 0');
		expect(upToRamp).not.toContain('opacity: 1');
		expect(css).toContain(`animation-timing-function: ${MORPH_FADE_IN_EASING}`);
		expect(anims[0].animation).toContain('1000ms linear forwards');
	});
});

// ==========================================================================
// Text morph animation generation
// ==========================================================================

describe('generateTextMorphAnimations', () => {
	it('generates per-token animations for word mode', () => {
		const pair: MorphPair = {
			fromElement: makeElement({
				id: 'a',
				type: 'text',
				text: 'Hello World',
				textStyle: { fontSize: 14 },
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
			toElement: makeElement({
				id: 'b',
				type: 'text',
				text: 'Hello World',
				textStyle: { fontSize: 24 },
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
		};
		const anims = generateTextMorphAnimations(pair, 500, 'word', 0);
		expect(anims.length).toBeGreaterThanOrEqual(2);
	});

	it('generates per-character animations for character mode', () => {
		const pair: MorphPair = {
			fromElement: makeElement({
				id: 'a',
				type: 'text',
				text: 'AB',
				textStyle: { fontSize: 14 },
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
			toElement: makeElement({
				id: 'b',
				type: 'text',
				text: 'AB',
				textStyle: { fontSize: 24 },
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
		};
		const anims = generateTextMorphAnimations(pair, 500, 'character', 0);
		expect(anims).toHaveLength(2);
	});

	it('returns empty for non-text elements', () => {
		const pair: MorphPair = {
			fromElement: makeElement({ id: 'a', type: 'image' }),
			toElement: makeElement({ id: 'b', type: 'image' }),
		};
		const anims = generateTextMorphAnimations(pair, 500, 'word', 0);
		expect(anims).toHaveLength(0);
	});

	it('handles appearing text with fade-in animations', () => {
		const pair: MorphPair = {
			fromElement: makeElement({
				id: 'a',
				type: 'text',
				text: 'A',
				textStyle: { fontSize: 14 },
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
			toElement: makeElement({
				id: 'b',
				type: 'text',
				text: 'A B',
				textStyle: { fontSize: 14 },
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
		};
		const anims = generateTextMorphAnimations(pair, 500, 'word', 0);
		// "A" matches, "B" is new so should have fade-in
		const fadeInAnims = anims.filter(
			(a) => a.keyframes.includes('opacity: 0') && a.keyframes.includes('opacity: 1'),
		);
		expect(fadeInAnims.length).toBeGreaterThanOrEqual(1);
	});

	it('handles disappearing text with fade-out animations', () => {
		const pair: MorphPair = {
			fromElement: makeElement({
				id: 'a',
				type: 'text',
				text: 'A B',
				textStyle: { fontSize: 14 },
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
			toElement: makeElement({
				id: 'b',
				type: 'text',
				text: 'A',
				textStyle: { fontSize: 14 },
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
		};
		const anims = generateTextMorphAnimations(pair, 500, 'word', 0);
		const fadeOutAnims = anims.filter(
			(a) =>
				a.keyframes.includes('from { opacity: 1; }') && a.keyframes.includes('to { opacity: 0; }'),
		);
		expect(fadeOutAnims.length).toBeGreaterThanOrEqual(1);
	});
});

// ==========================================================================
// generateFullMorphTransition
// ==========================================================================

describe('generateFullMorphTransition', () => {
	it('generates complete animation set for object mode', () => {
		const from = makeSlide([
			makeElement({ id: 'a', type: 'shape', x: 0, y: 0 }),
			makeElement({ id: 'only-from', type: 'text', x: 200, y: 200 }),
		]);
		const to = makeSlide([
			makeElement({ id: 'a', type: 'shape', x: 100, y: 100 }),
			makeElement({ id: 'only-to', type: 'image', x: 300, y: 300 }),
		]);
		const anims = generateFullMorphTransition(from, to, 800, 'object');
		// Should have: 1 pair animation + 1 fade-out + 1 fade-in. The pair only
		// MOVED, so its ghost would draw exactly what the incoming half already
		// draws along the same path, and gets dropped (issue #144).
		expect(anims).toHaveLength(3);
		expect(anims.filter((a) => a.keyframes.includes('ghost'))).toHaveLength(0);
	});

	it('ghosts a pair whose appearance changed, so the old look can dissolve', () => {
		const from = makeSlide([
			makeElement({ id: 'a', type: 'shape', x: 0, y: 0, shapeStyle: { fillColor: '#FF0000' } }),
		]);
		const to = makeSlide([
			makeElement({ id: 'a', type: 'shape', x: 100, y: 100, shapeStyle: { fillColor: '#00FF00' } }),
		]);
		const anims = generateFullMorphTransition(from, to, 800, 'object');
		expect(anims.filter((a) => a.keyframes.includes('ghost'))).toHaveLength(1);
	});

	it('includes text morph animations in word mode', () => {
		const from = makeSlide([
			makeElement({
				id: 't1',
				type: 'text',
				text: 'Hello World',
				textStyle: { fontSize: 14 },
				x: 0,
				y: 0,
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
		]);
		const to = makeSlide([
			makeElement({
				id: 't1',
				type: 'text',
				text: 'Hello World',
				textStyle: { fontSize: 24 },
				x: 50,
				y: 50,
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
		]);
		const anims = generateFullMorphTransition(from, to, 800, 'word');
		// Should have: 1 pair animation + 2 text token animations (Hello, World)
		expect(anims.length).toBeGreaterThanOrEqual(3);
	});

	it('includes text morph animations in character mode', () => {
		const from = makeSlide([
			makeElement({
				id: 't1',
				type: 'text',
				text: 'AB',
				textStyle: { fontSize: 14 },
				x: 0,
				y: 0,
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
		]);
		const to = makeSlide([
			makeElement({
				id: 't1',
				type: 'text',
				text: 'AB',
				textStyle: { fontSize: 24 },
				x: 50,
				y: 50,
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] }),
		]);
		const anims = generateFullMorphTransition(from, to, 800, 'character');
		// Should have: 1 pair animation + 2 character animations
		expect(anims.length).toBeGreaterThanOrEqual(3);
	});

	it('returns only fade animations when no elements match', () => {
		const from = makeSlide([makeElement({ id: 'a', type: 'shape', x: 0, y: 0 })]);
		const to = makeSlide([makeElement({ id: 'b', type: 'image', x: 500, y: 500 })]);
		const anims = generateFullMorphTransition(from, to, 500);
		// 0 pair animations + 1 fade-out + 1 fade-in
		expect(anims).toHaveLength(2);
		const fadeOutAnims = anims.filter((a) => a.keyframes.includes('fadeout'));
		const fadeInAnims = anims.filter((a) => a.keyframes.includes('fadein'));
		expect(fadeOutAnims).toHaveLength(1);
		expect(fadeInAnims).toHaveLength(1);
	});

	it('returns empty for empty slides', () => {
		const from = makeSlide([]);
		const to = makeSlide([]);
		const anims = generateFullMorphTransition(from, to, 500);
		expect(anims).toHaveLength(0);
	});

	it('defaults to object mode', () => {
		const from = makeSlide([makeElement({ id: 'a', type: 'shape', x: 0, y: 0 })]);
		const to = makeSlide([makeElement({ id: 'a', type: 'shape', x: 100, y: 100 })]);
		const anims = generateFullMorphTransition(from, to, 500);
		// Object mode: the pair's incoming animation and nothing else - no ghost
		// (the pair only moved) and no text animations.
		expect(anims).toHaveLength(1);
		expect(anims.filter((a) => a.keyframes.includes('ghost'))).toHaveLength(0);
	});
});

// ==========================================================================
// morphPairNeedsCrossfade
// ==========================================================================

describe('morphPairNeedsCrossfade', () => {
	it('is false for a pair that only moves', () => {
		const from = makeElement({ id: 'a', type: 'shape', x: 0, y: 0 });
		const to = makeElement({ id: 'b', type: 'shape', x: 300, y: 200 });
		expect(morphPairNeedsCrossfade(from, to)).toBeFalsy();
	});

	it('is true when the painted appearance changes', () => {
		const from = makeElement({
			id: 'a',
			type: 'text',
			text: 'Open Integration',
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const to = makeElement({
			id: 'b',
			type: 'text',
			text: 'Tactical Edge',
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		expect(morphPairNeedsCrossfade(from, to)).toBeTruthy();
	});

	it('is true when only an adjustment handle moved', () => {
		// `shouldGeometryMorph` already treats a moved handle as an outline change
		// and emits a `clip-path` tween for it. If the appearance compared EQUAL
		// the pair also read as inert, and an inert pair's ghost is painted
		// statically (issue #161) while the live half is held invisible beneath
		// it: the tween ran where nobody could see it and the new outline appeared
		// in one frame when the overlay came down.
		const rounded = (id: string, adj: number): PptxElement =>
			makeElement({
				id,
				type: 'shape',
				shapeType: 'roundRect',
				shapeAdjustments: { adj },
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });

		expect(morphPairNeedsCrossfade(rounded('a', 16667), rounded('b', 40000))).toBeTruthy();
		expect(isInertMorphPair(rounded('a', 16667), rounded('b', 40000))).toBeFalsy();
		expect(isInertMorphPair(rounded('a', 16667), rounded('b', 16667))).toBeTruthy();
	});

	it('ignores the order two decks wrote the same handles in', () => {
		const handles = (id: string, adjustments: Record<string, number>): PptxElement =>
			makeElement({
				id,
				type: 'shape',
				shapeType: 'roundRect',
				shapeAdjustments: adjustments,
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });

		expect(
			morphPairNeedsCrossfade(
				handles('a', { adj1: 1, adj2: 2 }),
				handles('b', { adj2: 2, adj1: 1 }),
			),
		).toBeFalsy();
	});

	it('looks inside a group, whose own properties paint nothing (issue #131)', () => {
		// The reporter's deck keeps each slide's centre copy in a group. Comparing
		// only the group itself made every pair look unchanged, so its ghost stayed
		// opaque for the whole morph and the old text snapped to the new one in a
		// single frame when the overlay was torn down.
		const group = (id: string, childText: string): PptxElement =>
			({
				id,
				type: 'group',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				children: [
					{ id: `${id}-c`, type: 'text', x: 0, y: 0, width: 80, height: 20, text: childText },
				],
			}) as unknown as PptxElement;

		expect(
			morphPairNeedsCrossfade(group('a', 'Open Integration'), group('b', 'Tactical Edge')),
		).toBeTruthy();
		expect(
			morphPairNeedsCrossfade(group('a', 'Open Integration'), group('b', 'Open Integration')),
		).toBeFalsy();
	});
});

// ==========================================================================
// MORPH_EASING constant
// ==========================================================================

describe('mORPH_EASING', () => {
	it('is a cubic-bezier string', () => {
		expect(MORPH_EASING).toMatch(/^cubic-bezier\(/u);
	});
});

// ---------------------------------------------------------------------------
// issue #131 follow-up: what a morph does with pairs it should leave alone
// ---------------------------------------------------------------------------

describe('morph inert pairs (issue #131 follow-up)', () => {
	const still = (id: string, extra: Partial<PptxElement> = {}) =>
		makeElement({
			id,
			type: 'shape',
			x: 10,
			y: 20,
			width: 100,
			height: 50,
			shapeStyle: { fillMode: 'solid', fillColor: '#3D4146', fillOpacity: 0.5 },
			...extra,
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });

	it('recognises an unchanged, unmoved pair as inert', () => {
		expect(isInertMorphPair(still('a'), still('b'))).toBeTruthy();
	});

	it('does not call a moved or restyled pair inert', () => {
		expect(isInertMorphPair(still('a'), still('b', { x: 40 }))).toBeFalsy();
		expect(
			isInertMorphPair(
				still('a'),
				still('b', {
					shapeStyle: { fillMode: 'solid', fillColor: '#000000' },
				} as Partial<PptxElement>),
			),
		).toBeFalsy();
		expect(isInertMorphPair(still('a'), still('b', { rotation: 90 }))).toBeFalsy();
	});

	it('holds an inert pair’s incoming half hidden so its ghost is the only copy', () => {
		// The ghost is pixel-identical and sits directly above it. Painting both
		// composites a part-transparent element with itself, so it reads more
		// solid for the whole transition and snaps back at teardown - the
		// reporter's "opacity animating on elements that should be unchanged".
		const anims = generateMorphAnimations(
			[{ fromElement: still('a'), toElement: still('b') }],
			500,
		);
		const frames = anims[0].keyframes;
		expect(frames).toContain('opacity: 0;');
		expect(frames).not.toContain('opacity: 1;');
	});

	it('gives the inert ghost no animation at all (issue #161)', () => {
		// Its keyframes would run from itself to itself: nothing changes over
		// time, but a running animation puts the shape on its own compositing
		// layer, and the browser snaps that layer's raster to whole device
		// pixels. A ghost at a fractional position/size is then painted up to a
		// pixel smaller and offset for the whole morph and snaps back when the
		// overlay is torn down - the reporter's "micro-movements".
		//
		// The ghost is still PAINTED (see morph-plan: `outgoingElements` comes
		// from the ghost set, not from this map); it is simply static.
		const ghosts = generateMorphGhostAnimations(
			[{ fromElement: still('a'), toElement: still('b') }],
			500,
			0,
		);
		expect(ghosts).toHaveLength(0);
	});

	it('still animates a ghost whose pair is NOT inert', () => {
		const ghosts = generateMorphGhostAnimations(
			[{ fromElement: still('a'), toElement: still('b', { x: 240 }) }],
			500,
			0,
		);
		expect(ghosts).toHaveLength(1);
		// It stands in for the live element, so it stays fully visible: only a
		// restyled pair's ghost dissolves.
		expect(ghosts[0].keyframes).not.toContain('opacity: 0;');
	});
});

describe('morph crossfade fade-in (issue #131 follow-up)', () => {
	const textBox = (id: string, text: string) =>
		makeElement({
			id,
			type: 'text',
			x: 10,
			y: 20,
			width: 100,
			height: 50,
			text,
			shapeStyle: { fillMode: 'none' },
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });

	it('fades a body-less text pair IN so the new wording dissolves', () => {
		// Pinned at full opacity the new words are at full strength on frame 1
		// with the old dissolving off them, which reads as the next slide's text
		// simply appearing.
		const anims = generateMorphAnimations(
			[
				{
					fromElement: textBox('a', 'Multi-Domain Fusion'),
					toElement: textBox('b', 'Cyber and EM'),
				},
			],
			500,
		);
		expect(anims[0].keyframes).toContain('opacity: 0;');
		expect(anims[0].keyframes).toContain('opacity: 1;');
	});

	it('still refuses to fade in anything that paints a body', () => {
		// Regression guard for the wheel's centre disc: fading both halves left
		// the middle of the transition see-through.
		const disc = (id: string, colour: string) =>
			makeElement({
				id,
				type: 'shape',
				x: 10,
				y: 20,
				width: 100,
				height: 50,
				shapeStyle: { fillMode: 'solid', fillColor: colour },
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const anims = generateMorphAnimations(
			[{ fromElement: disc('a', '#ff0000'), toElement: disc('b', '#00ff00') }],
			500,
		);
		expect(anims[0].keyframes).not.toContain('opacity: 0;');
	});

	it('refuses for a picture too', () => {
		const pic = (id: string, path: string) =>
			makeElement({
				id,
				type: 'picture',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
				imagePath: path,
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const anims = generateMorphAnimations(
			[{ fromElement: pic('a', 'a.png'), toElement: pic('b', 'b.png') }],
			500,
		);
		expect(anims[0].keyframes).not.toContain('opacity: 0;');
	});
});

describe('replaced wording in the same slot (issue #160)', () => {
	/** A centre-panel paragraph, re-fitted around its own wording. */
	const paragraph = (id: string, text: string, box: Partial<PptxElement>) =>
		makeElement({
			id,
			type: 'text',
			x: 536,
			y: 361,
			width: 215,
			height: 44,
			text,
			shapeStyle: { fillMode: 'none' },
			...box,
		} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });

	const refitted: MorphPair = {
		fromElement: paragraph('a', 'Challenge: Integration of cyber', {}),
		toElement: paragraph('b', 'Challenge: Decision advantage', { y: 360, height: 32 }),
	};

	it('dissolves both halves where they stand, without stretching the type', () => {
		// PowerPoint re-lays the wording out inside whatever box now fits it; it
		// never scales the glyphs. Interpolating the box squeezed this paragraph
		// by the 27% its own height changed.
		const [incoming] = generateMorphAnimations([refitted], 1000);
		const [ghost] = generateMorphGhostAnimations([refitted], 1000, 0);
		for (const keyframes of [incoming.keyframes, ghost.keyframes]) {
			expect(keyframes).toContain('scale(1, 1)');
			expect(keyframes).not.toMatch(/translate\((?!0)/u);
		}
	});

	it('gives the two halves complementary opacity on the same curve', () => {
		// The whole point of the pair: PowerPoint's own render of this transition
		// is a blend of the two end states whose weights sum to 1.000 throughout.
		const [incoming] = generateMorphAnimations([refitted], 1000);
		const [ghost] = generateMorphGhostAnimations([refitted], 1000, 0);
		expect(incoming.animation).toContain(MORPH_CROSSFADE_EASING);
		expect(ghost.animation).toContain(MORPH_CROSSFADE_EASING);
		expect(incoming.keyframes).toMatch(/-fade \{\s*from \{\s*opacity: 0;/u);
		expect(ghost.keyframes).toMatch(/-fade \{\s*from \{\s*opacity: 1;/u);
	});

	it('still interpolates a text box that genuinely moved', () => {
		// Measured: a text box whose wording changed AND which moved 460px travels
		// the whole way while its glyphs cross-dissolve.
		const moved: MorphPair = {
			fromElement: paragraph('a', 'AAAA BBBB', { x: 100, y: 80 }),
			toElement: paragraph('b', 'CCCC DDDD', { x: 560, y: 400 }),
		};
		const [incoming] = generateMorphAnimations([moved], 1000);
		expect(incoming.keyframes).toContain('translate(-460px, -320px)');
	});

	it('dissolves a paragraph that re-fitted far enough to clear half its box (issue #161)', () => {
		// The wheel deck's "Challenge" line, in px: its box shifts 17.75px up a
		// 55px-tall box and narrows, which drops the box overlap to 0.487. At the
		// old 0.5 slot threshold it fell through to interpolation and stretched its
		// glyphs by the 1.56% its width changed - the reporter's "text moving".
		const challenge: MorphPair = {
			fromElement: paragraph('a', 'Challenge: Pan-DLOD solutions, avoiding vendor lock-in', {
				x: 494.24,
				y: 365.6,
				width: 290.2,
				height: 55.11,
			}),
			toElement: paragraph('b', 'Challenge: Resilient, deployable compute and analytics', {
				x: 503.67,
				y: 347.85,
				width: 271.32,
				height: 55.11,
			}),
		};
		const [incoming] = generateMorphAnimations([challenge], 1000);
		const [ghost] = generateMorphGhostAnimations([challenge], 1000, 0);
		for (const keyframes of [incoming.keyframes, ghost.keyframes]) {
			expect(keyframes).toContain('scale(1, 1)');
			expect(keyframes).not.toMatch(/translate\((?!0)/u);
		}
	});

	it('leaves a shape with a body alone', () => {
		// Only a bare text box is a container PowerPoint re-fits; a rounded
		// rectangle that resizes really does change size on screen.
		const chip = (id: string, text: string, width: number) =>
			makeElement({
				id,
				type: 'shape',
				x: 0,
				y: 0,
				width,
				height: 40,
				text,
				shapeStyle: { fillMode: 'solid', fillColor: '#ff0000' },
			} as Partial<PptxElement> & { id: string; type: PptxElement['type'] });
		const [incoming] = generateMorphAnimations(
			[{ fromElement: chip('a', 'Before', 100), toElement: chip('b', 'After', 200) }],
			1000,
		);
		expect(incoming.keyframes).toContain('scale(0.5, 1)');
	});
});
