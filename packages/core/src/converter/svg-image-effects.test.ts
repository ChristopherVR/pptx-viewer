import { describe, expect, it } from 'vitest';

import { buildImageEffectsFilter } from './svg-image-effects';

describe('buildImageEffectsFilter', () => {
	it('returns null for undefined effects', () => {
		expect(buildImageEffectsFilter(undefined, '0-0')).toBeNull();
	});

	it('returns null for empty effects', () => {
		expect(buildImageEffectsFilter({}, '0-0')).toBeNull();
	});

	it('emits a saturate=0 matrix for grayscale', () => {
		const f = buildImageEffectsFilter({ grayscale: true }, '0-0');
		expect(f).not.toBeNull();
		expect(f!.defsXml).toContain('<feColorMatrix');
		expect(f!.defsXml).toContain('type="saturate"');
		expect(f!.defsXml).toContain('values="0"');
		expect(f!.filterId).toBe('imgfx-0-0');
	});

	it('emits a hueRotate matrix when hsl.hue is set', () => {
		const f = buildImageEffectsFilter({ hsl: { hue: 45 } }, '1-0');
		expect(f!.defsXml).toContain('type="hueRotate"');
		expect(f!.defsXml).toContain('values="45"');
	});

	it('renders HSL saturation and luminance transfers', () => {
		const filter = buildImageEffectsFilter({ hsl: { sat: -20, lum: 40 } }, '1-0');
		expect(filter!.defsXml).toContain('type="saturate" values="0.8"');
		expect(filter!.defsXml).toContain('slope="0.6" intercept="0.4"');
	});

	it('uses the actual biLevel threshold', () => {
		const low = buildImageEffectsFilter({ biLevel: 25 }, '1-0')!.defsXml;
		const high = buildImageEffectsFilter({ biLevel: 75 }, '1-0')!.defsXml;
		expect(low).not.toBe(high);
		expect(low).toContain(`tableValues="${`${'0 '.repeat(25)}${'1 '.repeat(76)}`.trim()}"`);
	});

	it('renders positive and negative tint transfers after hue rotation', () => {
		const lighter = buildImageEffectsFilter({ tint: { hue: 45, amt: 25 } }, '1-0');
		const darker = buildImageEffectsFilter({ tint: { amt: -30 } }, '1-0');
		expect(lighter!.defsXml).toContain('type="hueRotate" values="45"');
		expect(lighter!.defsXml).toContain('slope="0.75" intercept="0.25"');
		expect(darker!.defsXml).toContain('slope="0.7" intercept="0"');
	});

	it('translates alphaModFix to a matrix that scales alpha', () => {
		const f = buildImageEffectsFilter({ alphaModFix: 50 }, '0-0');
		// last row alpha multiplier 0.5
		expect(f!.defsXml).toMatch(/0 0 0 0\.5 0/);
	});

	it('alphaInv emits feFuncA with slope=-1 intercept=1', () => {
		const f = buildImageEffectsFilter({ alphaInv: {} }, '0-0');
		expect(f!.defsXml).toContain('<feFuncA type="linear" slope="-1" intercept="1"/>');
	});

	it('alphaCeiling and alphaFloor emit discrete feFuncA tables', () => {
		const ceiling = buildImageEffectsFilter({ alphaCeiling: true }, '0-0');
		expect(ceiling!.defsXml).toContain(
			'<feFuncA type="discrete" tableValues="0 1 1 1 1 1 1 1 1 1"/>',
		);
		const floor = buildImageEffectsFilter({ alphaFloor: true }, '0-1');
		expect(floor!.defsXml).toContain(
			'<feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0 0 1"/>',
		);
	});

	it('alphaRepl pins alpha to a constant', () => {
		const f = buildImageEffectsFilter({ alphaRepl: 25 }, '0-0');
		expect(f!.defsXml).toContain('<feFuncA type="linear" slope="0" intercept="0.25"/>');
	});

	it('alphaBiLevel emits a 10-step alpha threshold table', () => {
		const f = buildImageEffectsFilter({ alphaBiLevel: 50 }, '0-0');
		expect(f!.defsXml).toMatch(/<feFuncA type="discrete" tableValues="0 0 0 0 0 1 1 1 1 1"\/>/);
	});

	it('clrRepl produces a colour-matrix that maps to a constant RGB', () => {
		const f = buildImageEffectsFilter({ clrRepl: { color: '#FF8000' } }, '0-0');
		// Last column should encode normalized (1, 0.5019..., 0)
		expect(f!.defsXml).toContain('0 0 0 0 1 ');
		expect(f!.defsXml).toContain('0 0 0 1 0');
	});

	it('combines multiple effects in declaration order with chained results', () => {
		const f = buildImageEffectsFilter({ grayscale: true, alphaModFix: 80, alphaInv: {} }, '2-3');
		// Each effect produces its own primitive; the filter composes them.
		expect(f!.defsXml).toContain('result="p1"');
		expect(f!.defsXml).toContain('result="pa1"');
		expect(f!.defsXml).toContain('result="pa2"');
		expect(f!.filterId).toBe('imgfx-2-3');
	});

	it('skips opaque-only effects (alphaMod, fillOverlay, clrRepl rawXml only)', () => {
		const f = buildImageEffectsFilter({ alphaMod: { contRawXml: { foo: 'bar' } } }, '0-0');
		expect(f).toBeNull();
	});

	it('blur derives from artisticEffect=blur with EMU radius', () => {
		const f = buildImageEffectsFilter({ artisticEffect: 'blur', artisticRadius: 127000 }, '0-0');
		expect(f!.defsXml).toContain('<feGaussianBlur');
		expect(f!.defsXml).toContain('stdDeviation="10"');
	});
});
