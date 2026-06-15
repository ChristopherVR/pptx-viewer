/**
 * effects-helpers.test.ts — Unit tests for effects-helpers.ts.
 *
 * All tests are pure (no TestBed / DOM). They exercise the reader and
 * patch-builder functions directly.
 */

import { describe, expect, it } from 'vitest';

import {
	disableGlowPatch,
	disableInnerShadowPatch,
	disableOuterShadowPatch,
	disableReflectionPatch,
	disableSoftEdgePatch,
	effectsStateOf,
	enableGlowPatch,
	enableInnerShadowPatch,
	enableOuterShadowPatch,
	enableReflectionPatch,
	enableSoftEdgePatch,
	updateGlowPatch,
	updateInnerShadowPatch,
	updateOuterShadowPatch,
	updateReflectionPatch,
} from './effects-helpers';
import type {
	GlowState,
	InnerShadowState,
	OuterShadowState,
	ReflectionState,
} from './effects-helpers';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeShape(shapeStyle: Record<string, unknown> = {}): Record<string, unknown> {
	return { id: 'el-1', type: 'shape', x: 0, y: 0, width: 100, height: 100, shapeStyle };
}

function makeText(): Record<string, unknown> {
	return { id: 'el-2', type: 'text', x: 0, y: 0, width: 100, height: 100 };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asEl = (x: unknown): any => x;

function getShapeStyle(patch: Partial<unknown>): Record<string, unknown> {
	return (patch as Record<string, unknown>)['shapeStyle'] as Record<string, unknown>;
}

// ── effectsStateOf ────────────────────────────────────────────────────────────

describe('effectsStateOf', () => {
	it('returns all-disabled defaults for a text element', () => {
		const state = effectsStateOf(asEl(makeText()));
		expect(state.outerShadow.enabled).toBeFalsy();
		expect(state.innerShadow.enabled).toBeFalsy();
		expect(state.glow.enabled).toBeFalsy();
		expect(state.reflection.enabled).toBeFalsy();
		expect(state.softEdge.enabled).toBeFalsy();
	});

	it('returns enabled outer shadow when shadowColor is set', () => {
		const el = makeShape({ shadowColor: '#ff0000', shadowOpacity: 0.5, shadowBlur: 8 });
		const state = effectsStateOf(asEl(el));
		expect(state.outerShadow.enabled).toBeTruthy();
		expect(state.outerShadow.color).toBe('#ff0000');
		expect(state.outerShadow.opacity).toBeCloseTo(0.5);
		expect(state.outerShadow.blur).toBe(8);
	});

	it('returns disabled outer shadow when shadowColor is transparent', () => {
		const el = makeShape({ shadowColor: 'transparent' });
		const state = effectsStateOf(asEl(el));
		expect(state.outerShadow.enabled).toBeFalsy();
	});

	it('returns enabled glow when glowColor is set', () => {
		const el = makeShape({ glowColor: '#00ff00', glowRadius: 10 });
		const state = effectsStateOf(asEl(el));
		expect(state.glow.enabled).toBeTruthy();
		expect(state.glow.color).toBe('#00ff00');
		expect(state.glow.radius).toBe(10);
	});

	it('returns enabled reflection when reflectionStartOpacity > 0', () => {
		const el = makeShape({ reflectionStartOpacity: 50, reflectionBlurRadius: 3 });
		const state = effectsStateOf(asEl(el));
		expect(state.reflection.enabled).toBeTruthy();
	});

	it('returns enabled soft edge when softEdgeRadius > 0', () => {
		const el = makeShape({ softEdgeRadius: 6 });
		const state = effectsStateOf(asEl(el));
		expect(state.softEdge.enabled).toBeTruthy();
		expect(state.softEdge.radius).toBe(6);
	});
});

// ── Outer shadow patches ──────────────────────────────────────────────────────

describe('enableOuterShadowPatch', () => {
	it('sets shadowColor and derives offsetX/Y from angle+distance', () => {
		const el = makeShape();
		const state: OuterShadowState = {
			enabled: true,
			color: '#333333',
			opacity: 0.4,
			blur: 8,
			angle: 0,
			distance: 10,
		};
		const patch = enableOuterShadowPatch(asEl(el), state);
		const ss = getShapeStyle(patch);
		expect(ss['shadowColor']).toBe('#333333');
		expect(ss['shadowOffsetX']).toBeCloseTo(10);
		expect(ss['shadowOffsetY']).toBeCloseTo(0);
	});
});

describe('disableOuterShadowPatch', () => {
	it('sets shadowColor to transparent', () => {
		const el = makeShape({ shadowColor: '#000000' });
		const ss = getShapeStyle(disableOuterShadowPatch(asEl(el)));
		expect(ss['shadowColor']).toBe('transparent');
	});

	it('preserves other shapeStyle fields', () => {
		const el = makeShape({ shadowColor: '#000000', strokeColor: '#aabbcc' });
		const ss = getShapeStyle(disableOuterShadowPatch(asEl(el)));
		expect(ss['strokeColor']).toBe('#aabbcc');
	});
});

describe('updateOuterShadowPatch', () => {
	it('updates the blur field', () => {
		const el = makeShape({ shadowColor: '#000000', shadowBlur: 6 });
		const ss = getShapeStyle(updateOuterShadowPatch(asEl(el), { blur: 12 }));
		expect(ss['shadowBlur']).toBe(12);
	});

	it('clamps opacity to 0-1', () => {
		const el = makeShape({ shadowColor: '#000000' });
		const ss = getShapeStyle(updateOuterShadowPatch(asEl(el), { opacity: 2.5 }));
		expect(ss['shadowOpacity']).toBe(1);
	});
});

// ── Inner shadow patches ──────────────────────────────────────────────────────

describe('enableInnerShadowPatch', () => {
	it('sets innerShadowColor', () => {
		const el = makeShape();
		const state: InnerShadowState = {
			enabled: true,
			color: '#0000ff',
			opacity: 0.6,
			blur: 4,
			offsetX: 2,
			offsetY: 3,
		};
		const ss = getShapeStyle(enableInnerShadowPatch(asEl(el), state));
		expect(ss['innerShadowColor']).toBe('#0000ff');
		expect(ss['innerShadowOffsetX']).toBe(2);
		expect(ss['innerShadowOffsetY']).toBe(3);
	});
});

describe('disableInnerShadowPatch', () => {
	it('sets innerShadowColor to transparent', () => {
		const el = makeShape({ innerShadowColor: '#000000' });
		const ss = getShapeStyle(disableInnerShadowPatch(asEl(el)));
		expect(ss['innerShadowColor']).toBe('transparent');
	});
});

describe('updateInnerShadowPatch', () => {
	it('updates blur and clamps opacity', () => {
		const el = makeShape({ innerShadowColor: '#000000' });
		const ss = getShapeStyle(updateInnerShadowPatch(asEl(el), { blur: 10, opacity: -0.5 }));
		expect(ss['innerShadowBlur']).toBe(10);
		expect(ss['innerShadowOpacity']).toBe(0);
	});
});

// ── Glow patches ──────────────────────────────────────────────────────────────

describe('enableGlowPatch', () => {
	it('sets glowColor and radius', () => {
		const el = makeShape();
		const state: GlowState = { enabled: true, color: '#ff8800', radius: 12, opacity: 0.8 };
		const ss = getShapeStyle(enableGlowPatch(asEl(el), state));
		expect(ss['glowColor']).toBe('#ff8800');
		expect(ss['glowRadius']).toBe(12);
	});
});

describe('disableGlowPatch', () => {
	it('sets glowColor to transparent and radius to 0', () => {
		const el = makeShape({ glowColor: '#ff0000', glowRadius: 10 });
		const ss = getShapeStyle(disableGlowPatch(asEl(el)));
		expect(ss['glowColor']).toBe('transparent');
		expect(ss['glowRadius']).toBe(0);
	});
});

describe('updateGlowPatch', () => {
	it('merges changes onto existing glow state', () => {
		const el = makeShape({ glowColor: '#ff0000', glowRadius: 6, glowOpacity: 0.5 });
		const ss = getShapeStyle(updateGlowPatch(asEl(el), { radius: 20 }));
		expect(ss['glowRadius']).toBe(20);
		expect(ss['glowColor']).toBe('#ff0000');
	});
});

// ── Reflection patches ────────────────────────────────────────────────────────

describe('enableReflectionPatch', () => {
	it('sets reflection fields', () => {
		const el = makeShape();
		const state: ReflectionState = {
			enabled: true,
			blurRadius: 3,
			startOpacity: 50,
			endOpacity: 0,
			distance: 5,
			direction: 90,
		};
		const ss = getShapeStyle(enableReflectionPatch(asEl(el), state));
		expect(ss['reflectionBlurRadius']).toBe(3);
		expect(ss['reflectionStartOpacity']).toBe(50);
		expect(ss['reflectionDistance']).toBe(5);
	});
});

describe('disableReflectionPatch', () => {
	it('zeroes out reflection fields', () => {
		const el = makeShape({ reflectionBlurRadius: 3, reflectionStartOpacity: 50 });
		const ss = getShapeStyle(disableReflectionPatch(asEl(el)));
		expect(ss['reflectionBlurRadius']).toBe(0);
		expect(ss['reflectionStartOpacity']).toBe(0);
	});
});

describe('updateReflectionPatch', () => {
	it('updates specific reflection field', () => {
		const el = makeShape({ reflectionBlurRadius: 3, reflectionStartOpacity: 50 });
		const ss = getShapeStyle(updateReflectionPatch(asEl(el), { blurRadius: 8 }));
		expect(ss['reflectionBlurRadius']).toBe(8);
		expect(ss['reflectionStartOpacity']).toBe(50);
	});
});

// ── Soft edge patches ─────────────────────────────────────────────────────────

describe('enableSoftEdgePatch', () => {
	it('sets softEdgeRadius to the given value', () => {
		const el = makeShape();
		const ss = getShapeStyle(enableSoftEdgePatch(asEl(el), 8));
		expect(ss['softEdgeRadius']).toBe(8);
	});

	it('clamps negative values to 0', () => {
		const el = makeShape();
		const ss = getShapeStyle(enableSoftEdgePatch(asEl(el), -5));
		expect(ss['softEdgeRadius']).toBe(0);
	});
});

describe('disableSoftEdgePatch', () => {
	it('sets softEdgeRadius to 0', () => {
		const el = makeShape({ softEdgeRadius: 10 });
		const ss = getShapeStyle(disableSoftEdgePatch(asEl(el)));
		expect(ss['softEdgeRadius']).toBe(0);
	});
});
