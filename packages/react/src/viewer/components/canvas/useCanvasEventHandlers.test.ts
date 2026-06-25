import { describe, it, expect } from 'vitest';

import { isViewportBackgroundMouseDownTarget } from './useCanvasEventHandlers';

describe('isViewportBackgroundMouseDownTarget', () => {
	it('returns true when the mouse-down lands directly on the viewport background', () => {
		const viewport = {} as EventTarget;
		expect(isViewportBackgroundMouseDownTarget(viewport, viewport)).toBeTruthy();
	});

	it('returns false for bubbled child events (target differs from currentTarget)', () => {
		const viewport = {} as EventTarget;
		const child = {} as EventTarget;
		expect(isViewportBackgroundMouseDownTarget(child, viewport)).toBeFalsy();
	});

	it('returns false when target differs from a null currentTarget', () => {
		const viewport = {} as EventTarget;
		expect(isViewportBackgroundMouseDownTarget(null, viewport)).toBeFalsy();
		expect(isViewportBackgroundMouseDownTarget(viewport, null)).toBeFalsy();
	});
});
