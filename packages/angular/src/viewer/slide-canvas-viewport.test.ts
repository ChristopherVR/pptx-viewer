/**
 * slide-canvas-viewport.test.ts: Unit tests for the viewport-background press
 * guard. Ports the React `useCanvasEventHandlers` coverage: a direct hit on the
 * scrollable viewport background deselects, while bubbled child events do not.
 */

import { describe, expect, it } from 'vitest';

import { isViewportBackgroundPressTarget } from './slide-canvas-helpers';

describe('isViewportBackgroundPressTarget', () => {
	it('returns true when the press lands directly on the viewport background', () => {
		const viewport = {} as EventTarget;
		expect(isViewportBackgroundPressTarget(viewport, viewport)).toBeTruthy();
	});

	it('returns false for bubbled child events (target differs from currentTarget)', () => {
		const viewport = {} as EventTarget;
		const child = {} as EventTarget;
		expect(isViewportBackgroundPressTarget(child, viewport)).toBeFalsy();
	});

	it('returns false when target differs from a null currentTarget', () => {
		const viewport = {} as EventTarget;
		expect(isViewportBackgroundPressTarget(null, viewport)).toBeFalsy();
		expect(isViewportBackgroundPressTarget(viewport, null)).toBeFalsy();
	});
});
