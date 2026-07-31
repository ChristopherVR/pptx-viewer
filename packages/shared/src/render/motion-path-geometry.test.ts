import { describe, expect, it } from 'vitest';

import {
	buildMotionPathKeyframes,
	isEditableMotionPath,
	motionPathEndFraction,
	motionPathEndPixel,
	motionPathFractionPoints,
	motionPathToSvgD,
	setMotionPathEnd,
	translateMotionPath,
} from './motion-path-geometry';
import { MOTION_PATH_PRESETS } from './motion-path-presets';

const FRAME = { originX: 640, originY: 360, slideWidth: 1280, slideHeight: 720 };

describe('motionPathFractionPoints', () => {
	it('samples in slide fractions, not percentages', () => {
		const points = motionPathFractionPoints('M 0 0 L 0.25 0');
		expect(points.at(-1)).toStrictEqual({ x: 0.25, y: 0 });
	});

	it('returns nothing for an unparseable path', () => {
		expect(motionPathFractionPoints('nonsense')).toStrictEqual([]);
	});
});

describe('motionPathToSvgD', () => {
	it('draws from the element centre into slide pixels', () => {
		expect(motionPathToSvgD('M 0 0 L 0.25 0', FRAME)).toBe('M 640 360 L 640 360 L 960 360');
	});

	it('scales x by slide width and y by slide height independently', () => {
		const d = motionPathToSvgD('M 0 0 L 0 0.5', FRAME);
		expect(d.endsWith('L 640 720')).toBeTruthy();
	});

	it('is empty for an unparseable path', () => {
		expect(motionPathToSvgD('', FRAME)).toBe('');
	});
});

describe('end point helpers', () => {
	it('reports the last waypoint in fractions and pixels', () => {
		expect(motionPathEndFraction('M 0 0 L 0.25 -0.25')).toStrictEqual({ x: 0.25, y: -0.25 });
		expect(motionPathEndPixel('M 0 0 L 0.25 -0.25', FRAME)).toStrictEqual({ x: 960, y: 180 });
	});

	it('falls back to the origin when nothing parses', () => {
		expect(motionPathEndPixel('', FRAME)).toStrictEqual({ x: 640, y: 360 });
	});
});

describe('setMotionPathEnd', () => {
	it('moves a line end point', () => {
		expect(setMotionPathEnd('M 0 0 L 0.25 0', 0.4, -0.1)).toBe('M 0 0 L 0.4 -0.1');
	});

	it('drags a bezier trailing control point with the end so the curve keeps shape', () => {
		const moved = setMotionPathEnd('M 0 0 C 0 -0.1 0.1 -0.2 0.2 -0.2', 0.3, -0.2);
		expect(moved).toBe('M 0 0 C 0 -0.1 0.2 -0.2 0.3 -0.2');
	});

	it('refuses to edit a closed shape path', () => {
		const closed = 'M 0 0 L 0.125 0 L 0.125 -0.2222 L 0 -0.2222 Z';
		expect(setMotionPathEnd(closed, 0.5, 0.5)).toBe(closed);
	});

	it('leaves an unparseable path untouched', () => {
		expect(setMotionPathEnd('M 0 0 A 1 1 0 0 1 2 2', 0.5, 0.5)).toBe('M 0 0 A 1 1 0 0 1 2 2');
	});

	it('round-trips through the fraction reader', () => {
		const next = setMotionPathEnd('M 0 0 L 0.25 0', -0.3, 0.2);
		expect(motionPathEndFraction(next)).toStrictEqual({ x: -0.3, y: 0.2 });
	});
});

describe('translateMotionPath', () => {
	it('shifts every absolute coordinate pair', () => {
		expect(translateMotionPath('M 0 0 L 0.25 0', 0.1, -0.05)).toBe('M 0.1 -0.05 L 0.35 -0.05');
	});

	it('keeps relative deltas as deltas', () => {
		expect(translateMotionPath('M 0 0 l 0.25 0', 0.1, 0)).toBe('M 0.1 0 l 0.25 0');
	});
});

describe('isEditableMotionPath', () => {
	it('accepts open line and curve paths', () => {
		expect(isEditableMotionPath('M 0 0 L 0.25 0')).toBeTruthy();
		expect(isEditableMotionPath('M 0 0 C 0 -0.1 0.1 -0.2 0.2 -0.2')).toBeTruthy();
	});

	it('rejects closed shapes and unsupported commands', () => {
		expect(isEditableMotionPath('M 0 0 L 0.1 0 Z')).toBeFalsy();
		expect(isEditableMotionPath('M 0 0 A 1 1 0 0 1 2 2')).toBeFalsy();
	});
});

describe('buildMotionPathKeyframes', () => {
	it('translates in pixels so the travel matches the slide, not the element box', () => {
		const built = buildMotionPathKeyframes({
			path: 'M 0 0 L 0.25 0',
			slideWidth: 1280,
			slideHeight: 720,
			keyframeName: 'kf',
		});
		expect(built?.css).toContain('100% { transform: translate(320px, 0px); }');
	});

	it('returns nothing when the path has fewer than two points', () => {
		expect(
			buildMotionPathKeyframes({
				path: 'M 0 0',
				slideWidth: 1280,
				slideHeight: 720,
				keyframeName: 'kf',
			}),
		).toBeUndefined();
	});
});

describe('catalogue integrity', () => {
	it('every preset parses into a drawable path', () => {
		const unusable = MOTION_PATH_PRESETS.filter(
			(preset) => motionPathFractionPoints(preset.path).length < 2,
		).map((preset) => preset.id);
		expect(unusable).toStrictEqual([]);
	});

	it('preset ids are unique', () => {
		const ids = MOTION_PATH_PRESETS.map((preset) => preset.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
