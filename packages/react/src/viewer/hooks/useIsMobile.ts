import {
	deriveViewportBreakpoints,
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
 * an `isTouchDevice` flag, always derived from the BROWSER viewport
 * (`deriveViewportBreakpoints`, `pptx-viewer-shared`) rather than any
 * embedding container: a viewer hosted in a narrow sidebar or split pane still
 * has a full desktop pointer and keyboard, so a narrow host must not swap in
 * the touch-oriented mobile bottom-sheet UI. This hook used to measure an
 * optional `containerRef` instead, which was exactly that bug (Vue had the
 * same one; see `deriveViewportBreakpoints`'s doc comment) - container/canvas
 * sizing for layout purposes is a separate, unrelated concern handled by its
 * own hook (`useZoomViewport`), not this one.
 *
 * Also detects virtual keyboard visibility on mobile devices and reports
 * device orientation.
 *
 * Breakpoints (viewport-width based):
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
	/** True when the browser viewport width is below 768px. */
	isMobile: boolean;
	/** True when the browser viewport width is 768..1023px. */
	isTablet: boolean;
	/** True when the browser viewport width is >= 1024px. */
	isDesktop: boolean;
	/** True on devices with touch capability. */
	isTouchDevice: boolean;
	/** Current device orientation (portrait or landscape). */
	orientation: DeviceOrientation;
	/** True when the virtual keyboard is likely visible (viewport height shrank significantly). */
	isVirtualKeyboardOpen: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useIsMobile(): UseIsMobileResult {
	// Touch capability: uses useSyncExternalStore for SSR safety
	const isTouchDevice = useSyncExternalStore(
		subscribeTouchCapability,
		detectTouchDevice,
		() => false, // server snapshot
	);

	// The BROWSER viewport - chrome selection (isMobile/isTablet/isDesktop,
	// below) always reads this, never a container's size.
	const [viewportWidth, setViewportWidth] = useState(() =>
		typeof window === 'undefined' ? 1024 : window.innerWidth,
	);
	const [viewportHeight, setViewportHeight] = useState(() =>
		typeof window === 'undefined' ? 768 : window.innerHeight,
	);

	// Orientation
	const [orientation, setOrientation] = useState<DeviceOrientation>(detectOrientation);

	// Virtual keyboard detection
	const [isVirtualKeyboardOpen, setIsVirtualKeyboardOpen] = useState(false);
	// Captured once on mount; no setter needed (viewport-shrink detection baseline).
	// eslint-disable-next-line react/hook-use-state
	const [initialViewportHeight] = useState(() =>
		typeof window !== 'undefined' ? window.innerHeight : 800,
	);

	// Browser viewport tracking for chrome selection.
	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		const handleViewportResize = () => {
			setViewportWidth(window.innerWidth);
			setViewportHeight(window.innerHeight);
		};
		window.addEventListener('resize', handleViewportResize);
		return () => window.removeEventListener('resize', handleViewportResize);
	}, []);

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

	// Derived breakpoint flags, from the browser viewport (not the container -
	// see the module doc comment). A narrow viewport is mobile; so is a short
	// touch viewport below the tablet width (a landscape phone), which would
	// otherwise be mis-classified as a tablet and shown the desktop ribbon.
	const { isMobile, isTablet, isDesktop } = deriveViewportBreakpoints(
		viewportWidth,
		viewportHeight,
		isTouchDevice,
	);

	return {
		isMobile,
		isTablet,
		isDesktop,
		isTouchDevice,
		orientation,
		isVirtualKeyboardOpen,
	};
}
