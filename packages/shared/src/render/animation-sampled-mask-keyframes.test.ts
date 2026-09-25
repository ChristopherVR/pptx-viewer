import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getEffectKeyframes } from './animation-keyframes';
import { MASK_SAMPLE_STEPS, sampledMaskKeyframes } from './animation-sampled-mask-keyframes';
import { resolveEffect } from './animation-timeline-helpers';

describe('sampledMaskKeyframes', () => {
	it('emits a stop every 1/steps of the effect with the declaration for that fraction', () => {
		const css = sampledMaskKeyframes('pptx-test', (f) => `--f: ${f};`, 4);
		expect(css.split('\n').filter((line) => line.includes('%'))).toStrictEqual([
			'\t0% { --f: 0; opacity: 1; }',
			'\t25% { --f: 0.25; opacity: 1; }',
			'\t50% { --f: 0.5; opacity: 1; }',
			'\t75% { --f: 0.75; opacity: 1; }',
			'\t100% { --f: 1; opacity: 1; }',
		]);
	});

	it('sweeps Blinds open over the effect instead of swapping at the midpoint', () => {
		const css = getEffectKeyframes('blindsInHorizontal')!;
		// A gradient mask cannot interpolate, so the reveal must be sampled.
		expect(css.split('\n').filter((line) => line.includes('%'))).toHaveLength(
			MASK_SAMPLE_STEPS + 1,
		);
		expect(css).toContain('25% { mask-image: linear-gradient(to bottom, #000 25.000%');
	});
});

describe('shape reveals with Effect Options "Out"', () => {
	const anim = (presetId: number, family: string, subtype: string): PptxNativeAnimation => ({
		presetClass: 'entr',
		presetId,
		presetSubtype: 32,
		effectFilter: { family, subtype, transition: 'in', raw: `${family}(${subtype})` },
	});

	it('grow from the centre on entrance (box(out), circle(out)...)', () => {
		expect(resolveEffect(anim(4, 'box', 'out'))).toBe('boxInFromCenter');
		expect(resolveEffect(anim(6, 'circle', 'out'))).toBe('circleInFromCenter');
		expect(resolveEffect(anim(8, 'diamond', 'out'))).toBe('diamondInFromCenter');
		expect(resolveEffect(anim(13, 'plus', 'out'))).toBe('plusInFromCenter');
		expect(resolveEffect(anim(4, 'box', 'in'))).toBe('boxIn');
		expect(getEffectKeyframes('boxInFromCenter')).toContain('@keyframes pptx-boxInFromCenter');
	});
});
