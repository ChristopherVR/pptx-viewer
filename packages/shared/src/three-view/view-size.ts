/**
 * Sizing for `<pptx-three-view>`: the element's own layout box, plus the
 * device-pixel backing size it should be drawn at.
 *
 * Slides are scaled with CSS transforms, which never change an element's
 * layout size, so `ResizeObserver` alone would draw a thumbnail at full slide
 * resolution and a 400%-zoomed slide blurry. The backing size therefore
 * follows the element's on-screen size (`getBoundingClientRect`) times the
 * device pixel ratio.
 *
 * @module three-view/view-size
 */
import { MAX_VIEW_PIXELS } from './renderer-host';
import type { ThreeViewSize } from './types';

/** Device-pixel-ratio ceiling; beyond 2x the extra pixels are not worth the fill cost. */
export const MAX_DEVICE_PIXEL_RATIO = 2;

/** Pure: backing size for a layout box shown at `screenWidth` x `screenHeight` CSS px. */
export function computeThreeViewSize(
	layoutWidth: number,
	layoutHeight: number,
	screenWidth: number,
	screenHeight: number,
	devicePixelRatio: number,
): ThreeViewSize {
	const width = Math.max(1, layoutWidth);
	const height = Math.max(1, layoutHeight);
	const dpr = Math.min(MAX_DEVICE_PIXEL_RATIO, Math.max(1, devicePixelRatio || 1));
	// A detached or display:none element reports a zero rect; draw at layout size then.
	const onScreenW = screenWidth > 0 ? screenWidth : width;
	const onScreenH = screenHeight > 0 ? screenHeight : height;
	const clamp = (px: number): number => Math.max(1, Math.min(MAX_VIEW_PIXELS, Math.round(px)));
	return {
		width,
		height,
		pixelWidth: clamp(onScreenW * dpr),
		pixelHeight: clamp(onScreenH * dpr),
	};
}

/** Measure an element's {@link ThreeViewSize}. */
export function measureThreeViewSize(element: HTMLElement): ThreeViewSize {
	const rect = element.getBoundingClientRect();
	const win = element.ownerDocument?.defaultView;
	return computeThreeViewSize(
		element.clientWidth,
		element.clientHeight,
		rect.width,
		rect.height,
		win?.devicePixelRatio ?? 1,
	);
}

/** Whether two sizes would draw differently. */
export function threeViewSizeChanged(a: ThreeViewSize, b: ThreeViewSize): boolean {
	return (
		a.width !== b.width ||
		a.height !== b.height ||
		a.pixelWidth !== b.pixelWidth ||
		a.pixelHeight !== b.pixelHeight
	);
}
