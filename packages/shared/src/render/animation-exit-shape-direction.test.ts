import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getEffectKeyframes } from './animation-keyframes';
import { resolveEffect } from './animation-timeline-helpers';

const exit = (
	presetId: number,
	family: string,
	subtype: string | undefined,
): PptxNativeAnimation => ({
	presetClass: 'exit',
	presetId,
	presetSubtype: subtype === 'out' ? 32 : 16,
	effectFilter: subtype
		? { family, subtype, transition: 'out', raw: `${family}(${subtype})` }
		: undefined,
});

describe('shape reveal exits with Effect Options "Out"', () => {
	it('open a hole at the centre for box(out), circle(out), diamond(out), plus(out)', () => {
		expect(resolveEffect(exit(4, 'box', 'out'))).toBe('boxOutFromCenter');
		expect(resolveEffect(exit(6, 'circle', 'out'))).toBe('circleOutFromCenter');
		expect(resolveEffect(exit(8, 'diamond', 'out'))).toBe('diamondOutFromCenter');
		expect(resolveEffect(exit(13, 'plus', 'out'))).toBe('plusOutFromCenter');
	});

	it('keep the close-in exit for the "In" direction', () => {
		expect(resolveEffect(exit(4, 'box', 'in'))).toBe('boxOut');
		expect(resolveEffect(exit(6, 'circle', 'in'))).toBe('circleOut');
		expect(resolveEffect(exit(8, 'diamond', 'in'))).toBe('diamondOut');
		expect(resolveEffect(exit(13, 'plus', 'in'))).toBe('plusOut');
	});

	it('fall back to presetSubtype 32 when there is no filter to read', () => {
		expect(resolveEffect({ presetClass: 'exit', presetId: 4, presetSubtype: 32 })).toBe(
			'boxOutFromCenter',
		);
		expect(resolveEffect({ presetClass: 'exit', presetId: 4, presetSubtype: 16 })).toBe('boxOut');
	});

	it('play a hole growing from nothing to the full element (entrance "In" reversed)', () => {
		const css = getEffectKeyframes('boxOutFromCenter');
		expect(css).toContain('@keyframes pptx-boxOutFromCenter');
		expect(css).toContain('mask-size: 0% 0%, 100% 100%');
		expect(css.indexOf('0% 0%')).toBeLessThan(css.indexOf('mask-size: 100% 100%, 100% 100%'));
		for (const name of [
			'circleOutFromCenter',
			'diamondOutFromCenter',
			'plusOutFromCenter',
		] as const) {
			expect(getEffectKeyframes(name)).toContain(`@keyframes pptx-${name}`);
		}
	});
});
