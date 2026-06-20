import { describe, expect, it } from 'vitest';

import {
	computeKeyboardInset,
	computeScrollDelta,
	isKeyboardOpen,
	KEYBOARD_OPEN_THRESHOLD,
	readViewportMetrics,
} from './mobile-keyboard';

describe('computeKeyboardInset', () => {
	it('returns 0 when the visual viewport fills the layout viewport', () => {
		expect(computeKeyboardInset({ layoutHeight: 800, visualHeight: 800, offsetTop: 0 })).toBe(0);
	});

	it('reports the covered pixels when the keyboard shrinks the visual viewport', () => {
		// 800 layout, 480 visible => 320px covered by the keyboard.
		expect(computeKeyboardInset({ layoutHeight: 800, visualHeight: 480, offsetTop: 0 })).toBe(320);
	});

	it('accounts for a non-zero offsetTop (pinch / scroll within the visual viewport)', () => {
		// inset = 800 - (480 + 40) = 280
		expect(computeKeyboardInset({ layoutHeight: 800, visualHeight: 480, offsetTop: 40 })).toBe(280);
	});

	it('clamps negative results to 0', () => {
		expect(computeKeyboardInset({ layoutHeight: 800, visualHeight: 820, offsetTop: 0 })).toBe(0);
	});

	it('returns 0 for non-finite or non-positive metrics', () => {
		expect(computeKeyboardInset({ layoutHeight: NaN, visualHeight: 480, offsetTop: 0 })).toBe(0);
		expect(computeKeyboardInset({ layoutHeight: 0, visualHeight: 0, offsetTop: 0 })).toBe(0);
	});
});

describe('isKeyboardOpen', () => {
	it('is closed below the default threshold (URL-bar jitter)', () => {
		expect(isKeyboardOpen(60)).toBeFalsy();
		expect(isKeyboardOpen(KEYBOARD_OPEN_THRESHOLD - 1)).toBeFalsy();
	});

	it('is open at or above the threshold', () => {
		expect(isKeyboardOpen(KEYBOARD_OPEN_THRESHOLD)).toBeTruthy();
		expect(isKeyboardOpen(320)).toBeTruthy();
	});

	it('honours a custom threshold', () => {
		expect(isKeyboardOpen(100, 50)).toBeTruthy();
		expect(isKeyboardOpen(40, 50)).toBeFalsy();
	});
});

describe('readViewportMetrics', () => {
	it('returns null when no window is available', () => {
		expect(readViewportMetrics(undefined)).toBeNull();
	});

	it('returns null when visualViewport is absent', () => {
		const fakeWin = { innerHeight: 800, visualViewport: undefined } as unknown as Window;
		expect(readViewportMetrics(fakeWin)).toBeNull();
	});

	it('reads layout + visual viewport metrics', () => {
		const fakeWin = {
			innerHeight: 800,
			visualViewport: { height: 480, offsetTop: 10 },
		} as unknown as Window;
		expect(readViewportMetrics(fakeWin)).toStrictEqual({
			layoutHeight: 800,
			visualHeight: 480,
			offsetTop: 10,
		});
	});
});

describe('computeScrollDelta', () => {
	const layoutHeight = 800;
	const keyboardInset = 320; // visible area is [0, 480]

	it('returns 0 when the field is already comfortably visible', () => {
		expect(computeScrollDelta({ top: 100, bottom: 140 }, layoutHeight, keyboardInset)).toBe(0);
	});

	it('scrolls content up (positive) when the field is behind the keyboard', () => {
		// bottom 520 is below visibleBottom-margin (480-16=464) => delta 520-464=56
		expect(computeScrollDelta({ top: 480, bottom: 520 }, layoutHeight, keyboardInset)).toBe(56);
	});

	it('scrolls content down (negative) when the field is above the top edge', () => {
		// top 4 < margin 16 => delta 4-16 = -12
		expect(computeScrollDelta({ top: 4, bottom: 40 }, layoutHeight, keyboardInset)).toBe(-12);
	});

	it('respects a custom margin', () => {
		// visibleBottom 480, margin 40 => threshold 440; bottom 450 => 450-440=10
		expect(computeScrollDelta({ top: 400, bottom: 450 }, layoutHeight, keyboardInset, 40)).toBe(10);
	});
});
