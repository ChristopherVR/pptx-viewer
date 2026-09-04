import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	buildAbsoluteRotationKeyframe,
	buildAbsoluteScaleKeyframe,
	buildColorTavKeyframe,
	buildOpacityTavKeyframe,
} from './animation-timeline-absolute';

describe('buildAbsoluteRotationKeyframe', () => {
	it('builds a from/to rotation sweep for p:animRot absolute angles', () => {
		const result = buildAbsoluteRotationKeyframe(
			{ rotationFrom: 0, rotationTo: 180 },
			'pptx-rot',
			1,
		);
		expect(result?.keyframeName).toBe('pptx-rot-1');
		expect(result?.css).toContain('from { transform: rotate(0deg); }');
		expect(result?.css).toContain('to { transform: rotate(180deg); }');
	});

	it('defaults a missing "to" to "from" (no-op turn, not dropped)', () => {
		const result = buildAbsoluteRotationKeyframe({ rotationFrom: 45 }, 'pptx-rot', 2);
		expect(result?.css).toContain('from { transform: rotate(45deg); }');
		expect(result?.css).toContain('to { transform: rotate(45deg); }');
	});

	it('defaults a missing "from" to "to"', () => {
		const result = buildAbsoluteRotationKeyframe({ rotationTo: 270 }, 'pptx-rot', 3);
		expect(result?.css).toContain('from { transform: rotate(270deg); }');
		expect(result?.css).toContain('to { transform: rotate(270deg); }');
	});

	it('returns undefined when a relative rotationBy is present (caller handles that first)', () => {
		const result = buildAbsoluteRotationKeyframe(
			{ rotationBy: 90, rotationFrom: 0, rotationTo: 180 },
			'pptx-rot',
			4,
		);
		expect(result).toBeUndefined();
	});

	it('returns undefined when neither absolute nor relative rotation is present', () => {
		expect(buildAbsoluteRotationKeyframe({}, 'pptx-rot', 5)).toBeUndefined();
	});
});

describe('buildAbsoluteScaleKeyframe', () => {
	it('builds a from/to scale for p:animScale absolute percentages', () => {
		const result = buildAbsoluteScaleKeyframe(
			{ scaleFromX: 0.5, scaleFromY: 0.5, scaleToX: 1.5, scaleToY: 1.5 },
			'pptx-scale',
			1,
		);
		expect(result?.keyframeName).toBe('pptx-scale-1');
		expect(result?.css).toContain('from { transform: scale(0.5, 0.5); }');
		expect(result?.css).toContain('to { transform: scale(1.5, 1.5); }');
	});

	it('defaults a missing "from" to 1 (unscaled) and a missing "to" to "from"', () => {
		const result = buildAbsoluteScaleKeyframe({ scaleToX: 2 }, 'pptx-scale', 2);
		expect(result?.css).toContain('from { transform: scale(1, 1); }');
		expect(result?.css).toContain('to { transform: scale(2, 1); }');
	});

	it('returns undefined when a relative scaleBy is present', () => {
		const result = buildAbsoluteScaleKeyframe(
			{ scaleByX: 2, scaleFromX: 0.5, scaleToX: 1.5 },
			'pptx-scale',
			3,
		);
		expect(result).toBeUndefined();
	});

	it('returns undefined when no scale fields are present', () => {
		expect(buildAbsoluteScaleKeyframe({}, 'pptx-scale', 4)).toBeUndefined();
	});
});

