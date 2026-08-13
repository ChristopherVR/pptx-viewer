import { describe, it, expect } from 'vitest';

import { buildLayoutPreviewFrames, buildLayoutPreviewGeometry } from './layout-preview';

describe('buildLayoutPreviewGeometry', () => {
	it('fits the slide inside the box without cropping', () => {
		const geometry = buildLayoutPreviewGeometry({ width: 960, height: 540 }, 128, 72);

		expect(geometry.surfaceWidth).toBe(960);
		expect(geometry.surfaceHeight).toBe(540);
		expect(geometry.scale).toBeCloseTo(128 / 960, 6);
	});

	it('fits by the constraining axis for a 4:3 layout in a 16:9 box', () => {
		// Scaling by width would overflow the box vertically and crop the deck.
		const geometry = buildLayoutPreviewGeometry({ width: 960, height: 720 }, 128, 72);

		expect(geometry.scale).toBeCloseTo(72 / 720, 6);
	});

	it('compensates the frame border for the surface scale', () => {
		const geometry = buildLayoutPreviewGeometry({ width: 960, height: 540 }, 128, 72);

		// 1.5px on screen once the surface transform has been applied.
		expect(geometry.frameBorderWidth * geometry.scale).toBeCloseTo(1.5, 6);
	});

	it('falls back to 16:9 pixel dimensions when the layout reports none', () => {
		const geometry = buildLayoutPreviewGeometry(undefined, 128, 72);

		expect(geometry.surfaceWidth).toBe(960);
		expect(geometry.surfaceHeight).toBe(540);
		expect(geometry.backgroundColor).toBe('#ffffff');
	});

	it('ignores zero and negative dimensions', () => {
		const geometry = buildLayoutPreviewGeometry({ width: 0, height: -10 }, 128, 72);

		expect(geometry.surfaceWidth).toBe(960);
		expect(geometry.surfaceHeight).toBe(540);
	});

	it('keeps the layout background when one resolved', () => {
		expect(
			buildLayoutPreviewGeometry({ backgroundColor: '#123456' }, 128, 72).backgroundColor,
		).toBe('#123456');
	});
});

describe('buildLayoutPreviewFrames', () => {
	it('positions frames in unscaled slide space', () => {
		const frames = buildLayoutPreviewFrames([
			{ type: 'title', idx: '1', x: 63, y: 130, width: 834, height: 90 },
		]);

		expect(frames).toStrictEqual([
			{ key: 'title-1', type: 'title', left: 63, top: 130, width: 834, height: 90 },
		]);
	});

	it('skips placeholders that inherit their frame from the master', () => {
		// These report no geometry at all; defaulting to zero would stack empty
		// boxes in the corner of every thumbnail.
		const frames = buildLayoutPreviewFrames([
			{ type: 'body' },
			{ type: 'ftr', x: 10, y: 10 },
			{ type: 'pic', x: 10, y: 10, width: 0, height: 50 },
		]);

		expect(frames).toStrictEqual([]);
	});

	it('falls back to the array index when idx is omitted', () => {
		const frames = buildLayoutPreviewFrames([
			{ type: 'body', x: 0, y: 0, width: 10, height: 10 },
			{ type: 'body', x: 20, y: 0, width: 10, height: 10 },
		]);

		expect(frames.map((frame) => frame.key)).toStrictEqual(['body-0', 'body-1']);
	});

	it('handles a missing placeholder list', () => {
		expect(buildLayoutPreviewFrames(undefined)).toStrictEqual([]);
	});
});
