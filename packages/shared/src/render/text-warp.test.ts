import type { PptxElement, PptxTextWarpPreset } from 'pptx-viewer-core';
import { describe, it, expect, expectTypeOf } from 'vitest';

import {
	ALL_CLASSIFIED_PRESETS,
	SVG_WARP_PRESETS,
	WARP_PATH_GENERATORS,
	buildWarpPath,
	classifyTextWarp,
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

	it('classifies simple presets', () => {
		expect(classifyTextWarp('textSlantUp')).toBe('simple');
		expect(classifyTextWarp('textFadeRight')).toBe('simple');
		expect(classifyTextWarp('textCascadeUp')).toBe('simple');
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
