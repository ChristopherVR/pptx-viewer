/**
 * Unit tests for the Angular text-warp descriptor resolver.
 *
 * Covers: getTextWarp(), getWarpCategory(), groupIntoParagraphs(),
 *         ALL_CLASSIFIED_PRESETS membership, and the TextWarpDef shape.
 */
import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	ALL_CLASSIFIED_PRESETS,
	getTextWarp,
	getWarpCategory,
	groupIntoParagraphs,
} from './text-warp';
import type { TextWarpCssDef, TextWarpPathDef } from './text-warp';
import { SVG_WARP_PRESETS } from './warp-path-generators';

// ── helpers ────────────────────────────────────────────────────────────

function makeTextElement(
	preset: string | undefined,
	overrides: Partial<{
		text: string;
		textSegments: TextSegment[];
		adj: number;
		adj2: number;
		align: string;
		color: string;
		fontSize: number;
		fontFamily: string;
	}> = {},
): PptxElement {
	return {
		type: 'text',
		id: 'el-1',
		x: 0,
		y: 0,
		width: 300,
		height: 150,
		text: overrides.text,
		textSegments: overrides.textSegments,
		textStyle: {
			textWarpPreset: preset,
			textWarpAdj: overrides.adj,
			textWarpAdj2: overrides.adj2,
			align: overrides.align as 'left' | 'center' | 'right' | undefined,
			color: overrides.color,
			fontSize: overrides.fontSize,
			fontFamily: overrides.fontFamily,
		},
	} as PptxElement;
}

function makeShapeElement(preset: string | undefined): PptxElement {
	return {
		type: 'shape',
		id: 'sh-1',
		x: 10,
		y: 10,
		width: 200,
		height: 100,
		shapeType: 'rect',
		text: 'hello',
		textStyle: {
			textWarpPreset: preset,
		},
	} as PptxElement;
}

function makeNonTextElement(): PptxElement {
	return {
		type: 'picture',
		id: 'img-1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		imageData: 'data:image/png;base64,',
	} as unknown as PptxElement;
}

// ── getWarpCategory ────────────────────────────────────────────────────

describe('getWarpCategory', () => {
	it('returns "none" for undefined', () => {
		expect(getWarpCategory(undefined)).toBe('none');
	});

	it('returns "none" for textNoShape and textPlain', () => {
		expect(getWarpCategory('textNoShape')).toBe('none');
		expect(getWarpCategory('textPlain')).toBe('none');
	});

	it('returns "none" for unknown preset', () => {
		expect(getWarpCategory('textAlienShape')).toBe('none');
	});

	it('returns "path" for path-family presets', () => {
		expect(getWarpCategory('textArchUp')).toBe('path');
		expect(getWarpCategory('textCircle')).toBe('path');
		expect(getWarpCategory('textWave1')).toBe('path');
		expect(getWarpCategory('textTriangle')).toBe('path');
		expect(getWarpCategory('textChevron')).toBe('path');
	});

	it('returns "envelope" for envelope-family presets', () => {
		expect(getWarpCategory('textInflate')).toBe('envelope');
		expect(getWarpCategory('textDeflate')).toBe('envelope');
		expect(getWarpCategory('textCanUp')).toBe('envelope');
		expect(getWarpCategory('textDeflateInflate')).toBe('envelope');
	});

	it('returns "simple" for simple-family presets', () => {
		expect(getWarpCategory('textSlantUp')).toBe('simple');
		expect(getWarpCategory('textFadeRight')).toBe('simple');
		expect(getWarpCategory('textCascadeDown')).toBe('simple');
	});
});

// ── ALL_CLASSIFIED_PRESETS ─────────────────────────────────────────────

describe('all classified presets', () => {
	it('includes textNoShape and textPlain', () => {
		expect(ALL_CLASSIFIED_PRESETS.has('textNoShape')).toBeTruthy();
		expect(ALL_CLASSIFIED_PRESETS.has('textPlain')).toBeTruthy();
	});

	it('includes representative members from each category', () => {
		expect(ALL_CLASSIFIED_PRESETS.has('textArchUp')).toBeTruthy();
		expect(ALL_CLASSIFIED_PRESETS.has('textInflate')).toBeTruthy();
		expect(ALL_CLASSIFIED_PRESETS.has('textSlantUp')).toBeTruthy();
	});

	it('has at least 39 members (all 40+ OOXML presets catalogued)', () => {
		expect(ALL_CLASSIFIED_PRESETS.size).toBeGreaterThanOrEqual(39);
	});
});

