/**
 * Drawing past the element box (framework-agnostic, pure).
 *
 * PowerPoint draws a scene-style SmartArt diagram through its camera without
 * clipping it to the graphic frame: a turned diagram can reach above the
 * frame (Brick Scene) or below it (Sunset, Bird's Eye). A scene reports how
 * far its drawing reaches past each edge as fractions of the element box
 * ({@link ThreeViewOverflow}); `<pptx-three-view>` then grows its canvas (CSS
 * box and drawing buffer) by that much on each side and the scene widens its
 * camera frustum by the same amount, so the part inside the element box is
 * drawn exactly where it was before.
 *
 * @module three-view/view-overflow
 */
import { MAX_VIEW_PIXELS } from './renderer-host';
import type { ThreeViewOverflow, ThreeViewSize } from './types';

/** Largest overflow on any one side, as a fraction of the element box. */
export const MAX_THREE_VIEW_OVERFLOW = 0.5;

/** Headroom added past the measured reach, so an antialiased edge is not cut. */
const OVERFLOW_MARGIN = 0.01;

/** No overflow. */
export const NO_THREE_VIEW_OVERFLOW: ThreeViewOverflow = { top: 0, right: 0, bottom: 0, left: 0 };

function side(reach: number): number {
	if (!(reach > 0)) {
		return 0;
	}
	return Math.min(MAX_THREE_VIEW_OVERFLOW, reach + OVERFLOW_MARGIN);
}

/**
 * The overflow of points in normalised device coordinates (x right, y up,
 * the element box spanning -1..1 on both axes).
 */
export function threeViewOverflowFromNdc(
	points: readonly { x: number; y: number }[],
): ThreeViewOverflow {
	if (points.length === 0) {
		return NO_THREE_VIEW_OVERFLOW;
	}
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const p of points) {
		if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
			continue;
		}
		minX = Math.min(minX, p.x);
		maxX = Math.max(maxX, p.x);
		minY = Math.min(minY, p.y);
		maxY = Math.max(maxY, p.y);
	}
	if (minX > maxX) {
		return NO_THREE_VIEW_OVERFLOW;
	}
	return {
		top: side((maxY - 1) / 2),
		right: side((maxX - 1) / 2),
		bottom: side((-1 - minY) / 2),
		left: side((-1 - minX) / 2),
	};
}

/** Whether an overflow reaches past any edge. */
export function hasThreeViewOverflow(overflow: ThreeViewOverflow | null | undefined): boolean {
	return Boolean(
		overflow &&
		(overflow.top > 0 || overflow.right > 0 || overflow.bottom > 0 || overflow.left > 0),
	);
}

/** Whether two overflows differ. */
export function threeViewOverflowChanged(a: ThreeViewOverflow, b: ThreeViewOverflow): boolean {
	return a.top !== b.top || a.right !== b.right || a.bottom !== b.bottom || a.left !== b.left;
}

/** The drawing buffer size of a view grown by its overflow. */
export function overflowPixelSize(
	size: ThreeViewSize,
	overflow: ThreeViewOverflow,
): { width: number; height: number } {
	const clamp = (px: number): number => Math.max(1, Math.min(MAX_VIEW_PIXELS, Math.round(px)));
	return {
		width: clamp(size.pixelWidth * (1 + overflow.left + overflow.right)),
		height: clamp(size.pixelHeight * (1 + overflow.top + overflow.bottom)),
	};
}

/**
 * The camera view offset (three's `setViewOffset` arguments) that frames the
 * grown buffer: the element box stays the camera's full frame, and the
 * sub-window starts `left`/`top` before it and is correspondingly larger.
 */
export function overflowViewOffset(
	size: ThreeViewSize,
	overflow: ThreeViewOverflow,
): { fullWidth: number; fullHeight: number; x: number; y: number; width: number; height: number } {
	const fullWidth = Math.max(1, size.pixelWidth);
	const fullHeight = Math.max(1, size.pixelHeight);
	return {
		fullWidth,
		fullHeight,
		x: -overflow.left * fullWidth,
		y: -overflow.top * fullHeight,
		width: fullWidth * (1 + overflow.left + overflow.right),
		height: fullHeight * (1 + overflow.top + overflow.bottom),
	};
}

/**
 * CSS for the canvas of a view with an overflow: percentages of the element
 * box, so it tracks the box without re-measuring. Empty for no overflow.
 */
export function overflowCanvasCss(overflow: ThreeViewOverflow): string {
	if (!hasThreeViewOverflow(overflow)) {
		return '';
	}
	const pct = (v: number): string => `${Number((v * 100).toFixed(4))}%`;
	return [
		`left:${pct(-overflow.left)}`,
		`top:${pct(-overflow.top)}`,
		`width:${pct(1 + overflow.left + overflow.right)}`,
		`height:${pct(1 + overflow.top + overflow.bottom)}`,
	].join(';');
}
