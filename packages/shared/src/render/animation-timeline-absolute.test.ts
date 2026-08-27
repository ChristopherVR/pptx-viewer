import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	buildAbsoluteRotationKeyframe,
	buildAbsoluteScaleKeyframe,
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
});