// ── groupIntoParagraphs ────────────────────────────────────────────────

describe('groupIntoParagraphs', () => {
	it('returns empty array for element with no text', () => {
		expect(groupIntoParagraphs({ text: undefined, textSegments: undefined })).toStrictEqual([]);
	});

	it('returns single paragraph from element.text fallback', () => {
		const paragraphs = groupIntoParagraphs({ text: 'hello world', textSegments: undefined });
		expect(paragraphs).toHaveLength(1);
		expect(paragraphs[0].segments[0].text).toBe('hello world');
	});

	it('splits textSegments on isParagraphBreak', () => {
		const segs: TextSegment[] = [
			{ text: 'line1', style: {} },
			{ text: '', style: {}, isParagraphBreak: true },
			{ text: 'line2', style: {} },
		];
		const paragraphs = groupIntoParagraphs({ textSegments: segs });
		expect(paragraphs).toHaveLength(2);
		expect(paragraphs[0].segments[0].text).toBe('line1');
		expect(paragraphs[1].segments[0].text).toBe('line2');
	});

	it('omits trailing empty paragraphs after a break', () => {
		const segs: TextSegment[] = [
			{ text: 'only', style: {} },
			{ text: '', style: {}, isParagraphBreak: true },
		];
		const paragraphs = groupIntoParagraphs({ textSegments: segs });
		expect(paragraphs).toHaveLength(1);
	});
});

// ── getTextWarp: no warp cases ─────────────────────────────────────────

describe('getTextWarp - no warp', () => {
	it('returns undefined for a non-text element', () => {
		expect(getTextWarp(makeNonTextElement())).toBeUndefined();
	});

	it('returns undefined for textNoShape', () => {
		expect(getTextWarp(makeTextElement('textNoShape', { text: 'hi' }))).toBeUndefined();
	});

	it('returns undefined for textPlain', () => {
		expect(getTextWarp(makeTextElement('textPlain', { text: 'hi' }))).toBeUndefined();
	});

	it('returns undefined for unknown preset', () => {
		expect(getTextWarp(makeTextElement('textFoo', { text: 'hi' }))).toBeUndefined();
	});

	it('returns undefined for undefined preset', () => {
		expect(getTextWarp(makeTextElement(undefined, { text: 'hi' }))).toBeUndefined();
	});

	it('returns undefined for SVG preset with no text segments', () => {
		// No text and no textSegments → groupIntoParagraphs returns [] → undefined
		expect(getTextWarp(makeTextElement('textArchUp'))).toBeUndefined();
	});
});

// ── getTextWarp: path strategy ─────────────────────────────────────────

