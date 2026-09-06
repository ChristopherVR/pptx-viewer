/**
 * Unit tests for the Angular text-warp descriptor resolver.
 *
 * Covers: getTextWarp(), getWarpCategory(), groupIntoParagraphs(),
 *         ALL_CLASSIFIED_PRESETS membership, and the TextWarpDef shape.
 */
import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { hasGlyphEnvelope } from '../internal/shared';
import {
	ALL_CLASSIFIED_PRESETS,
	getTextWarp,
	getWarpCategory,
	groupIntoParagraphs,
} from './text-warp';
import type { TextWarpGlyphDef, TextWarpPathDef } from './text-warp';
import { SVG_WARP_PRESETS } from './warp-path-generators';

// ── helpers ────────────────────────────────────────────────────────────

/** The `d` (vertical scale) term out of a glyph's `matrix(1 b 0 d 0 f)` transform. */
function matrixScaleY(transform: string): number {
	const terms = transform.replace('matrix(', '').replace(')', '').trim().split(/\s+/u);
	return Number(terms[3]);
}

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

	it('classifies the former "simple" family (slant/fade/cascade) as path', () => {
		// These moved from the CSS-transform-approximated `simple` family to
		// true SVG textPath once their generators became single-line-safe; see
		// `pptx-viewer-shared`'s `text-warp.ts`.
		expect(getWarpCategory('textSlantUp')).toBe('path');
		expect(getWarpCategory('textFadeRight')).toBe('path');
		expect(getWarpCategory('textCascadeDown')).toBe('path');
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

	it('substitutes field-run text in warp paragraphs when a field context is given', () => {
		const segs: TextSegment[] = [
			{ text: 'Slide ', style: {} },
			{ text: '0', style: {}, fieldType: 'slidenum' },
		];
		const fieldEl = makeTextElement('textArchUp', { textSegments: segs });
		const withCtx = getTextWarp(fieldEl, { slideNumber: 4 }) as TextWarpPathDef;
		expect(withCtx.pathLines[0].segments.map((s) => s.text)).toStrictEqual(['Slide ', '4']);
		// No context -> raw field text is preserved.
		const noCtx = getTextWarp(fieldEl) as TextWarpPathDef;
		expect(noCtx.pathLines[0].segments.map((s) => s.text)).toStrictEqual(['Slide ', '0']);
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

// ── getTextWarp: former "css strategy" presets now render as true path ──

describe('getTextWarp - envelope/former-simple presets render as true SVG path', () => {
	// Regression pins: `getTextWarp` used to return a `TextWarpCssDef` (a flat
	// CSS-transform approximation) for these presets because
	// `warp-path-generators.ts` exposed a deliberately NARROWER local
	// `shouldUseSvgWarp`. React and Vanilla import shared's BROAD
	// `shouldUseSvgWarp` directly and already rendered these as true SVG
	// textPath, so this was a cross-binding parity bug, not an inherent
	// CSS-only limitation. `warp-path-generators.ts` now re-exports the broad
	// shared set, so every classified preset takes the `'path'` branch.
	it.each([
		'textSlantUp',
		'textFadeDown',
		'textCascadeUp',
		'textSlantDown',
		'textFadeLeft',
		'textCascadeDown',
	])('returns a TextWarpPathDef (not css) for %s', (preset) => {
		const el = makeTextElement(preset, { text: 'hi' });
		const def = getTextWarp(el) as TextWarpPathDef;
		expect(def).toBeDefined();
		expect(def.strategy).toBe('path');
		expect(def.pathLines[0].d).toMatch(/^M /u);
	});
});

// ── getTextWarp: envelope presets get a true two-curve glyph descriptor ─

describe('getTextWarp - envelope presets (inflate/deflate/can) render as a glyph descriptor', () => {
	// The fixed residual: PowerPoint bends inflate/deflate/can between an
	// independent top and bottom curve, so glyph HEIGHT varies with
	// horizontal position; a shared-baseline `<textPath>` cannot express
	// that. These presets now resolve to `strategy: 'glyph'` (one `<text>`
	// per glyph, see `text-warp-glyph.ts`) instead.
	it.each(['textInflate', 'textDeflate', 'textCanUp', 'textCanDown'])(
		'returns a TextWarpGlyphDef (not path) for %s',
		(preset) => {
			const el = makeTextElement(preset, { text: 'Hello' });
			const def = getTextWarp(el) as TextWarpGlyphDef;
			expect(def).toBeDefined();
			expect(def.strategy).toBe('glyph');
			expect(def.glyphs).toHaveLength('Hello'.length);
			expect(def.glyphs.every((g) => g.transform.includes('matrix(1'))).toBeTruthy();
		},
	);

	it('varies scaleY across the line for textInflate (the fixed residual)', () => {
		// Default (unset) adj: at the max (4x) intensity the band can legitimately
		// saturate to the full box height across most of a short line's width
		// (PowerPoint's own extreme Inflate maxes out the same way), which would
		// make every glyph's scaleY identical and defeat this assertion; default
		// intensity still demonstrably varies without that ceiling.
		const el = makeTextElement('textInflate', { text: 'INFLATED TEXT' });
		const def = getTextWarp(el) as TextWarpGlyphDef;
		const scales = def.glyphs.map((g) => matrixScaleY(g.transform));
		expect(new Set(scales.map((s) => s.toFixed(4))).size).toBeGreaterThan(1);
	});

	it('every classified envelope preset name has a glyph-envelope curve', () => {
		for (const preset of SVG_WARP_PRESETS) {
			if (hasGlyphEnvelope(preset)) {
				const el = makeTextElement(preset, { text: 'AB' });
				const def = getTextWarp(el) as TextWarpGlyphDef;
				expect(def.strategy).toBe('glyph');
			}
		}
	});

	it('a multi-paragraph inflate element still uses the per-glyph envelope for every line', () => {
		const el = makeTextElement('textInflate', {
			textSegments: [
				{ text: 'Top', style: {} },
				{ text: '', style: {}, isParagraphBreak: true },
				{ text: 'Bottom', style: {} },
			],
		});
		const def = getTextWarp(el) as TextWarpGlyphDef;
		expect(def.strategy).toBe('glyph');
		// 'Top' (3) + 'Bottom' (6) = 9 glyphs total.
		expect(def.glyphs).toHaveLength(9);
	});

	it('a short caption of very wide glyphs on a steep can-up curve gets sliced with a deterministic clip-id prefix', () => {
		// Wide "M"s at extreme adj: exactly the "6-8 very wide glyphs filling
		// the box" residual from limitations.md, where a single affine per
		// glyph is no longer enough (see `chooseGlyphSliceCount` in
		// pptx-viewer-shared). `makeTextElement`'s box is 300px wide; with no
		// real canvas 2D context in this test environment,
		// `measureGlyphAdvances` falls back to a deterministic
		// `fontSize * 0.55` per character: 3 "M"s at fontSize 160 measure 88px
		// each, ~29% of the line per glyph.
		const el = makeTextElement('textCanUp', { text: 'MMM', adj: 66667, fontSize: 160 });
		const def = getTextWarp(el) as TextWarpGlyphDef;
		expect(def.strategy).toBe('glyph');
		expect(def.glyphs).toHaveLength(3);
		const sliced = def.glyphs.filter((g) => (g.slices?.length ?? 1) > 1);
		expect(sliced.length).toBeGreaterThan(0);
		for (const g of sliced) {
			expect(g.slices!.length).toBeGreaterThan(1);
			// clipIdPrefix is unique per glyph (element id + line + glyph index).
			expect(g.clipIdPrefix).toMatch(/^ng-warp-el-1-l0-g\d+$/u);
		}
		// An ordinary (non-sliced) glyph still carries a usable clipIdPrefix
		// even though the template never references it.
		for (const g of def.glyphs) {
			expect(g.clipIdPrefix.length).toBeGreaterThan(0);
		}
	});
});

// ── getTextWarp: path strategy covers all SVG presets ─────────────────

describe('getTextWarp - all SVG path presets produce valid path defs', () => {
	// Drive directly from the canonical path-preset set so the test stays in
	// sync with the renderer's routing (envelope/simple presets are CSS, not
	// textPath, and are covered by the css-strategy describe block). The
	// glyph-envelope presets (inflate/deflate/can) are excluded here: they
	// resolve to `strategy: 'glyph'`, covered by the describe block above.
	const svgPresets = [...SVG_WARP_PRESETS].filter((preset) => !hasGlyphEnvelope(preset));

	it.each(svgPresets)('preset %s yields strategy "path" with a non-empty d', (preset) => {
		const el = makeTextElement(preset, { text: 'test' });
		const def = getTextWarp(el) as TextWarpPathDef;
		expect(def).toBeDefined();
		expect(def.strategy).toBe('path');
		expect(def.pathLines[0].d.length).toBeGreaterThan(0);
	});
});
