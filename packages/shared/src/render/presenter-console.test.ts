import { describe, expect, it } from 'vitest';

import {
	appendPresentationInkPoint,
	clampPresenterZoom,
	createPresenterTimer,
	erasePresentationInkAt,
	presenterElapsed,
	resetPresenterTimer,
	stepPresenterZoom,
	togglePresenterTimer,
} from './presenter-console';

describe('presenter console', () => {
	it('pauses, resumes, and resets elapsed time', () => {
		const timer = createPresenterTimer(100);
		const paused = togglePresenterTimer(timer, 600);
		expect(presenterElapsed(paused, 900)).toBe(500);
		const resumed = togglePresenterTimer(paused, 1000);
		expect(presenterElapsed(resumed, 1250)).toBe(750);
		expect(resetPresenterTimer(2000)).toStrictEqual({
			elapsedMs: 0,
			paused: false,
			lastStartedAt: 2000,
		});
	});

	it('clamps and steps slide zoom', () => {
		expect(clampPresenterZoom({ scale: 8, originX: -1, originY: 2 })).toStrictEqual({
			scale: 4,
			originX: 0,
			originY: 1,
		});
		expect(stepPresenterZoom({ scale: 1, originX: 0.5, originY: 0.5 }, -1).scale).toBe(1);
	});

	it('appends clamped points and erases nearby strokes', () => {
		const stroke = appendPresentationInkPoint(
			{ id: 'a', slideIndex: 2, tool: 'pen', color: '#f00', width: 2, points: [] },
			{ x: 2, y: -1 },
		);
		expect(stroke.points).toStrictEqual([{ x: 1, y: 0 }]);
		expect(erasePresentationInkAt([stroke], 2, { x: 1, y: 0 })).toStrictEqual([]);
	});
});
