/**
 * The geometry of PowerPoint's on-canvas picture crop.
 *
 * In crop mode two rectangles matter: the FRAME (the element's box, what stays
 * visible) and the IMAGE (the whole bitmap, cropped-away parts included).
 * `a:srcRect` ties them together: each inset is the fraction of the image cut
 * off that side, so `image = frame` grown by those fractions. Dragging a black
 * crop handle moves a frame edge while the image stays put; dragging inside the
 * frame pans the image while the frame stays put. Both reduce to "new frame,
 * new image, recompute the insets", which is all this module does.
 *
 * Everything here is in the element's own (unrotated) axes; a binding with a
 * rotated picture converts pointer deltas with {@link toElementAxes} first.
 *
 * @module render/picture-crop/crop-geometry
 */
import type { PptxElement } from 'pptx-viewer-core';

/** An axis-aligned rectangle in slide pixels. */
export interface CropRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** The four `a:srcRect` insets as fractions of the image (negative pads). */
export interface CropInsets {
	cropLeft: number;
	cropTop: number;
	cropRight: number;
	cropBottom: number;
}

/** What a crop edit writes back onto the picture element. */
export type CropElementUpdate = CropInsets & CropRect;

/** One of the eight crop handles, named by compass direction. */
export type CropHandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Smallest frame a handle drag may leave, in slide pixels. */
export const MIN_CROP_FRAME_PX = 8;

function finite(value: number | undefined): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** The element's current insets, missing ones read as zero. */
export function readCropInsets(el: PptxElement): CropInsets {
	const src = el as Partial<CropInsets>;
	return {
		cropLeft: finite(src.cropLeft),
		cropTop: finite(src.cropTop),
		cropRight: finite(src.cropRight),
		cropBottom: finite(src.cropBottom),
	};
}

/** The element's box. */
export function cropFrameOf(el: PptxElement): CropRect {
	return { x: el.x, y: el.y, width: el.width, height: el.height };
}

/** The whole image's rectangle, derived from the frame and the insets. */
export function imageRectFromCrop(frame: CropRect, insets: CropInsets): CropRect {
	const spanX = 1 - insets.cropLeft - insets.cropRight;
	const spanY = 1 - insets.cropTop - insets.cropBottom;
	const width = spanX > 1e-6 ? frame.width / spanX : frame.width;
	const height = spanY > 1e-6 ? frame.height / spanY : frame.height;
	return {
		x: frame.x - insets.cropLeft * width,
		y: frame.y - insets.cropTop * height,
		width,
		height,
	};
}

function round4(n: number): number {
	return Math.round(n * 10000) / 10000;
}

/** The insets that show `frame` out of `image`, plus the frame itself. */
export function cropUpdateFromRects(frame: CropRect, image: CropRect): CropElementUpdate {
	return {
		x: frame.x,
		y: frame.y,
		width: frame.width,
		height: frame.height,
		cropLeft: round4((frame.x - image.x) / image.width),
		cropTop: round4((frame.y - image.y) / image.height),
		cropRight: round4((image.x + image.width - frame.x - frame.width) / image.width),
		cropBottom: round4((image.y + image.height - frame.y - frame.height) / image.height),
	};
}

/**
 * Where a crop drag starts: the frame and image when the pointer went down, in
 * DISPLAY terms (a flipped picture shows its `a:srcRect/@l` inset on the right)
 * and in the element's unrotated axes.
 */
export interface CropDragStart {
	frame: CropRect;
	image: CropRect;
	rotation: number;
	flipHorizontal: boolean;
	flipVertical: boolean;
}

/** Swap insets between source (`a:srcRect`) and display sides for a flip. */
function flipInsets<T extends CropInsets>(insets: T, flipH: boolean, flipV: boolean): T {
	return {
		...insets,
		cropLeft: flipH ? insets.cropRight : insets.cropLeft,
		cropRight: flipH ? insets.cropLeft : insets.cropRight,
		cropTop: flipV ? insets.cropBottom : insets.cropTop,
		cropBottom: flipV ? insets.cropTop : insets.cropBottom,
	};
}

/** Snapshot an element for a crop drag. */
export function beginCropDrag(el: PptxElement): CropDragStart {
	const frame = cropFrameOf(el);
	const flipHorizontal = el.flipHorizontal === true;
	const flipVertical = el.flipVertical === true;
	const display = flipInsets(readCropInsets(el), flipHorizontal, flipVertical);
	return {
		frame,
		image: imageRectFromCrop(frame, display),
		rotation: el.rotation ?? 0,
		flipHorizontal,
		flipVertical,
	};
}

