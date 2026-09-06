import { describe, expect, it } from 'vitest';

import { buildPictureFillPatternDef, polygonBoundingBox } from './chart-picture-pattern-def';

describe('polygonBoundingBox', () => {
	it('computes the axis-aligned bounding box of a points string', () => {
		expect(polygonBoundingBox('10,20 40,20 45,25 15,25')).toStrictEqual({
			x: 10,
			y: 20,
			w: 35,
			h: 5,
		});
	});

	it('handles a single point (zero-size box)', () => {
		expect(polygonBoundingBox('5,5')).toStrictEqual({ x: 5, y: 5, w: 0, h: 0 });
	});
});

describe('buildPictureFillPatternDef', () => {
	const box = { x: 1, y: 2, w: 30, h: 40 };

	it('sizes a stretch pattern to the whole box with preserveAspectRatio none', () => {
		const def = buildPictureFillPatternDef('id1', 'data:image/png;x', 'stretch', box, undefined);
		expect(def).toStrictEqual({
			kind: 'pattern',
			id: 'id1',
			href: 'data:image/png;x',
			patternUnits: 'userSpaceOnUse',
			x: 1,
			y: 2,
			width: 30,
			height: 40,
			preserveAspectRatio: 'none',
		});
	});

	it('tiles a stack pattern at the given tile height', () => {
		const def = buildPictureFillPatternDef('id1', 'data:image/png;x', 'stack', box, 12);
		expect(def.height).toBe(12);
		expect(def.preserveAspectRatio).toBe('xMidYMid slice');
	});

	it('falls back to the box height for stack with no tile height (one tile)', () => {
		const def = buildPictureFillPatternDef('id1', 'data:image/png;x', 'stack', box, undefined);
		expect(def.height).toBe(40);
	});
});
