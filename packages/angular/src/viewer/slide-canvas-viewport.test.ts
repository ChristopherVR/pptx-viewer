/**
 * slide-canvas-viewport.test.ts: Unit tests for the viewport-background press
 * guard. Ports the React `useCanvasEventHandlers` coverage: a direct hit on the
 * scrollable viewport background deselects, while bubbled child events do not.
 */

import { describe, expect, it } from 'vitest';

import { CanvasFitService } from './canvas-fit.service';
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

describe('canvas viewport fit policy', () => {
	function setup(width = 960, height = 540) {
		const viewport = document.createElement('div');
		Object.defineProperties(viewport, {
			clientWidth: { get: () => width },
			clientHeight: { get: () => height },
		});
		const state: {
			autoFit: boolean;
			fitPadding?: number | { horizontal: number; vertical: number };
			maxFitScale?: number | null;
		} = { autoFit: true };
		const service = new CanvasFitService();
		service.bind({
			autoFit: () => state.autoFit,
			viewportElement: () => viewport,
			canvasSize: () => ({ width: 960, height: 540 }),
			fitOptions: () => state,
		});
		return { service, state };
	}

	it('preserves default padding and supports live padding updates', () => {
		const { service, state } = setup();
		service.recompute();
		expect(service.fitScale()).toBeCloseTo(508 / 540);
		state.fitPadding = 0;
		service.recompute();
		expect(service.fitScale()).toBe(1);
		state.fitPadding = { horizontal: 80, vertical: 0 };
		service.recompute();
		expect(service.fitScale()).toBeCloseTo(800 / 960);
	});

	it('supports uncapped enlargement, finite caps, and the autoFit bypass', () => {
		const { service, state } = setup(1920, 1080);
		service.recompute();
		expect(service.fitScale()).toBe(1);
		state.fitPadding = 0;
		state.maxFitScale = null;
		service.recompute();
		expect(service.fitScale()).toBe(2);
		state.maxFitScale = 1.5;
		service.recompute();
		expect(service.fitScale()).toBe(1.5);
		state.autoFit = false;
		service.recompute();
		expect(service.fitScale()).toBe(1);
	});

	it('falls back safely for invalid options and unavailable measurements', () => {
		const { service, state } = setup();
		state.fitPadding = -10;
		state.maxFitScale = Number.NaN;
		service.recompute();
		expect(service.fitScale()).toBeCloseTo(508 / 540);
		const unavailable = setup(0, 0).service;
		unavailable.recompute();
		expect(unavailable.fitScale()).toBe(1);
	});
});
