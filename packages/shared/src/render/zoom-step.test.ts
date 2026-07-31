import { describe, expect, it } from 'vitest';

import {
	clampZoomScale,
	MAX_ZOOM_SCALE,
	MIN_ZOOM_SCALE,
	ZOOM_MAX_PERCENT,
	ZOOM_MIN_PERCENT,
	ZOOM_STEP,
	zoomInPercent,
	zoomInScale,
	zoomOutPercent,
	zoomOutScale,
} from './zoom-step';

describe('zoom stepping', () => {
	it('steps by the React reference amount', () => {
		// The parity spec measures exactly this: one press from fit (scale 1)
		// must scale the stage by 1.1x in every binding.
		expect(ZOOM_STEP).toBe(0.1);
		expect(zoomInScale(1)).toBe(1.1);
		expect(zoomOutScale(1)).toBe(0.9);
	});

	it('does not accumulate float dust across presses', () => {
		expect(zoomInScale(zoomInScale(1))).toBe(1.2);
		expect(zoomOutScale(zoomInScale(1))).toBe(1);
	});

	it('clamps to the shared bounds', () => {
		expect(zoomInScale(MAX_ZOOM_SCALE)).toBe(MAX_ZOOM_SCALE);
		expect(zoomOutScale(MIN_ZOOM_SCALE)).toBe(MIN_ZOOM_SCALE);
		expect(clampZoomScale(99)).toBe(MAX_ZOOM_SCALE);
		expect(clampZoomScale(0)).toBe(MIN_ZOOM_SCALE);
	});

	it('falls back to 100% for a non-finite scale', () => {
		expect(clampZoomScale(Number.NaN)).toBe(1);
	});

	it('offers the same arithmetic in percent', () => {
		expect(zoomInPercent(100)).toBe(110);
		expect(zoomOutPercent(110)).toBe(100);
		expect(zoomInPercent(ZOOM_MAX_PERCENT)).toBe(ZOOM_MAX_PERCENT);
		expect(zoomOutPercent(ZOOM_MIN_PERCENT)).toBe(ZOOM_MIN_PERCENT);
	});
});
