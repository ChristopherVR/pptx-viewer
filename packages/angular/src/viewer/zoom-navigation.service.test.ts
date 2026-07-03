/**
 * Unit tests for `ZoomNavigationService`.
 *
 * The service is a plain DI-injectable with no Angular dependency in its
 * behaviour, so it is exercised directly (no TestBed; component/TestBed tests
 * are a follow-up).
 */
import { describe, expect, it, vi } from 'vitest';

import { ZoomNavigationService } from './zoom-navigation.service';

describe('zoomNavigationService', () => {
	it('delegates navigateToZoomTarget to the registered handler', () => {
		const svc = new ZoomNavigationService();
		const handler = vi.fn();
		svc.setHandler(handler);

		svc.navigateToZoomTarget(3);

		expect(handler).toHaveBeenCalledExactlyOnceWith(3);
	});

	it('is a no-op when no handler is registered', () => {
		const svc = new ZoomNavigationService();
		expect(() => svc.navigateToZoomTarget(2)).not.toThrow();
	});

	it('uses the most recently registered handler', () => {
		const svc = new ZoomNavigationService();
		const first = vi.fn();
		const second = vi.fn();
		svc.setHandler(first);
		svc.setHandler(second);

		svc.navigateToZoomTarget(5);

		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledWith(5);
	});
});
