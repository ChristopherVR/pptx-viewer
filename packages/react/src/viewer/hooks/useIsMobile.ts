import {
	isMobileViewport,
	MOBILE_BREAKPOINT,
	MOBILE_LANDSCAPE_MAX_HEIGHT,
	TABLET_BREAKPOINT,
	detectOrientation,
	detectTouchDevice,
} from 'pptx-viewer-shared';
import type { DeviceOrientation } from 'pptx-viewer-shared';
/**
 * useIsMobile: Detects viewport size and touch capability for responsive layout.
 *
 * Provides reactive breakpoint flags (`isMobile`, `isTablet`, `isDesktop`) and
 * a `isTouchDevice` flag. Uses `ResizeObserver` on the container element (if
 * provided) or the viewport width as a fallback, so the detection adapts when
 * the viewer is embedded inside a narrow host container.
 *
 * Also detects virtual keyboard visibility on mobile devices and reports
 * device orientation.
 *
 * Breakpoints (container-width based):
 *   mobile:  < 768px
 *   tablet:  768px .. 1023px
 *   desktop: >= 1024px
 *
 * @module useIsMobile
 */
import { useState, useEffect, useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// The viewport breakpoint maths and the touch / orientation probes live in
// shared (`render/mobile-viewport.ts`) so React, Vue and Angular switch chrome
// at exactly the same thresholds. Re-exported here to preserve this module's
// public surface for existing importers.
export { MOBILE_BREAKPOINT, TABLET_BREAKPOINT, MOBILE_LANDSCAPE_MAX_HEIGHT, isMobileViewport };
export type { DeviceOrientation };

/** Minimum touch target size (px) per WCAG accessibility guidelines. */
export const MIN_TOUCH_TARGET = 44;

// ---------------------------------------------------------------------------
// Touch capability detection
// ---------------------------------------------------------------------------

function subscribeTouchCapability(callback: () => void): () => void {
	if (typeof window === 'undefined') {
		return () => {};
	}
	// Touch capability doesn't change at runtime, but a hybrid device
	// might connect/disconnect a touch screen. We re-check on pointer events.
	const handler = () => callback();
	window.addEventListener('pointerdown', handler, { once: true });
	return () => window.removeEventListener('pointerdown', handler);
}

// ---------------------------------------------------------------------------
// Hook output
// ---------------------------------------------------------------------------

export interface UseIsMobileResult {
	/** True when container/viewport width is below 768px. */
	isMobile: boolean;
	/** True when container/viewport width is 768..1023px. */
	isTablet: boolean;
	/** True when container/viewport width is >= 1024px. */
	isDesktop: boolean;
	/** True on devices with touch capability. */
	isTouchDevice: boolean;
	/** Current device orientation (portrait or landscape). */
	orientation: DeviceOrientation;
	/** True when the virtual keyboard is likely visible (viewport height shrank significantly). */
	isVirtualKeyboardOpen: boolean;
	/** The measured container width in pixels. */
	containerWidth: number;
}

export interface UseIsMobileInput {
	/** Optional ref to the container element for container-based breakpoints. */
	containerRef?: React.RefObject<HTMLElement | null>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useIsMobile(input?: UseIsMobileInput): UseIsMobileResult {
	const containerRef = input?.containerRef;

	// Touch capability: uses useSyncExternalStore for SSR safety
	const isTouchDevice = useSyncExternalStore(
		subscribeTouchCapability,
		detectTouchDevice,
		() => false, // server snapshot
	);

	// Container/viewport width
	const [containerWidth, setContainerWidth] = useState(() => {
		if (typeof window === 'undefined') {
			return 1024;
		}
		return containerRef?.current?.clientWidth ?? window.innerWidth;
	});

	// Container/viewport height: used to detect short landscape phones.
	const [containerHeight, setContainerHeight] = useState(() => {
		if (typeof window === 'undefined') {
			return 768;
		}
		return containerRef?.current?.clientHeight ?? window.innerHeight;
	});

	// Orientation
	const [orientation, setOrientation] = useState<DeviceOrientation>(detectOrientation);

	// Virtual keyboard detection
	const [isVirtualKeyboardOpen, setIsVirtualKeyboardOpen] = useState(false);
	// Captured once on mount; no setter needed (viewport-shrink detection baseline).
	// eslint-disable-next-line react/hook-use-state
	const [initialViewportHeight] = useState(() =>
		typeof window !== 'undefined' ? window.innerHeight : 800,
	);

	// Container width tracking -- polls with rAF until the containerRef mounts
	// (the viewer renders LoadingState first so the ref starts null), then
	// upgrades to a ResizeObserver. Mirrors the approach in useViewerDialogs so
	// both hooks see the same container dimensions and stay in sync.
	useEffect(() => {
		let observer: ResizeObserver | null = null;
		let raf = 0;

		const attach = () => {
			const el = containerRef?.current;
			if (!el) {
				// Container not yet mounted; poll until it is.
				raf = requestAnimationFrame(attach);
				return;
			}
			observer = new ResizeObserver((entries) => {
				const entry = entries[0];
				if (entry) {
					setContainerWidth(entry.contentRect.width);
					setContainerHeight(entry.contentRect.height);
				}
			});
			observer.observe(el);
			setContainerWidth(el.clientWidth);
			setContainerHeight(el.clientHeight);
		};
		attach();

		// Fallback: also track window resize for when the container is not
		// provided (containerRef is undefined/null).
		const handleResize = () => {
			if (!containerRef?.current) {
				setContainerWidth(window.innerWidth);
				setContainerHeight(window.innerHeight);
			}
		};
		window.addEventListener('resize', handleResize);

		return () => {
			cancelAnimationFrame(raf);
			observer?.disconnect();
			window.removeEventListener('resize', handleResize);
		};
	}, [containerRef]);

	// Orientation change tracking
	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		const handleOrientationChange = () => {
			setOrientation(detectOrientation());
		};

		if (screen.orientation) {
			screen.orientation.addEventListener('change', handleOrientationChange);
		}
		window.addEventListener('resize', handleOrientationChange);

		return () => {
			if (screen.orientation) {
				screen.orientation.removeEventListener('change', handleOrientationChange);
			}
			window.removeEventListener('resize', handleOrientationChange);
		};
	}, []);

	// Virtual keyboard detection: when viewport height shrinks by > 30% on a
	// touch device, it's very likely the virtual keyboard appeared.
	useEffect(() => {
		if (!isTouchDevice || typeof window === 'undefined') {
			return;
		}

		const handleResize = () => {
			const currentHeight = window.visualViewport?.height ?? window.innerHeight;
			const shrinkRatio = currentHeight / initialViewportHeight;
			setIsVirtualKeyboardOpen(shrinkRatio < 0.7);
		};

		const vv = window.visualViewport;
		if (vv) {
			vv.addEventListener('resize', handleResize);
			return () => vv.removeEventListener('resize', handleResize);
		}

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, [isTouchDevice, initialViewportHeight]);

	// Derived breakpoint flags. A narrow viewport is mobile; so is a short
	// touch viewport below the tablet width (a landscape phone), which would
	// otherwise be mis-classified as a tablet and shown the desktop ribbon.
	const isMobile = isMobileViewport(containerWidth, containerHeight, isTouchDevice);
	const isTablet =
		!isMobile && containerWidth >= MOBILE_BREAKPOINT && containerWidth < TABLET_BREAKPOINT;
	const isDesktop = !isMobile && containerWidth >= TABLET_BREAKPOINT;

	return {
		isMobile,
		isTablet,
		isDesktop,
		isTouchDevice,
		orientation,
		isVirtualKeyboardOpen,
		containerWidth,
	};
}
