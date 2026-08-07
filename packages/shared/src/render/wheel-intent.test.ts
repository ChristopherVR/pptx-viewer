import { describe, expect, it } from 'vitest';

import {
	createWheelStepBuffer,
	mapEditingWheel,
	mapPresentationWheel,
	normalizeWheelDelta,
} from './wheel-intent';

describe('normalizeWheelDelta', () => {
	it('passes pixel deltas through', () => {
		expect(normalizeWheelDelta({ deltaY: 120, deltaMode: 0 })).toBe(120);
		expect(normalizeWheelDelta({ deltaY: 120 })).toBe(120);
	});

	it('scales line and page deltas up to pixels', () => {
		// Firefox reports whole LINES. Reading deltaY raw is why a Firefox notch
		// moved zoom by 0.003 instead of ~0.1.
		expect(normalizeWheelDelta({ deltaY: 3, deltaMode: 1 })).toBe(48);
		expect(normalizeWheelDelta({ deltaY: 1, deltaMode: 2 })).toBe(400);
	});
});

describe('mapEditingWheel', () => {
	it('zooms IN when ctrl is held and the wheel goes up', () => {
		const intent = mapEditingWheel({ deltaY: -120, ctrlKey: true }, createWheelStepBuffer(), true);
		expect(intent.intent).toBe('zoom');
		expect(intent.intent === 'zoom' && intent.deltaScale > 0).toBeTruthy();
	});

	it('zooms OUT when ctrl is held and the wheel goes down', () => {
		const intent = mapEditingWheel({ deltaY: 120, ctrlKey: true }, createWheelStepBuffer(), true);
		expect(intent.intent === 'zoom' && intent.deltaScale < 0).toBeTruthy();
	});

	it('gives ctrl+wheel the same zoom step whatever unit the browser reports', () => {
		const px = mapEditingWheel({ deltaY: 48, ctrlKey: true }, createWheelStepBuffer(), true);
		const lines = mapEditingWheel(
			{ deltaY: 3, deltaMode: 1, ctrlKey: true },
			createWheelStepBuffer(),
			true,
		);
		expect(px).toStrictEqual(lines);
	});

	it('scrolls while the viewport still has travel', () => {
		expect(mapEditingWheel({ deltaY: 50 }, createWheelStepBuffer(), true)).toStrictEqual({
			intent: 'scroll',
		});
	});

	it('steps to the next slide once scrolling is exhausted', () => {
		const buffer = createWheelStepBuffer();
		// Below the threshold the charge is held, not acted on.
		expect(mapEditingWheel({ deltaY: 60 }, buffer, false)).toStrictEqual({ intent: 'none' });
		expect(mapEditingWheel({ deltaY: 60 }, buffer, false)).toStrictEqual({
			intent: 'next-slide',
		});
		// ...and the charge resets, so the next step needs a fresh gesture.
		expect(mapEditingWheel({ deltaY: 60 }, buffer, false)).toStrictEqual({ intent: 'none' });
	});

	it('steps to the previous slide going up', () => {
		const buffer = createWheelStepBuffer();
		expect(mapEditingWheel({ deltaY: -130 }, buffer, false)).toStrictEqual({
			intent: 'previous-slide',
		});
	});

	it('discards charge when the gesture reverses', () => {
		const buffer = createWheelStepBuffer();
		mapEditingWheel({ deltaY: 100 }, buffer, false);
		// Reversing must not have to unwind the 100 first.
		expect(mapEditingWheel({ deltaY: -130 }, buffer, false)).toStrictEqual({
			intent: 'previous-slide',
		});
	});

	it('discards charge when the gesture becomes a zoom or a scroll', () => {
		const buffer = createWheelStepBuffer();
		mapEditingWheel({ deltaY: 100 }, buffer, false);
		mapEditingWheel({ deltaY: 10, ctrlKey: true }, buffer, false);
		expect(buffer.accumulated).toBe(0);
	});
});

describe('mapPresentationWheel', () => {
	it('navigates on every notch, without needing a scroll to exhaust', () => {
		const buffer = createWheelStepBuffer();
		expect(mapPresentationWheel({ deltaY: 130 }, buffer)).toStrictEqual({ intent: 'next-slide' });
		expect(mapPresentationWheel({ deltaY: -130 }, buffer)).toStrictEqual({
			intent: 'previous-slide',
		});
	});

	it('does not fire on a sub-threshold trackpad twitch', () => {
		expect(mapPresentationWheel({ deltaY: 4 }, createWheelStepBuffer())).toStrictEqual({
			intent: 'none',
		});
	});
});
