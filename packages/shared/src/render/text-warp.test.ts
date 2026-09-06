import type { PptxElement, PptxTextWarpPreset } from 'pptx-viewer-core';
import { describe, it, expect, expectTypeOf } from 'vitest';

import {
	ALL_CLASSIFIED_PRESETS,
	SVG_WARP_PRESETS,
	WARP_PATH_GENERATORS,
	buildWarpPath,
	classifyTextWarp,
	getEnvelopeCssTransform,
	getSimpleCssTransform,
	getWarpCssTransform,
	groupIntoParagraphs,
	hasTextWarp,
	shouldUseSvgWarp,
} from './text-warp';

describe('classifyTextWarp', () => {
	it('returns "none" for undefined/empty and plain presets', () => {
		expect(classifyTextWarp(undefined)).toBe('none');
		expect(classifyTextWarp('')).toBe('none');
		expect(classifyTextWarp('textNoShape')).toBe('none');
		expect(classifyTextWarp('textPlain')).toBe('none');
	});

	it('classifies path presets', () => {
		expect(classifyTextWarp('textArchUp')).toBe('path');
		expect(classifyTextWarp('textCircle')).toBe('path');
		expect(classifyTextWarp('textWave1')).toBe('path');
		expect(classifyTextWarp('textTriangle')).toBe('path');
		expect(classifyTextWarp('textChevron')).toBe('path');
	});

	it('classifies envelope presets', () => {
		expect(classifyTextWarp('textInflate')).toBe('envelope');
		expect(classifyTextWarp('textDeflate')).toBe('envelope');
		expect(classifyTextWarp('textCanUp')).toBe('envelope');
	});

	it('classifies the former "simple" family (slant/fade/cascade) as path', () => {
		// These moved out of the CSS-transform-approximated `simple` family once
		// their generators became single-line-safe: they now render as true SVG
		// textPath, the same mechanism as arch/wave/circle.
		expect(classifyTextWarp('textSlantUp')).toBe('path');
		expect(classifyTextWarp('textSlantDown')).toBe('path');
		expect(classifyTextWarp('textFadeUp')).toBe('path');
		expect(classifyTextWarp('textFadeDown')).toBe('path');
		expect(classifyTextWarp('textFadeLeft')).toBe('path');
		expect(classifyTextWarp('textFadeRight')).toBe('path');
		expect(classifyTextWarp('textCascadeUp')).toBe('path');
		expect(classifyTextWarp('textCascadeDown')).toBe('path');
	});

	it('never classifies a preset as "simple" any more', () => {
		for (const preset of ALL_CLASSIFIED_PRESETS) {
			expect(classifyTextWarp(preset)).not.toBe('simple');
		}
	});

	it('returns "none" for unknown presets', () => {
		expect(classifyTextWarp('textTotallyMadeUp')).toBe('none');
	});

	it('exposes the union of all classified presets', () => {
		expect(ALL_CLASSIFIED_PRESETS.has('textArchUp')).toBeTruthy();
		expect(ALL_CLASSIFIED_PRESETS.has('textInflate')).toBeTruthy();
		expect(ALL_CLASSIFIED_PRESETS.has('textNoShape')).toBeTruthy();
	});
});

describe('shouldUseSvgWarp', () => {
	it('returns false for undefined / plain presets', () => {
		expect(shouldUseSvgWarp(undefined)).toBeFalsy();
		expect(shouldUseSvgWarp('textNoShape')).toBeFalsy();
		expect(shouldUseSvgWarp('textPlain')).toBeFalsy();
	});

	it('returns true for known SVG warp presets', () => {
		expect(shouldUseSvgWarp('textArchUp')).toBeTruthy();
		expect(shouldUseSvgWarp('textCircle')).toBeTruthy();
		expect(shouldUseSvgWarp('textWave1')).toBeTruthy();
		expect(shouldUseSvgWarp('textTriangle')).toBeTruthy();
		expect(shouldUseSvgWarp('textInflate')).toBeTruthy();
		expect(shouldUseSvgWarp('textSlantUp')).toBeTruthy();
		expect(shouldUseSvgWarp('textDeflateInflateDeflate')).toBeTruthy();
	});

	it('returns false for unknown preset strings', () => {
		expect(shouldUseSvgWarp('textUnknownShape' as unknown as PptxTextWarpPreset)).toBeFalsy();
	});
});