describe('buildOpacityTavKeyframe', () => {
	const emph: Pick<PptxNativeAnimation, 'presetClass'> = { presetClass: 'emph' };

	it('interpolates through the FULL authored p:tavLst rather than a 2-point default', () => {
		const anim = {
			...emph,
			keyframes: [
				{ tm: 0, value: 1, valueType: 'flt' as const },
				{ tm: 25000, value: 0.2, valueType: 'flt' as const },
				{ tm: 60000, value: 0.8, valueType: 'flt' as const },
				{ tm: 100000, value: 1, valueType: 'flt' as const },
			],
		};
		const result = buildOpacityTavKeyframe(anim, 'pptx-tl-tav', 7);
		expect(result?.keyframeName).toBe('pptx-tl-tav-7');
		expect(result?.css).toContain('0% { opacity: 1; }');
		expect(result?.css).toContain('25% { opacity: 0.2; }');
		expect(result?.css).toContain('60% { opacity: 0.8; }');
		expect(result?.css).toContain('100% { opacity: 1; }');
	});

	it('sorts out-of-order tm entries by time', () => {
		const anim = {
			...emph,
			keyframes: [
				{ tm: 100000, value: 1, valueType: 'int' as const },
				{ tm: 0, value: 0, valueType: 'int' as const },
			],
		};
		const result = buildOpacityTavKeyframe(anim, 'pptx-tl-tav', 8);
		const lines = result!.css.split('\n');
		expect(lines[1]).toContain('0%');
		expect(lines[2]).toContain('100%');
	});

	it('returns undefined for a non-emphasis effect (e.g. entrance)', () => {
		const anim = {
			presetClass: 'entr' as const,
			keyframes: [
				{ tm: 0, value: 0, valueType: 'flt' as const },
				{ tm: 100000, value: 1, valueType: 'flt' as const },
			],
		};
		expect(buildOpacityTavKeyframe(anim, 'pptx-tl-tav', 9)).toBeUndefined();
	});

	it('calcMode "discrete" snaps to each stop instead of interpolating (G5)', () => {
		const anim = {
			...emph,
			calcMode: 'discrete' as const,
			keyframes: [
				{ tm: 0, value: 1, valueType: 'flt' as const },
				{ tm: 50000, value: 0, valueType: 'flt' as const },
			],
		};
		const result = buildOpacityTavKeyframe(anim, 'pptx-tl-tav', 20);
		// A hold-then-snap sequence: value 1 holds right up to (but not through)
		// 50%, then instantly becomes 0 exactly at 50%, rather than a straight
		// linear tween from 1 to 0 across that span.
		expect(result?.css).toContain('0% { opacity: 1; }');
		expect(result?.css).toContain('49.99% { opacity: 1; }');
		expect(result?.css).toContain('50% { opacity: 0; }');
	});

	it('returns undefined with fewer than two keyframes', () => {
		const anim = { ...emph, keyframes: [{ tm: 0, value: 1, valueType: 'flt' as const }] };
		expect(buildOpacityTavKeyframe(anim, 'pptx-tl-tav', 10)).toBeUndefined();
	});

	it('returns undefined when a value falls outside the [0, 1] opacity range', () => {
		const anim = {
			...emph,
			keyframes: [
				{ tm: 0, value: 0, valueType: 'flt' as const },
				{ tm: 100000, value: 42, valueType: 'flt' as const },
			],
		};
		expect(buildOpacityTavKeyframe(anim, 'pptx-tl-tav', 11)).toBeUndefined();
	});

	it('returns undefined for a non-numeric (e.g. color) keyframe value', () => {
		const anim = {
			...emph,
			keyframes: [
				{ tm: 0, value: '#ffffff', valueType: 'clr' as const },
				{ tm: 100000, value: '#000000', valueType: 'clr' as const },
			],
		};
		expect(buildOpacityTavKeyframe(anim, 'pptx-tl-tav', 12)).toBeUndefined();
	});

	it('returns undefined with no keyframes at all', () => {
		expect(buildOpacityTavKeyframe(emph, 'pptx-tl-tav', 13)).toBeUndefined();
	});

	// -----------------------------------------------------------------------
	// attrName gate: when the parser surfaced p:attrNameLst/p:attrName, trust
	// it over the value-shape heuristic.
	// -----------------------------------------------------------------------

	it('honours a numeric [0, 1] ramp explicitly named style.opacity', () => {
		const anim = {
			...emph,
			attrName: 'style.opacity',
			keyframes: [
				{ tm: 0, value: 1, valueType: 'flt' as const },
				{ tm: 100000, value: 0, valueType: 'flt' as const },
			],
		};
		const result = buildOpacityTavKeyframe(anim, 'pptx-tl-tav', 14);
		expect(result?.css).toContain('0% { opacity: 1; }');
		expect(result?.css).toContain('100% { opacity: 0; }');
	});

	it('rejects a numeric [0, 1] ramp named for a DIFFERENT attribute, even though the old heuristic would have matched it', () => {
		const anim = {
			...emph,
			attrName: 'ppt_w',
			keyframes: [
				{ tm: 0, value: 0.5, valueType: 'flt' as const },
				{ tm: 100000, value: 1, valueType: 'flt' as const },
			],
		};
		expect(buildOpacityTavKeyframe(anim, 'pptx-tl-tav', 15)).toBeUndefined();
	});

	it('still falls back to the value-shape heuristic when attrName is absent', () => {
		const anim = {
			...emph,
			keyframes: [
				{ tm: 0, value: 0, valueType: 'flt' as const },
				{ tm: 100000, value: 1, valueType: 'flt' as const },
			],
		};
		expect(buildOpacityTavKeyframe(anim, 'pptx-tl-tav', 16)).toBeDefined();
	});
});

