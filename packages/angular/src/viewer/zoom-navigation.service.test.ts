/**
 * Unit tests for `ZoomNavigationService`.
 *
 * The service is a plain DI-injectable with no Angular dependency in its
 * behaviour, so it is exercised directly (no TestBed; component/TestBed tests
 * are a follow-up).
 */
import { describe, expect, it, vi } from 'vitest';

import type { ZoomNavigationTarget } from '../internal/shared';
import { ZoomNavigationService } from './zoom-navigation.service';

function target(overrides: Partial<ZoomNavigationTarget> = {}): ZoomNavigationTarget {
	return { targetSlideIndex: 3, returnToParent: false, ...overrides };
}

describe('zoomNavigationService', () => {
	it('delegates navigateToZoomTarget to the registered handler', () => {
		const svc = new ZoomNavigationService();
		const handler = vi.fn();
		svc.setHandler(handler);

		svc.navigateToZoomTarget(target({ targetSlideIndex: 3 }));

		expect(handler).toHaveBeenCalledExactlyOnceWith(target({ targetSlideIndex: 3 }));
	});

	it('is a no-op when no handler is registered', () => {
		const svc = new ZoomNavigationService();
		expect(() => svc.navigateToZoomTarget(target({ targetSlideIndex: 2 }))).not.toThrow();
	});

	it('uses the most recently registered handler', () => {
		const svc = new ZoomNavigationService();
		const first = vi.fn();
		const second = vi.fn();
		svc.setHandler(first);
		svc.setHandler(second);

		svc.navigateToZoomTarget(target({ targetSlideIndex: 5 }));

		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledWith(target({ targetSlideIndex: 5 }));
	});
});
