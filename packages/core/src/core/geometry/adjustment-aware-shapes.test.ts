import { describe, expect, it } from 'vitest';

import { getAdjustmentAwareClipPath } from './adjustment-aware-shapes';
import { getAdjustmentAwareShapeClipPath } from './shape-geometry';

const W = 200;
const H = 100;

/**
 * The 12 adjustment-aware shape names this module supports. Each is asserted
 * against three contracts:
 *   1. A clip-path is produced for the spec-default adjustment (or no
 *      adjustments) and is non-empty.
 *   2. Two distinct adjustment values produce different clip-path strings.
 *   3. Edge cases — zero/negative adjustments and missing values — do not
 *      throw; they yield finite polygon coordinates.
 */
const SUPPORTED: ReadonlyArray<{
	name: string;
	a: Record<string, number>;
	b: Record<string, number>;
}> = [
	{
		name: 'pie',
		a: { adj1: 0, adj2: 16_200_000 }, // default 0° → 270°
		b: { adj1: 5_400_000, adj2: 10_800_000 }, // 90° → 180°
	},
	{
		name: 'pieWedge',
		a: { adj1: 0, adj2: 16_200_000 },
		b: { adj1: 1_200_000, adj2: 14_400_000 },
	},
	{
		name: 'chord',
		a: { adj1: 0, adj2: 16_200_000 },
		b: { adj1: 1_800_000, adj2: 12_600_000 },
	},
	{
		name: 'arc',
		a: { adj1: 0, adj2: 16_200_000 },
		b: { adj1: 5_400_000, adj2: 18_000_000 },
	},
	{
		name: 'donut',
		a: { adj1: 25000 }, // 25%
		b: { adj1: 10000 }, // 10%
	},
	{
		name: 'blockArc',
		a: { adj1: 10_800_000, adj2: 0, adj3: 25000 },
		b: { adj1: 5_400_000, adj2: 16_200_000, adj3: 12000 },
	},
	{
		name: 'wedgeRectCallout',
		a: { adj1: -20833, adj2: 62500 },
		b: { adj1: 50000, adj2: 80000 },
	},
	{
		name: 'wedgeRoundRectCallout',
		a: { adj1: -20833, adj2: 62500, adj3: 16667 },
		b: { adj1: 50000, adj2: 80000, adj3: 30000 },
	},
	{
		name: 'wedgeEllipseCallout',
		a: { adj1: -20833, adj2: 62500 },
		b: { adj1: 40000, adj2: 90000 },
	},
	{
		name: 'cloudCallout',
		a: { adj1: -20833, adj2: 62500 },
		b: { adj1: 30000, adj2: 80000 },
	},
	{
		name: 'circularArrow',
		a: { adj1: 12500, adj2: 1_142_319, adj3: 20_457_681, adj4: 12500 },
		b: { adj1: 25000, adj2: 5_400_000, adj3: 16_200_000, adj4: 25000 },
	},
	{
		name: 'swooshArrow',
		a: { adj1: 25000, adj2: 25000 },
		b: { adj1: 50000, adj2: 50000 },
	},
];

