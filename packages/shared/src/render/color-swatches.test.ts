import { describe, expect, it } from 'vitest';

import { OFFICE_COLOR_SWATCH_HEXES, OFFICE_COLOR_SWATCHES } from './color-swatches';

const HEX_RE = /^#[0-9a-f]{6}$/u;

describe('office color swatch catalogue', () => {
	it('has exactly 10 swatches, matching the "Standard Colors" row PowerPoint ships', () => {
		expect(OFFICE_COLOR_SWATCHES).toHaveLength(10);
	});

	it('gives every swatch a lower-case #rrggbb hex value', () => {
		for (const swatch of OFFICE_COLOR_SWATCHES) {
			expect(swatch.hex).toMatch(HEX_RE);
		}
	});

	it('gives every swatch a non-empty label', () => {
		for (const swatch of OFFICE_COLOR_SWATCHES) {
			expect(swatch.label.length).toBeGreaterThan(0);
		}
	});

	it('has no duplicate hex values', () => {
		const hexes = OFFICE_COLOR_SWATCHES.map((swatch) => swatch.hex);
		expect(new Set(hexes).size).toBe(hexes.length);
	});

	it('has no duplicate labels', () => {
		const labels = OFFICE_COLOR_SWATCHES.map((swatch) => swatch.label);
		expect(new Set(labels).size).toBe(labels.length);
	});

	it('matches the exact catalogue previously hardcoded by the vanilla and Svelte bindings', () => {
		expect(OFFICE_COLOR_SWATCHES.map((swatch) => swatch.hex)).toStrictEqual([
			'#000000',
			'#ffffff',
			'#ff0000',
			'#00aa00',
			'#0000ff',
			'#ff8800',
			'#8800cc',
			'#00cccc',
			'#ff69b4',
			'#808080',
		]);
	});
});

describe('office color swatch hex projection', () => {
	it('is a flat, same-order projection of OFFICE_COLOR_SWATCHES.hex', () => {
		expect(OFFICE_COLOR_SWATCH_HEXES).toStrictEqual(OFFICE_COLOR_SWATCHES.map((s) => s.hex));
	});

	it('has 10 entries, all valid #rrggbb hex strings', () => {
		expect(OFFICE_COLOR_SWATCH_HEXES).toHaveLength(10);
		for (const hex of OFFICE_COLOR_SWATCH_HEXES) {
			expect(hex).toMatch(HEX_RE);
		}
	});
});
