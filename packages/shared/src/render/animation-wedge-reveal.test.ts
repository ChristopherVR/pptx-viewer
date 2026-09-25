import { describe, expect, it } from 'vitest';

import { irisDecl, irisRadiusAt } from './animation-circle-iris';
import { getInitialStyleForEffect } from './animation-effects';
import { resolveFilterEffect } from './animation-filter-effects';
import { getEffectKeyframes } from './animation-keyframes';
import { resolveEffect } from './animation-timeline-helpers';
import { WEDGE_STEPS, wedgeDecl, wedgeEdgeAngle } from './animation-wedge-reveal';

/** Pull the `deg` stop list out of a wedge conic mask. */
function conicStops(decl: string): number[] {
	return [...decl.matchAll(/([\d.]+)deg/g)].slice(1).map((m) => Number(m[1]));
}

describe('animation-wedge-reveal', () => {
	it('advances the half-alpha edge linearly from 12 to 6 o’clock (CreateVideo fit)', () => {
		// Measured on PowerPoint's Wedge: a50 ~= 96deg at 51.8% progress and
		// ~= 172deg at 90%; both within one 4-degree histogram bin.
		expect(wedgeEdgeAngle(0.518)).toBeGreaterThan(92);
		expect(wedgeEdgeAngle(0.518)).toBeLessThan(100);
		expect(wedgeEdgeAngle(0.902)).toBeGreaterThan(168);
		expect(wedgeEdgeAngle(0.5)).toBeCloseTo(90, 5);
	});

	it('opens symmetric wedges on entrance and hides the same wedges on exit', () => {
		const entrance = wedgeDecl(0.5, false);
		expect(entrance).toMatch(/conic-gradient\(from 0deg at 50% 50%, #000 0deg/);
		const [, inner, outer, farOuter, farInner] = conicStops(entrance);
		expect(inner + outer).toBeCloseTo(180, 1);
		expect(farOuter).toBeCloseTo(360 - outer, 5);
		expect(farInner).toBeCloseTo(360 - inner, 5);
		expect(wedgeDecl(0.5, true)).toMatch(/at 50% 50%, transparent 0deg/);
	});

	it('is fully hidden at 0 and fully shown at 1', () => {
		expect(conicStops(wedgeDecl(0, false)).slice(0, 3)).toStrictEqual([0, 0, 0]);
		expect(conicStops(wedgeDecl(1, false)).slice(0, 3)).toStrictEqual([0, 180, 180]);
	});

	it('steps the keyframes and routes presetID 20 and the wedge filter to them', () => {
		const css = getEffectKeyframes('wedgeIn');
		expect(css.match(/% \{/g)).toHaveLength(WEDGE_STEPS + 1);
		expect(getEffectKeyframes('wedgeOut')).toContain('@keyframes pptx-wedgeOut');
		expect(resolveEffect({ presetClass: 'exit', presetId: 20 })).toBe('wedgeOut');
		const filter = { family: 'wedge', raw: 'wedge' };
		expect(resolveFilterEffect({ presetClass: 'exit', effectFilter: filter })).toBe('wedgeOut');
		expect(String(getInitialStyleForEffect('wedgeIn').maskImage)).toContain('conic-gradient');
	});
});

describe('animation-circle-iris', () => {
	it('shrinks the half-alpha radius linearly to the centre (CreateVideo fit)', () => {
		// Measured: r50 = 70px of a 141px half-diagonal at 50%, 30px at 75%.
		expect(irisRadiusAt(0.5) * 141.4).toBeCloseTo(70.7, 0);
		expect(irisRadiusAt(0.75) * 141.4).toBeGreaterThan(28);
		expect(irisRadiusAt(0.75) * 141.4).toBeLessThan(33);
		expect(irisDecl(0)).toContain('#000 141.42%');
		expect(irisDecl(1)).toContain('transparent 0.00%');
	});

	it('plays for exit.6 and the circle filter exit', () => {
		expect(resolveEffect({ presetClass: 'exit', presetId: 6 })).toBe('circleOut');
		const filter = { family: 'circle', subtype: 'in', raw: 'circle(in)' };
		expect(resolveFilterEffect({ presetClass: 'exit', effectFilter: filter })).toBe('circleOut');
		expect(getEffectKeyframes('circleOut')).toContain('radial-gradient(closest-side');
	});
});
