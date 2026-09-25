/**
 * What a binding draws while a picture is in crop mode, as one descriptor.
 *
 * The overlay is a layer positioned exactly over the picture's box, rotated
 * with it, with overflow visible. Inside it, in the box's own pixels:
 * - `ghost`: the WHOLE image, drawn dimmed, clipped so it shows only outside
 *   the frame (the cropped-away part PowerPoint greys out). It is also the
 *   pan target: dragging it moves the image behind the frame.
 * - `frame`: the crop frame outline (the box itself).
 * - `handles`: the eight black crop handles, corner L-shapes and edge bars,
 *   each with its own box, SVG path, cursor and handle id.
 *
 * Handle sizes are divided by the stage zoom so they stay the same size on
 * screen at every zoom level, like selection handles do.
 *
 * @module render/picture-crop/crop-overlay
 */
import type { PptxElement } from 'pptx-viewer-core';

import { beginCropDrag } from './crop-geometry';
import type { CropHandleId } from './crop-geometry';

/** A box relative to the picture's top-left, in slide pixels. */
export interface CropOverlayBox {
	left: number;
	top: number;
	width: number;
	height: number;
}

/** One crop handle to draw. */
export interface CropOverlayHandle extends CropOverlayBox {
	id: CropHandleId;
	/** Black filled SVG path in the handle box's own coordinates. */
	path: string;
	cursor: string;
}

/** The whole crop-mode overlay. */
export interface CropOverlayDescriptor {
	ghost: CropOverlayBox & {
		/**
		 * CSS `clip-path` for the ghost WRAPPER (a box at left/top/width/height):
		 * everything except the frame.
		 */
		clipPath: string;
		/**
		 * CSS transform for the `<img>` INSIDE the wrapper (filling it), mirroring
		 * a flipped picture; '' when not flipped. Kept off the wrapper so the
		 * clip's hole stays in display coordinates.
		 */
		transform: string;
		opacity: number;
	};
	frame: CropOverlayBox;
	handles: CropOverlayHandle[];
}

/** Screen-pixel length of a corner handle arm / an edge bar. */
export const CROP_HANDLE_LENGTH_PX = 18;
/** Screen-pixel thickness of a crop handle. */
export const CROP_HANDLE_THICKNESS_PX = 5;
/** Opacity of the cropped-away (outside the frame) part of the image. */
export const CROP_GHOST_OPACITY = 0.4;

const CURSORS: Record<CropHandleId, string> = {
	nw: 'nwse-resize',
	n: 'ns-resize',
	ne: 'nesw-resize',
	e: 'ew-resize',
	se: 'nwse-resize',
	s: 'ns-resize',
	sw: 'nesw-resize',
	w: 'ew-resize',
};

/** Position (fraction of the frame) of each handle, in drawing order. */
const HANDLE_ANCHORS: ReadonlyArray<[CropHandleId, number, number]> = [
	['nw', 0, 0],
	['n', 0.5, 0],
	['ne', 1, 0],
	['e', 1, 0.5],
	['se', 1, 1],
	['s', 0.5, 1],
	['sw', 0, 1],
	['w', 0, 0.5],
];

function fmt(n: number): string {
	return String(Math.round(n * 1000) / 1000);
}

/**
 * A handle drawn INSIDE the frame from its anchor, as PowerPoint draws them:
 * an L hugging each corner, a bar centred on each edge.
 */
function handleFor(
	id: CropHandleId,
	fx: number,
	fy: number,
	frameW: number,
	frameH: number,
	len: number,
	thick: number,
): CropOverlayHandle {
	const isCorner = fx !== 0.5 && fy !== 0.5;
	const width = fx === 0.5 ? len : isCorner ? len : thick;
	const height = fy === 0.5 ? len : isCorner ? len : thick;
	const left = fx === 0 ? 0 : fx === 1 ? frameW - width : frameW / 2 - width / 2;
	const top = fy === 0 ? 0 : fy === 1 ? frameH - height : frameH / 2 - height / 2;
	let path = `M0 0 H${fmt(width)} V${fmt(height)} H0 Z`;
	if (isCorner) {
		// An L whose outer corner sits on the frame corner.
		const x0 = fx === 0 ? 0 : len;
		const y0 = fy === 0 ? 0 : len;
		const sx = fx === 0 ? 1 : -1;
		const sy = fy === 0 ? 1 : -1;
		const pts: Array<[number, number]> = [
			[x0, y0],
			[x0 + sx * len, y0],
			[x0 + sx * len, y0 + sy * thick],
			[x0 + sx * thick, y0 + sy * thick],
			[x0 + sx * thick, y0 + sy * len],
			[x0, y0 + sy * len],
		];
		path = `M${pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(' L')} Z`;
	}
	return { id, left, top, width, height, path, cursor: CURSORS[id] };
}

/** The crop-mode overlay for `el` at stage zoom `zoom` (1 = 100%). */
export function buildCropOverlay(el: PptxElement, zoom = 1): CropOverlayDescriptor {
	const start = beginCropDrag(el);
	const { frame, image } = start;
	const scale = zoom > 0 ? 1 / zoom : 1;
	const len = Math.min(CROP_HANDLE_LENGTH_PX * scale, frame.width / 3, frame.height / 3);
	const thick = Math.min(CROP_HANDLE_THICKNESS_PX * scale, len / 2);
	const ghost = {
		left: image.x - frame.x,
		top: image.y - frame.y,
		width: image.width,
		height: image.height,
	};
	// The frame's box inside the ghost's own coordinates, cut out even-odd.
	const hx = frame.x - image.x;
	const hy = frame.y - image.y;
	const outer = `M0 0 H${fmt(image.width)} V${fmt(image.height)} H0 Z`;
	const hole = `M${fmt(hx)} ${fmt(hy)} H${fmt(hx + frame.width)} V${fmt(hy + frame.height)} H${fmt(hx)} Z`;
	const flips = [
		start.flipHorizontal ? 'scaleX(-1)' : '',
		start.flipVertical ? 'scaleY(-1)' : '',
	].filter(Boolean);
	return {
		ghost: {
			...ghost,
			clipPath: `path(evenodd, "${outer} ${hole}")`,
			transform: flips.join(' '),
			opacity: CROP_GHOST_OPACITY,
		},
		frame: { left: 0, top: 0, width: frame.width, height: frame.height },
		handles: HANDLE_ANCHORS.map(([id, fx, fy]) =>
			handleFor(id, fx, fy, frame.width, frame.height, len, thick),
		),
	};
}