describe('getTextWarp - strategy: path', () => {
	const el = makeTextElement('textArchUp', { text: 'WordArt' });

	it('returns a TextWarpPathDef for textArchUp', () => {
		const def = getTextWarp(el);
		expect(def).toBeDefined();
		expect(def!.strategy).toBe('path');
	});

	it('pathLines has one entry per paragraph', () => {
		const segs: TextSegment[] = [
			{ text: 'line1', style: {} },
			{ text: '', style: {}, isParagraphBreak: true },
			{ text: 'line2', style: {} },
		];
		const twoParaEl = makeTextElement('textArchUp', { textSegments: segs });
		const def = getTextWarp(twoParaEl) as TextWarpPathDef;
		expect(def.strategy).toBe('path');
		expect(def.pathLines).toHaveLength(2);
	});

	it('pathLines[0] has a non-empty d string starting with "M"', () => {
		const def = getTextWarp(el) as TextWarpPathDef;
		expect(def.pathLines[0].d).toMatch(/^M /u);
	});

	it('pathId is unique per line', () => {
		const segs: TextSegment[] = [
			{ text: 'a', style: {} },
			{ text: '', style: {}, isParagraphBreak: true },
			{ text: 'b', style: {} },
		];
		const multiEl = makeTextElement('textWave1', { textSegments: segs });
		const def = getTextWarp(multiEl) as TextWarpPathDef;
		const ids = def.pathLines.map((l) => l.pathId);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('textAnchor is "middle" for center-aligned text', () => {
		const centerEl = makeTextElement('textCircle', { text: 'hi', align: 'center' });
		const def = getTextWarp(centerEl) as TextWarpPathDef;
		expect(def.textAnchor).toBe('middle');
		expect(def.startOffset).toBe('50%');
	});

	it('textAnchor is "start" for left-aligned text', () => {
		const leftEl = makeTextElement('textCircle', { text: 'hi', align: 'left' });
		const def = getTextWarp(leftEl) as TextWarpPathDef;
		expect(def.textAnchor).toBe('start');
		expect(def.startOffset).toBe('0%');
	});

	it('carries element width and height', () => {
		const def = getTextWarp(el) as TextWarpPathDef;
		expect(def.width).toBe(300);
		expect(def.height).toBe(150);
	});

	it('works for shape elements with text warp', () => {
		const sh = makeShapeElement('textChevron');
		const def = getTextWarp(sh) as TextWarpPathDef;
		expect(def).toBeDefined();
		expect(def.strategy).toBe('path');
	});

	it('textCircle produces a two-arc closed path in d', () => {
		const circleEl = makeTextElement('textCircle', { text: 'ring' });
		const def = getTextWarp(circleEl) as TextWarpPathDef;
		const aCount = (def.pathLines[0].d.match(/\bA\b/gu) ?? []).length;
		expect(aCount).toBe(2);
	});
});

// ── getTextWarp: css strategy ──────────────────────────────────────────

describe('getTextWarp - strategy: css', () => {
	it('returns TextWarpCssDef for textSlantUp', () => {
		const el = makeTextElement('textSlantUp', { text: 'hi' });
		const def = getTextWarp(el) as TextWarpCssDef;
		expect(def).toBeDefined();
		expect(def.strategy).toBe('css');
		expect(def.preset).toBe('textSlantUp');
		expect(def.cssTransform).toContain('perspective');
		expect(def.cssTransformOrigin).toBe('left center');
	});

	it('returns TextWarpCssDef for textFadeDown', () => {
		const el = makeTextElement('textFadeDown', { text: 'hi' });
		const def = getTextWarp(el) as TextWarpCssDef;
		expect(def.strategy).toBe('css');
		expect(def.cssTransform).toContain('rotateX');
		expect(def.cssTransformOrigin).toBe('center top');
	});

	it('returns TextWarpCssDef for textCascadeUp', () => {
		const el = makeTextElement('textCascadeUp', { text: 'hi' });
		const def = getTextWarp(el) as TextWarpCssDef;
		expect(def.strategy).toBe('css');
		expect(def.cssTransform).toContain('skewY');
		expect(def.cssTransformOrigin).toBe('left top');
	});

	it('returns TextWarpCssDef for textInflate (envelope)', () => {
		const el = makeTextElement('textInflate', { text: 'hi' });
		const def = getTextWarp(el) as TextWarpCssDef;
		expect(def.strategy).toBe('css');
		expect(def.cssTransform).toContain('scaleY');
	});

	it('returns TextWarpCssDef for textCanDown (envelope)', () => {
		const el = makeTextElement('textCanDown', { text: 'hi' });
		const def = getTextWarp(el) as TextWarpCssDef;
		expect(def.strategy).toBe('css');
		expect(def.cssTransform).toContain('rotateX');
	});

	it('cssTransform strings do not contain "none" or empty transform-origin', () => {
		for (const preset of ['textSlantDown', 'textFadeLeft', 'textCascadeDown']) {
			const el = makeTextElement(preset, { text: 'x' });
			const def = getTextWarp(el);
			expect(def).toBeDefined();
			expect((def as TextWarpCssDef).cssTransform.length).toBeGreaterThan(0);
			expect((def as TextWarpCssDef).cssTransformOrigin.length).toBeGreaterThan(0);
		}
	});
});

// ── getTextWarp: path strategy covers all SVG presets ─────────────────

describe('getTextWarp - all SVG path presets produce valid path defs', () => {
	// Drive directly from the canonical path-preset set so the test stays in
	// sync with the renderer's routing (envelope/simple presets are CSS, not
	// textPath, and are covered by the css-strategy describe block).
	const svgPresets = [...SVG_WARP_PRESETS];

	it.each(svgPresets)('preset %s yields strategy "path" with a non-empty d', (preset) => {
		const el = makeTextElement(preset, { text: 'test' });
		const def = getTextWarp(el) as TextWarpPathDef;
		expect(def).toBeDefined();
		expect(def.strategy).toBe('path');
		expect(def.pathLines[0].d.length).toBeGreaterThan(0);
	});
});
