import { clampFlyoutPosition } from 'pptx-viewer-shared';
import { useCallback, useState } from 'react';

/**
 * Keep a right-click menu opened at (`x`, `y`) inside the viewport.
 *
 * React's canvas and element menus were placed at the raw cursor position
 * (only floored at 8px), so a right-click near the bottom or right edge of the
 * window painted most of the menu off-screen, where its lower commands (Grid
 * and Guides, Ruler, Delete) could not be clicked. Svelte and Vanilla already
 * clamped through the shared `clampFlyoutPosition`; this is the same decision.
 *
 * The returned `ref` is a callback ref: the menu node mounts afresh on every
 * opening (the menus render `null` while closed), which is exactly when it
 * needs measuring.
 */
export function useClampedMenuPosition<T extends HTMLElement>(
	x: number,
	y: number,
): { ref: (node: T | null) => void; left: number; top: number } {
	const [size, setSize] = useState({ width: 0, height: 0 });

	const ref = useCallback((node: T | null) => {
		if (!node) {
			return;
		}
		const rect = node.getBoundingClientRect();
		setSize((previous) =>
			previous.width === rect.width && previous.height === rect.height
				? previous
				: { width: rect.width, height: rect.height },
		);
	}, []);

	const { left, top } = clampFlyoutPosition({
		x,
		y,
		width: size.width,
		height: size.height,
		viewportWidth: typeof window === 'undefined' ? 0 : window.innerWidth,
		viewportHeight: typeof window === 'undefined' ? 0 : window.innerHeight,
	});
	return { ref, left, top };
}