describe('hasTextWarp', () => {
	function textElement(preset?: string): PptxElement {
		return {
			type: 'text',
			id: 't1',
			x: 0,
			y: 0,
			width: 200,
			height: 100,
			text: 'Hello',
			textStyle: preset ? { textWarpPreset: preset } : {},
		} as PptxElement;
	}

	it('is true for an element with a warp preset', () => {
		expect(hasTextWarp(textElement('textArchUp'))).toBeTruthy();
	});

	it('is false for a text element without a warp preset', () => {
		expect(hasTextWarp(textElement())).toBeFalsy();
		expect(hasTextWarp(textElement('textPlain'))).toBeFalsy();
	});

	it('is false for a non-text element', () => {
		const img = {
			type: 'image',
			id: 'i1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
		} as PptxElement;
		expect(hasTextWarp(img)).toBeFalsy();
	});
});

describe('wARP_PATH_GENERATORS', () => {
	it('has a generator for every SVG warp preset', () => {
		for (const preset of SVG_WARP_PRESETS) {
			expect(WARP_PATH_GENERATORS[preset]).toBeDefined();
			expectTypeOf(WARP_PATH_GENERATORS[preset]).toBeFunction();
		}
	});

	it('produces valid SVG path strings starting with M', () => {
		for (const [, generator] of Object.entries(WARP_PATH_GENERATORS)) {
			const path = generator(200, 100, 0.5);
			expectTypeOf(path).toBeString();
			expect(path.charAt(0)).toBe('M');
		}
	});

	it('produces different paths for different t values', () => {
		const gen = WARP_PATH_GENERATORS['textArchUp'];
		expect(gen(200, 100, 0)).not.toBe(gen(200, 100, 1));
	});

	it('respects adjustment values', () => {
		const gen = WARP_PATH_GENERATORS['textWave1'];
		expect(gen(200, 100, 0.5, 5000)).not.toBe(gen(200, 100, 0.5, 25000));
	});

	it('accepts adj/adj2 for all generators', () => {
		for (const [, gen] of Object.entries(WARP_PATH_GENERATORS)) {
			expect(gen(200, 100, 0.5, 50000, 25000)).toMatch(/^M/u);
		}
	});

	it('slant up rises (yEnd < yStart)', () => {
		const path = WARP_PATH_GENERATORS['textSlantUp'](200, 100, 0.5);
		const match = path.match(/M 0,(?<y0>\d+\.?\d*)\s+L\s+\d+\.?\d*,(?<y1>\d+\.?\d*)/u);
		expect(match).not.toBeNull();
		expect(parseFloat(match!.groups!.y0)).toBeGreaterThan(parseFloat(match!.groups!.y1));
	});

	/**
	 * A single-paragraph WordArt element always renders its one line at
	 * `t = 0.5` (see `buildWarpPath`). Several generators used a `t`-only
	 * modulation (`1 - 2*t`, `2*t - 1`, `sin(t*2*PI)`) that is exactly zero at
	 * `t = 0.5`, so the *overwhelmingly common* single-line WordArt case
	 * rendered these presets as a perfectly flat baseline: no visible warp at
	 * all, worse than even the CSS-transform approximation it replaced.
	 * Regression-pins non-degeneracy at the default adjustment for every
	 * preset known to have had this bug.
	 */
	it('does not degenerate to a flat baseline at t=0.5 (single-line WordArt)', () => {
		const singleLineDegenerate = [
			'textInflate',
			'textDeflate',
			'textDeflateInflateDeflate',
			'textFadeRight',
			'textFadeLeft',
			'textButton',
			'textButtonPour',
		] as const;
		for (const preset of singleLineDegenerate) {
			const path = WARP_PATH_GENERATORS[preset](200, 100, 0.5);
			// A degenerate path is a straight horizontal/diagonal line whose
			// control/end points equal its start point's y (curves) or whose two
			// endpoints share the same y (lines). Assert the path is NOT the
			// straight `M 0,y L w,y` shape by checking it has curve commands or
			// differing y-coordinates.
			const yValues = [...path.matchAll(/-?\d+\.?\d*/gu)].map(Number);
			const distinctY = new Set(yValues.filter((_, i) => i % 2 === 1));
			expect(
				distinctY.size,
				`${preset} produced a flat single-line baseline: ${path}`,
			).toBeGreaterThan(1);
		}
	});
});

