import { describe, expect, it } from 'vitest';

import {
	AUTO_HIDE_DELAY_MS,
	formatSlideCounter,
	HIGHLIGHTER_COLORS,
	isInBottomTriggerZone,
	PEN_COLORS,
	shouldAutoHide,
} from './presentation-toolbar-utils';

describe('isInBottomTriggerZone', () => {
	it('is true within the bottom 15% of the container', () => {
		// container height 1000, top 0 → trigger zone is y in [850, 1000].
		expect(isInBottomTriggerZone(900, 1000, 0)).toBeTruthy();
		expect(isInBottomTriggerZone(1000, 1000, 0)).toBeTruthy();
		expect(isInBottomTriggerZone(850, 1000, 0)).toBeTruthy();
	});

	it('is false above the trigger zone or below the container', () => {
		expect(isInBottomTriggerZone(800, 1000, 0)).toBeFalsy();
		expect(isInBottomTriggerZone(1100, 1000, 0)).toBeFalsy();
	});

	it('accounts for the container top offset', () => {
		// top 100, height 1000 → zone is relativeY in [850, 1000] → clientY in [950, 1100].
		expect(isInBottomTriggerZone(960, 1000, 100)).toBeTruthy();
		expect(isInBottomTriggerZone(900, 1000, 100)).toBeFalsy();
	});
});

describe('shouldAutoHide', () => {
	it('is true once the delay has elapsed', () => {
		expect(shouldAutoHide(0, AUTO_HIDE_DELAY_MS)).toBeTruthy();
		expect(shouldAutoHide(0, AUTO_HIDE_DELAY_MS - 1)).toBeFalsy();
	});
});

describe('formatSlideCounter', () => {
	it('formats a one-based counter', () => {
		expect(formatSlideCounter(0, 12)).toBe('1 / 12');
		expect(formatSlideCounter(2, 12)).toBe('3 / 12');
	});
});

describe('colour palettes', () => {
	it('expose eight pen and highlighter swatches', () => {
		expect(PEN_COLORS).toHaveLength(8);
		expect(HIGHLIGHTER_COLORS).toHaveLength(8);
		expect(PEN_COLORS.every((c) => /^#[0-9a-f]{6}$/u.test(c))).toBeTruthy();
	});
});