/**
 * The element update for a new display frame/image pair: insets mapped back
 * to source sides, and the box moved so that, for a rotated picture, the
 * edges that did not move stay where they are on screen.
 */
export function finishCropUpdate(
	start: CropDragStart,
	frame: CropRect,
	image: CropRect,
): CropElementUpdate {
	const update = flipInsets(
		cropUpdateFromRects(frame, image),
		start.flipHorizontal,
		start.flipVertical,
	);
	if (!start.rotation) {
		return update;
	}
	const old = start.frame;
	const dcx = frame.x + frame.width / 2 - (old.x + old.width / 2);
	const dcy = frame.y + frame.height / 2 - (old.y + old.height / 2);
	const a = (start.rotation * Math.PI) / 180;
	const cx = old.x + old.width / 2 + dcx * Math.cos(a) - dcy * Math.sin(a);
	const cy = old.y + old.height / 2 + dcx * Math.sin(a) + dcy * Math.cos(a);
	return { ...update, x: cx - frame.width / 2, y: cy - frame.height / 2 };
}

const MOVES: Record<
	CropHandleId,
	{ left: boolean; top: boolean; right: boolean; bottom: boolean }
> = {
	nw: { left: true, top: true, right: false, bottom: false },
	n: { left: false, top: true, right: false, bottom: false },
	ne: { left: false, top: true, right: true, bottom: false },
	e: { left: false, top: false, right: true, bottom: false },
	se: { left: false, top: false, right: true, bottom: true },
	s: { left: false, top: false, right: false, bottom: true },
	sw: { left: true, top: false, right: false, bottom: true },
	w: { left: true, top: false, right: false, bottom: false },
};

/**
 * Drag crop handle `handle` by (`dx`, `dy`) element-axis pixels. The frame edge
 * follows the pointer but stays on the image (no outward crop) and never
 * shrinks the frame below {@link MIN_CROP_FRAME_PX}.
 */
export function dragCropHandle(
	start: CropDragStart,
	handle: CropHandleId,
	dx: number,
	dy: number,
): CropElementUpdate {
	const { frame, image } = start;
	const move = MOVES[handle];
	let left = frame.x;
	let top = frame.y;
	let right = frame.x + frame.width;
	let bottom = frame.y + frame.height;
	const imageRight = image.x + image.width;
	const imageBottom = image.y + image.height;
	if (move.left) {
		left = Math.min(Math.max(left + dx, Math.min(image.x, left)), right - MIN_CROP_FRAME_PX);
	}
	if (move.right) {
		right = Math.max(Math.min(right + dx, Math.max(imageRight, right)), left + MIN_CROP_FRAME_PX);
	}
	if (move.top) {
		top = Math.min(Math.max(top + dy, Math.min(image.y, top)), bottom - MIN_CROP_FRAME_PX);
	}
	if (move.bottom) {
		bottom = Math.max(
			Math.min(bottom + dy, Math.max(imageBottom, bottom)),
			top + MIN_CROP_FRAME_PX,
		);
	}
	return finishCropUpdate(
		start,
		{ x: left, y: top, width: right - left, height: bottom - top },
		image,
	);
}

/**
 * Pan the image by (`dx`, `dy`) behind a fixed frame. When the image covers
 * the frame the pan stops at the image's edges, as PowerPoint's does.
 */
export function panCropImage(start: CropDragStart, dx: number, dy: number): CropElementUpdate {
	const { frame, image } = start;
	const clampAxis = (pos: number, size: number, framePos: number, frameSize: number): number => {
		if (size < frameSize) {
			return pos;
		}
		return Math.min(framePos, Math.max(framePos + frameSize - size, pos));
	};
	const moved = {
		...image,
		x: clampAxis(image.x + dx, image.width, frame.x, frame.width),
		y: clampAxis(image.y + dy, image.height, frame.y, frame.height),
	};
	return finishCropUpdate(start, frame, moved);
}

/** Convert a slide-space pointer delta into the element's rotated axes. */
export function toElementAxes(dx: number, dy: number, rotationDeg = 0): { dx: number; dy: number } {
	if (!rotationDeg) {
		return { dx, dy };
	}
	const a = (-rotationDeg * Math.PI) / 180;
	return { dx: dx * Math.cos(a) - dy * Math.sin(a), dy: dx * Math.sin(a) + dy * Math.cos(a) };
}

/** True when the element currently shows any crop or pad. */
export function hasCrop(el: PptxElement): boolean {
	const insets = readCropInsets(el);
	return (
		insets.cropLeft !== 0 ||
		insets.cropTop !== 0 ||
		insets.cropRight !== 0 ||
		insets.cropBottom !== 0
	);
}