describe('buildWarpPath', () => {
	it('returns a valid path for a known preset', () => {
		const path = buildWarpPath('textArchUp', 200, 100, 0, 3);
		expect(path.startsWith('M')).toBeTruthy();
	});

	it('uses t=0.5 for a single line', () => {
		const single = buildWarpPath('textWave1', 200, 100, 0, 1);
		const expected = WARP_PATH_GENERATORS['textWave1'](200, 100, 0.5);
		expect(single).toBe(expected);
	});

	it('distributes t across lines', () => {
		const first = buildWarpPath('textInflate', 200, 100, 0, 3);
		const last = buildWarpPath('textInflate', 200, 100, 2, 3);
		expect(first).not.toBe(last);
	});

	it('passes adj/adj2 through to the generator', () => {
		const expected = WARP_PATH_GENERATORS['textInflate'](200, 100, 0.5, 37500, undefined);
		expect(buildWarpPath('textInflate', 200, 100, 0, 1, 37500)).toBe(expected);
	});

	it('falls back to a straight line for an unknown preset', () => {
		const path = buildWarpPath('textNope' as unknown as PptxTextWarpPreset, 200, 100, 0, 1);
		expect(path).toContain('M 0,');
		expect(path).toContain('L 200,');
	});

	it('handles zero dimensions gracefully', () => {
		expect(buildWarpPath('textArchUp', 200, 0, 0, 1).length).toBeGreaterThan(0);
		expect(buildWarpPath('textArchUp', 0, 100, 0, 1).length).toBeGreaterThan(0);
	});
});

describe('getEnvelopeCssTransform', () => {
	it('inflate uses scale at default intensity 1', () => {
		const style = getEnvelopeCssTransform('textInflate');
		expect(style).toBeDefined();
		expect(style!.transform).toBe('scaleY(1.15) scaleX(1.05)');
		expect(style!.transformOrigin).toBe('center center');
	});

	it('deflate scales below 1', () => {
		const style = getEnvelopeCssTransform('textDeflate');
		expect(style!.transform).toBe('scaleY(0.88) scaleX(0.95)');
		expect(style!.transformOrigin).toBe('center center');
	});

	it('can-up uses perspective + negative rotateX', () => {
		const style = getEnvelopeCssTransform('textCanUp');
		expect(style!.transform).toContain('perspective(');
		expect(style!.transform).toContain('rotateX(-6deg)');
		expect(style!.transformOrigin).toBe('center center');
	});

	it('explicit default adj matches the implicit default', () => {
		expect(getEnvelopeCssTransform('textInflate')).toStrictEqual(
			getEnvelopeCssTransform('textInflate', 18750),
		);
	});

	it('scales intensity with adj1', () => {
		const small = getEnvelopeCssTransform('textInflate', 9375); // half default
		const large = getEnvelopeCssTransform('textInflate', 37500); // double default
		expect(small!.transform).not.toBe(large!.transform);
		expect(small!.transform).toBe('scaleY(1.075) scaleX(1.025)');
		expect(large!.transform).toBe('scaleY(1.3) scaleX(1.1)');
	});

	it('returns undefined for a non-envelope preset', () => {
		expect(getEnvelopeCssTransform('textArchUp')).toBeUndefined();
		expect(getEnvelopeCssTransform('textUnknown')).toBeUndefined();
	});
});

describe('getSimpleCssTransform', () => {
	it('slant up uses rotateY + skewY from the left', () => {
		const style = getSimpleCssTransform('textSlantUp');
		expect(style).toBeDefined();
		expect(style!.transform).toBe('perspective(500px) rotateY(8deg) skewY(-4deg)');
		expect(style!.transformOrigin).toBe('left center');
	});

	it('cascade down skews positively from top-left', () => {
		const style = getSimpleCssTransform('textCascadeDown');
		expect(style!.transform).toBe('skewY(8deg)');
		expect(style!.transformOrigin).toBe('left top');
	});

	it('fade right rotates around Y from the left', () => {
		const style = getSimpleCssTransform('textFadeRight');
		expect(style!.transform).toBe('perspective(400px) rotateY(-10deg)');
		expect(style!.transformOrigin).toBe('left center');
	});

	it('scales the angle with adj1', () => {
		const small = getSimpleCssTransform('textSlantUp', 27500); // half default
		const large = getSimpleCssTransform('textSlantUp', 110000); // double default
		expect(small!.transform).toBe('perspective(500px) rotateY(4deg) skewY(-2deg)');
		expect(large!.transform).toBe('perspective(500px) rotateY(16deg) skewY(-8deg)');
	});

	it('returns undefined for a non-simple preset', () => {
		expect(getSimpleCssTransform('textInflate')).toBeUndefined();
		expect(getSimpleCssTransform('textUnknown')).toBeUndefined();
	});
});

