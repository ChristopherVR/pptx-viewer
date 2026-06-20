import type { ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildPatternFillCss, getPatternSvg } from './color-patterns';

// ---------------------------------------------------------------------------
// getPatternSvg
// ---------------------------------------------------------------------------

describe('getPatternSvg', () => {
	it('returns undefined for an unknown preset', () => {
		expect(getPatternSvg('__unknown__', '#000000', '#ffffff')).toBeUndefined();
	});

	it('pct5: includes fg colour and is an SVG string', () => {
		const result = getPatternSvg('pct5', '#ff0000', '#0000ff');
		expect(result).toBeDefined();
		expect(result).toContain('<svg');
		expect(result).toContain('#ff0000');
		expect(result).toContain('#0000ff');
	});

	it('horz: contains a horizontal band rect in the fg colour', () => {
		const result = getPatternSvg('horz', '#111111', '#eeeeee');
		expect(result).toBeDefined();
		expect(result).toContain('#111111');
		expect(result).toContain('#eeeeee');
	});

	it('vert: contains a vertical band rect in the fg colour', () => {
		const result = getPatternSvg('vert', '#aabbcc', '#ffffff');
		expect(result).toBeDefined();
		expect(result).toContain('#aabbcc');
	});

	it('cross: covers both horizontal and vertical bands', () => {
		const result = getPatternSvg('cross', '#123456', '#abcdef');
		expect(result).toBeDefined();
		// cross must reference fg twice (one horizontal + one vertical rect)
		const count = (result ?? '').split('#123456').length - 1;
		expect(count).toBeGreaterThanOrEqual(2);
	});

	it('diagCross: produces line elements for fg colour', () => {
		const result = getPatternSvg('diagCross', '#222222', '#ffffff');
		expect(result).toBeDefined();
		expect(result).toContain('<line');
		expect(result).toContain('#222222');
	});

	it('dnDiag: produces line elements', () => {
		const result = getPatternSvg('dnDiag', '#ff00ff', '#ffffff');
		expect(result).toBeDefined();
		expect(result).toContain('<line');
	});

	it('upDiag: produces line elements', () => {
		const result = getPatternSvg('upDiag', '#00ff00', '#000000');
		expect(result).toBeDefined();
		expect(result).toContain('<line');
	});

	it('smCheck: produces two foreground rects on background', () => {
		const result = getPatternSvg('smCheck', '#ff0000', '#0000ff');
		expect(result).toBeDefined();
		expect(result).toContain('#ff0000');
	});

	it('lgCheck: produces two foreground rects on background', () => {
		const result = getPatternSvg('lgCheck', '#ff0000', '#0000ff');
		expect(result).toBeDefined();
		expect(result).toContain('#ff0000');
	});

	it('sphere: contains a radialGradient element', () => {
		const result = getPatternSvg('sphere', '#ff0000', '#ffffff');
		expect(result).toBeDefined();
		expect(result).toContain('radialGradient');
	});

	it('wave: contains path elements', () => {
		const result = getPatternSvg('wave', '#0000ff', '#ffffff');
		expect(result).toBeDefined();
		expect(result).toContain('<path');
	});

	it('zigZag: contains path elements', () => {
		const result = getPatternSvg('zigZag', '#cc0000', '#ffffff');
		expect(result).toBeDefined();
		expect(result).toContain('<path');
	});

	it('trellis: contains a grid of rects', () => {
		const result = getPatternSvg('trellis', '#333333', '#cccccc');
		expect(result).toBeDefined();
		expect(result).toContain('<rect');
	});

	it('pct50: checkerboard 2x2 tile', () => {
		const result = getPatternSvg('pct50', '#000000', '#ffffff');
		expect(result).toBeDefined();
		// 2x2 tile: width="2" height="2"
		expect(result).toContain('width="2"');
		expect(result).toContain('height="2"');
	});

	it('dotGrid: contains circle elements', () => {
		const result = getPatternSvg('dotGrid', '#ff0000', '#ffffff');
		expect(result).toBeDefined();
		expect(result).toContain('<circle');
	});

	it('solidDmnd: contains a polygon element', () => {
		const result = getPatternSvg('solidDmnd', '#ff0000', '#ffffff');
		expect(result).toBeDefined();
		expect(result).toContain('<polygon');
	});

	it('dashDnDiag: contains a stroke-dasharray attribute', () => {
		const result = getPatternSvg('dashDnDiag', '#000000', '#ffffff');
		expect(result).toBeDefined();
		expect(result).toContain('stroke-dasharray');
	});

	it('dashUpDiag: contains a stroke-dasharray attribute', () => {
		const result = getPatternSvg('dashUpDiag', '#000000', '#ffffff');
		expect(result).toBeDefined();
		expect(result).toContain('stroke-dasharray');
	});

	it('all 52 OOXML presets return a non-undefined value', () => {
		const presets = [
			'pct5',
			'pct10',
			'pct20',
			'pct25',
			'pct30',
			'pct40',
			'pct50',
			'pct60',
			'pct70',
			'pct75',
			'pct80',
			'pct90',
			'horz',
			'vert',
			'ltHorz',
			'ltVert',
			'dkHorz',
			'dkVert',
			'narHorz',
			'narVert',
			'wdHorz',
			'wdVert',
			'dashHorz',
			'dashVert',
			'cross',
			'dnDiag',
			'upDiag',
			'ltDnDiag',
			'ltUpDiag',
			'dkDnDiag',
			'dkUpDiag',
			'wdDnDiag',
			'wdUpDiag',
			'dashDnDiag',
			'dashUpDiag',
			'diagCross',
			'smCheck',
			'lgCheck',
			'smGrid',
			'lgGrid',
			'dotGrid',
			'smConfetti',
			'lgConfetti',
			'horzBrick',
			'diagBrick',
			'solidDmnd',
			'openDmnd',
			'dotDmnd',
			'plaid',
			'sphere',
			'weave',
			'divot',
			'shingle',
			'wave',
			'trellis',
			'zigZag',
		];
		for (const preset of presets) {
			const result = getPatternSvg(preset, '#000000', '#ffffff');
			expect(result, `preset "${preset}" should return SVG`).toBeDefined();
			expect(result, `preset "${preset}" should be an SVG element`).toContain('<svg');
		}
	});
});