describe('buildColorTavKeyframe', () => {
	it('builds a multi-stop fillcolor keyframes block', () => {
		const anim = {
			attrName: 'fillcolor',
			keyframes: [
				{ tm: 0, value: '#ff0000', valueType: 'clr' as const },
				{ tm: 50000, value: '#00ff00', valueType: 'clr' as const },
				{ tm: 100000, value: '#0000ff', valueType: 'clr' as const },
			],
		};
		const result = buildColorTavKeyframe(anim, 'pptx-tl-tavclr', 1);
		expect(result?.keyframeName).toBe('pptx-tl-tavclr-1');
		expect(result?.css).toContain('0% { fill: #ff0000;');
		expect(result?.css).toContain('50% { fill: #00ff00;');
		expect(result?.css).toContain('100% { fill: #0000ff;');
	});

	it('calcMode "discrete" holds each colour stop instead of tweening (G5)', () => {
		const anim = {
			attrName: 'fillcolor',
			calcMode: 'discrete' as const,
			keyframes: [
				{ tm: 0, value: '#ff0000', valueType: 'clr' as const },
				{ tm: 50000, value: '#0000ff', valueType: 'clr' as const },
			],
		};
		const result = buildColorTavKeyframe(anim, 'pptx-tl-tavclr', 9);
		expect(result?.css).toContain('49.99% { fill: #ff0000;');
		expect(result?.css).toContain('50% { fill: #0000ff;');
	});

	it('maps stroke.color to the stroke/border-color properties', () => {
		const anim = {
			attrName: 'stroke.color',
			keyframes: [
				{ tm: 0, value: '#ffffff', valueType: 'clr' as const },
				{ tm: 100000, value: '#000000', valueType: 'clr' as const },
			],
		};
		const result = buildColorTavKeyframe(anim, 'pptx-tl-tavclr', 2);
		expect(result?.css).toContain('stroke: #000000;');
		expect(result?.css).toContain('border-color: #000000;');
	});

	it('sorts out-of-order tm entries by time', () => {
		const anim = {
			attrName: 'fillcolor',
			keyframes: [
				{ tm: 100000, value: '#000000', valueType: 'clr' as const },
				{ tm: 0, value: '#ffffff', valueType: 'clr' as const },
			],
		};
		const result = buildColorTavKeyframe(anim, 'pptx-tl-tavclr', 3);
		const lines = result!.css.split('\n');
		expect(lines[1]).toContain('0%');
		expect(lines[2]).toContain('100%');
	});

	it('returns undefined for an unrecognised attribute name', () => {
		const anim = {
			attrName: 'ppt_x',
			keyframes: [
				{ tm: 0, value: '#ffffff', valueType: 'clr' as const },
				{ tm: 100000, value: '#000000', valueType: 'clr' as const },
			],
		};
		expect(buildColorTavKeyframe(anim, 'pptx-tl-tavclr', 4)).toBeUndefined();
	});

	it('returns undefined with no attrName at all', () => {
		const anim = {
			keyframes: [
				{ tm: 0, value: '#ffffff', valueType: 'clr' as const },
				{ tm: 100000, value: '#000000', valueType: 'clr' as const },
			],
		};
		expect(buildColorTavKeyframe(anim, 'pptx-tl-tavclr', 5)).toBeUndefined();
	});

	it('returns undefined for a scheme-colour token that cannot resolve to a CSS colour', () => {
		const anim = {
			attrName: 'fillcolor',
			keyframes: [
				{ tm: 0, value: 'accent1', valueType: 'clr' as const },
				{ tm: 100000, value: 'accent2', valueType: 'clr' as const },
			],
		};
		expect(buildColorTavKeyframe(anim, 'pptx-tl-tavclr', 6)).toBeUndefined();
	});

	it('returns undefined for a non-colour keyframe value', () => {
		const anim = {
			attrName: 'fillcolor',
			keyframes: [
				{ tm: 0, value: 0, valueType: 'flt' as const },
				{ tm: 100000, value: 1, valueType: 'flt' as const },
			],
		};
		expect(buildColorTavKeyframe(anim, 'pptx-tl-tavclr', 7)).toBeUndefined();
	});

	it('returns undefined with fewer than two keyframes', () => {
		const anim = {
			attrName: 'fillcolor',
			keyframes: [{ tm: 0, value: '#ffffff', valueType: 'clr' as const }],
		};
		expect(buildColorTavKeyframe(anim, 'pptx-tl-tavclr', 8)).toBeUndefined();
	});

	it('defers to a real p:animClr colorAnimation when both are present', () => {
		const anim = {
			attrName: 'fillcolor',
			colorAnimation: { colorSpace: 'rgb' as const, toColor: '#ff0000' },
			keyframes: [
				{ tm: 0, value: '#ffffff', valueType: 'clr' as const },
				{ tm: 100000, value: '#000000', valueType: 'clr' as const },
			],
		};
		expect(buildColorTavKeyframe(anim, 'pptx-tl-tavclr', 9)).toBeUndefined();
	});
});
