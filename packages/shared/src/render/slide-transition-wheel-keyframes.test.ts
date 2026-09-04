import { describe, expect, it } from 'vitest';

import { WHEEL_MASK_KEYFRAMES, wheelKeyframeName } from './slide-transition-wheel-keyframes';

describe('wheel mask keyframes (G9: p:wheel/@spokes)', () => {
	it('registers the animated custom property driving every sweep', () => {
		expect(WHEEL_MASK_KEYFRAMES).toContain('@property --pptx-tr-wheel-progress');
	});

	it('emits one @keyframes block per PowerPoint-offered spoke count', () => {
		for (const spokes of [1, 2, 3, 4, 8]) {
			expect(WHEEL_MASK_KEYFRAMES).toContain(`@keyframes ${wheelKeyframeName(spokes)}`);
		}
	});

	it('sizes each spoke to 360 / N degrees', () => {
		expect(WHEEL_MASK_KEYFRAMES).toContain('* 360deg)'); // 1 spoke
		expect(WHEEL_MASK_KEYFRAMES).toContain('* 90deg)'); // 4 spokes
		expect(WHEEL_MASK_KEYFRAMES).toContain('* 45deg)'); // 8 spokes
	});
});

describe('wheelKeyframeName', () => {
	it('names the keyframe after the spoke count', () => {
		expect(wheelKeyframeName(4)).toBe('pptx-tr-wheel-in-4');
	});
});