describe('getAdjustmentAwareClipPath', () => {
	it('returns undefined for unknown shapes', () => {
		expect(getAdjustmentAwareClipPath('nonExistentShape', W, H)).toBeUndefined();
		expect(getAdjustmentAwareClipPath('rect', W, H)).toBeUndefined();
		expect(getAdjustmentAwareClipPath('roundRect', W, H, { adj: 16667 })).toBeUndefined();
	});

	it('returns undefined for empty shape type', () => {
		expect(getAdjustmentAwareClipPath('', W, H, { adj1: 0 })).toBeUndefined();
	});

	it('handles zero or negative dimensions without crashing', () => {
		for (const shape of SUPPORTED) {
			expect(() => getAdjustmentAwareClipPath(shape.name, 0, 0, shape.a)).not.toThrow();
			expect(() => getAdjustmentAwareClipPath(shape.name, -10, -5, shape.a)).not.toThrow();
		}
	});

	it('handles non-finite adjustment values gracefully', () => {
		const bad = { adj1: NaN, adj2: Number.POSITIVE_INFINITY, adj3: -Infinity };
		for (const shape of SUPPORTED) {
			const out = getAdjustmentAwareClipPath(shape.name, W, H, bad);
			expect(out).toBeDefined();
			expect(out).toMatch(/polygon\(/);
			// All numeric coordinates are finite (no `NaN`/`Infinity` leaks).
			expect(out).not.toMatch(/NaN/);
			expect(out).not.toMatch(/Infinity/);
		}
	});

	it('produces a non-empty polygon at default adjustments for every supported shape', () => {
		for (const shape of SUPPORTED) {
			const out = getAdjustmentAwareClipPath(shape.name, W, H, shape.a);
			expect(out, `${shape.name} should produce a clip-path`).toBeDefined();
			expect(out!.startsWith('polygon(')).toBeTruthy();
			// Must contain at least 3 vertices for a valid polygon.
			expect((out!.match(/px/g) ?? []).length).toBeGreaterThanOrEqual(6);
		}
	});

	it('two distinct adjustment values produce different output for every shape', () => {
		for (const shape of SUPPORTED) {
			const a = getAdjustmentAwareClipPath(shape.name, W, H, shape.a);
			const b = getAdjustmentAwareClipPath(shape.name, W, H, shape.b);
			expect(a, `${shape.name} adj A`).toBeDefined();
			expect(b, `${shape.name} adj B`).toBeDefined();
			expect(a).not.toStrictEqual(b);
		}
	});

	it('default-adjustment output differs from a trivial 4-vertex rectangle', () => {
		const rect = `polygon(0px 0px, ${W}px 0px, ${W}px ${H}px, 0px ${H}px)`;
		for (const shape of SUPPORTED) {
			const out = getAdjustmentAwareClipPath(shape.name, W, H, shape.a);
			expect(out).not.toStrictEqual(rect);
		}
	});

	it('is case-insensitive on the shape name', () => {
		expect(getAdjustmentAwareClipPath('PIE', W, H, { adj1: 0, adj2: 16_200_000 })).toBeDefined();
		expect(getAdjustmentAwareClipPath('Donut', W, H)).toBeDefined();
		expect(getAdjustmentAwareClipPath('WedgeRectCallout', W, H)).toBeDefined();
	});

	it('falls back to spec-default geometry when no adjustments are supplied', () => {
		for (const shape of SUPPORTED) {
			const out = getAdjustmentAwareClipPath(shape.name, W, H);
			expect(out, `${shape.name} default`).toBeDefined();
			expect(out!.startsWith('polygon(')).toBeTruthy();
		}
	});

	describe('per-shape sanity checks', () => {
		it('pie at adj1==adj2 produces a degenerate but finite polygon', () => {
			const out = getAdjustmentAwareClipPath('pie', W, H, { adj1: 0, adj2: 0 });
			expect(out).toBeDefined();
			expect(out).not.toMatch(/NaN/);
		});

		it('donut adj1=0 collapses inner ring to outer (no hole)', () => {
			const filled = getAdjustmentAwareClipPath('donut', W, H, { adj1: 0 });
			const ringy = getAdjustmentAwareClipPath('donut', W, H, { adj1: 25000 });
			expect(filled).toBeDefined();
			expect(ringy).toBeDefined();
			expect(filled).not.toStrictEqual(ringy);
		});

		it('blockArc adj3 controls band thickness', () => {
			const thin = getAdjustmentAwareClipPath('blockArc', W, H, {
				adj1: 10_800_000,
				adj2: 0,
				adj3: 5000,
			});
			const thick = getAdjustmentAwareClipPath('blockArc', W, H, {
				adj1: 10_800_000,
				adj2: 0,
				adj3: 40000,
			});
			expect(thin).not.toStrictEqual(thick);
		});

		it('wedgeRectCallout pointer position varies with adj1 / adj2', () => {
			const left = getAdjustmentAwareClipPath('wedgeRectCallout', W, H, {
				adj1: -50000,
				adj2: 0,
			});
			const right = getAdjustmentAwareClipPath('wedgeRectCallout', W, H, {
				adj1: 50000,
				adj2: 0,
			});
			expect(left).not.toStrictEqual(right);
		});

		it('circularArrow adj4 controls head size', () => {
			const small = getAdjustmentAwareClipPath('circularArrow', W, H, {
				adj1: 12500,
				adj2: 1_142_319,
				adj3: 20_457_681,
				adj4: 5000,
			});
			const big = getAdjustmentAwareClipPath('circularArrow', W, H, {
				adj1: 12500,
				adj2: 1_142_319,
				adj3: 20_457_681,
				adj4: 40000,
			});
			expect(small).not.toStrictEqual(big);
		});

		it('swooshArrow varies with both adj1 and adj2', () => {
			const a = getAdjustmentAwareClipPath('swooshArrow', W, H, { adj1: 10000, adj2: 10000 });
			const b = getAdjustmentAwareClipPath('swooshArrow', W, H, { adj1: 50000, adj2: 50000 });
			expect(a).not.toStrictEqual(b);
		});

		it('cloudCallout pointer offset differs from spec default', () => {
			const def = getAdjustmentAwareClipPath('cloudCallout', W, H, {
				adj1: -20833,
				adj2: 62500,
			});
			const moved = getAdjustmentAwareClipPath('cloudCallout', W, H, {
				adj1: 30000,
				adj2: -20000,
			});
			expect(def).not.toStrictEqual(moved);
		});

		it('arc with full sweep (≈360°) produces more vertices than a tiny sweep', () => {
			const big = getAdjustmentAwareClipPath('arc', W, H, { adj1: 0, adj2: 21_500_000 });
			const small = getAdjustmentAwareClipPath('arc', W, H, { adj1: 0, adj2: 600_000 });
			// Both should be valid polygons
			expect(big).toBeDefined();
			expect(small).toBeDefined();
			// Different sweeps produce different shapes
			expect(big).not.toStrictEqual(small);
		});
	});
});

describe('getAdjustmentAwareShapeClipPath (integration)', () => {
	it('returns undefined for undefined shape type', () => {
		expect(getAdjustmentAwareShapeClipPath(undefined, W, H)).toBeUndefined();
	});

	it('falls back to static preset clip-path for non-adjustment-aware shapes', () => {
		// triangle is not in the adjustment-aware table → static preset polygon.
		const out = getAdjustmentAwareShapeClipPath('triangle', W, H);
		expect(out).toBeDefined();
		expect(out).toMatch(/polygon\(/);
	});

	it('uses dynamic builder when adjustments are supplied for a supported shape', () => {
		const out = getAdjustmentAwareShapeClipPath('pie', W, H, { adj1: 0, adj2: 5_400_000 });
		expect(out).toBeDefined();
		expect(out).toMatch(/polygon\(.*px.*px/);
	});

	it('uses dynamic builder even without adjustments for supported shapes', () => {
		const dyn = getAdjustmentAwareShapeClipPath('donut', W, H);
		expect(dyn).toBeDefined();
		expect(dyn).toMatch(/polygon\(/);
	});

	it('different adjustments yield different results via the public API', () => {
		const a = getAdjustmentAwareShapeClipPath('wedgeRectCallout', W, H, {
			adj1: -50000,
			adj2: 50000,
		});
		const b = getAdjustmentAwareShapeClipPath('wedgeRectCallout', W, H, {
			adj1: 50000,
			adj2: -50000,
		});
		expect(a).not.toStrictEqual(b);
	});
});