describe('getWarpCssTransform', () => {
	it('dispatches envelope presets to the envelope generator', () => {
		expect(getWarpCssTransform('textInflate')).toStrictEqual(
			getEnvelopeCssTransform('textInflate'),
		);
	});

	it('never dispatches to the simple generator (no preset classifies as "simple" any more)', () => {
		// textSlantUp moved from `simple` to `path` once its generator became
		// single-line-safe (see text-warp.ts); it now renders as true SVG
		// textPath, so the CSS-transform dispatcher must no longer touch it.
		expect(getWarpCssTransform('textSlantUp')).toBeUndefined();
		expect(getSimpleCssTransform('textSlantUp')).toBeDefined(); // the generator itself still exists
	});

	it('passes adjustments through for the envelope family', () => {
		expect(getWarpCssTransform('textInflate', 37500)).toStrictEqual(
			getEnvelopeCssTransform('textInflate', 37500),
		);
	});

	it('returns undefined for path / none presets', () => {
		expect(getWarpCssTransform('textArchUp')).toBeUndefined();
		expect(getWarpCssTransform('textSlantUp')).toBeUndefined();
		expect(getWarpCssTransform('textFadeRight')).toBeUndefined();
		expect(getWarpCssTransform('textPlain')).toBeUndefined();
		expect(getWarpCssTransform(undefined)).toBeUndefined();
	});
});

describe('groupIntoParagraphs', () => {
	it('returns an empty array when there is no text or segments', () => {
		expect(groupIntoParagraphs({})).toStrictEqual([]);
		expect(groupIntoParagraphs({ textSegments: [] })).toStrictEqual([]);
	});

	it('falls back to a single synthetic paragraph from element text', () => {
		expect(groupIntoParagraphs({ text: 'hello' })).toStrictEqual([
			{ segments: [{ text: 'hello', style: {} }] },
		]);
	});

	it('splits segments on paragraph-break markers and drops the markers', () => {
		const result = groupIntoParagraphs({
			textSegments: [
				{ text: 'a', style: {} },
				{ text: 'b', style: {} },
				{ text: '', style: {}, isParagraphBreak: true },
				{ text: 'c', style: {} },
			],
		});
		expect(result).toHaveLength(2);
		expect(result[0].segments.map((s) => s.text)).toStrictEqual(['a', 'b']);
		expect(result[1].segments.map((s) => s.text)).toStrictEqual(['c']);
	});

	it('ignores trailing and consecutive breaks without emitting empty paragraphs', () => {
		const result = groupIntoParagraphs({
			textSegments: [
				{ text: 'a', style: {} },
				{ text: '', style: {}, isParagraphBreak: true },
				{ text: '', style: {}, isParagraphBreak: true },
			],
		});
		expect(result).toHaveLength(1);
		expect(result[0].segments.map((s) => s.text)).toStrictEqual(['a']);
	});

	it('splits on a bare "\\n" separator with no isParagraphBreak flag (the slide-load path)', () => {
		// `PptxHandlerRuntimeShapeParagraphContentParsing` tags the terminator
		// between two `<a:p>` paragraphs as a plain `text: '\n'` segment with NO
		// `isParagraphBreak` flag on initial load (only a post-edit remap adds
		// that flag) - a caller that checked `isParagraphBreak` alone silently
		// merged both paragraphs into one, and the literal "\n" character was
		// then measured and rendered as its own WordArt glyph.
		const result = groupIntoParagraphs({
			textSegments: [
				{ text: 'Top', style: {} },
				{ text: '\n', style: {} },
				{ text: 'Bottom', style: {} },
			],
		});
		expect(result).toHaveLength(2);
		expect(result[0].segments.map((s) => s.text)).toStrictEqual(['Top']);
		expect(result[1].segments.map((s) => s.text)).toStrictEqual(['Bottom']);
	});

	it('keeps a soft line-break ("\\n" with isLineBreak) inside its own paragraph', () => {
		const result = groupIntoParagraphs({
			textSegments: [
				{ text: 'a', style: {} },
				{ text: '\n', style: {}, isLineBreak: true },
				{ text: 'b', style: {} },
			],
		});
		expect(result).toHaveLength(1);
		expect(result[0].segments.map((s) => s.text)).toStrictEqual(['a', '\n', 'b']);
	});

	it('applies the optional per-segment transform to non-break segments', () => {
		const result = groupIntoParagraphs(
			{
				textSegments: [
					{ text: 'raw', style: {}, fieldType: 'slidenum' },
					{ text: 'keep', style: {} },
				],
			},
			(seg) => (seg.fieldType ? { ...seg, text: '7' } : seg),
		);
		expect(result[0].segments.map((s) => s.text)).toStrictEqual(['7', 'keep']);
	});
});