// ---------------------------------------------------------------------------
// buildPatternFillCss
// ---------------------------------------------------------------------------

describe('buildPatternFillCss', () => {
	it('returns undefined when style is undefined', () => {
		expect(buildPatternFillCss(undefined)).toBeUndefined();
	});

	it('returns undefined when fillMode is not "pattern"', () => {
		const style: ShapeStyle = { fillMode: 'solid', fillColor: '#ff0000' };
		expect(buildPatternFillCss(style)).toBeUndefined();
	});

	it('returns undefined when fillMode is "gradient"', () => {
		const style: ShapeStyle = { fillMode: 'gradient', fillColor: '#ff0000' };
		expect(buildPatternFillCss(style)).toBeUndefined();
	});

	it('returns undefined when fillPatternPreset is missing', () => {
		const style: ShapeStyle = { fillMode: 'pattern', fillColor: '#000000' };
		expect(buildPatternFillCss(style)).toBeUndefined();
	});

	it('returns undefined for an unknown preset', () => {
		const style: ShapeStyle = {
			fillMode: 'pattern',
			fillColor: '#000000',
			fillPatternPreset: '__no_such_preset__',
		};
		expect(buildPatternFillCss(style)).toBeUndefined();
	});

	it('returns backgroundImage as a data URI for a known preset', () => {
		const style: ShapeStyle = {
			fillMode: 'pattern',
			fillColor: '#000000',
			fillPatternPreset: 'horz',
			fillPatternBackgroundColor: '#ffffff',
		};
		const result = buildPatternFillCss(style);
		expect(result).toBeDefined();
		expect(result?.backgroundImage).toMatch(/^url\("data:image\/svg\+xml,/u);
	});

	it('backgroundImage contains percent-encoded SVG with the fg colour', () => {
		const style: ShapeStyle = {
			fillMode: 'pattern',
			fillColor: '#ff0000',
			fillPatternPreset: 'vert',
			fillPatternBackgroundColor: '#0000ff',
		};
		const result = buildPatternFillCss(style);
		expect(result).toBeDefined();
		// %23 is the percent-encoded '#'
		expect(result?.backgroundImage).toContain('%23ff0000');
	});

	it('backgroundColor equals the normalised bg colour', () => {
		const style: ShapeStyle = {
			fillMode: 'pattern',
			fillColor: '#000000',
			fillPatternPreset: 'cross',
			fillPatternBackgroundColor: '#aabbcc',
		};
		const result = buildPatternFillCss(style);
		expect(result?.backgroundColor).toBe('#aabbcc');
	});

	it('falls back to #ffffff background when fillPatternBackgroundColor is absent', () => {
		const style: ShapeStyle = {
			fillMode: 'pattern',
			fillColor: '#000000',
			fillPatternPreset: 'pct5',
		};
		const result = buildPatternFillCss(style);
		expect(result?.backgroundColor).toBe('#ffffff');
	});

	it('falls back to #000000 foreground when fillColor is absent', () => {
		const style: ShapeStyle = {
			fillMode: 'pattern',
			fillPatternPreset: 'pct5',
			fillPatternBackgroundColor: '#cccccc',
		};
		const result = buildPatternFillCss(style);
		// The result should still be defined (fallback fg #000000 is valid)
		expect(result).toBeDefined();
		expect(result?.backgroundColor).toBe('#cccccc');
	});
});
