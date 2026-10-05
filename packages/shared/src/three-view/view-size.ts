/**
 * Sizing for `<pptx-three-view>`: the element's own layout box, plus the
 * device-pixel backing size it should be drawn at.
 *
 * Slides are scaled with CSS transforms, which never change an element's
 * layout size, so `ResizeObserver` alone would draw a thumbnail at full slide
 * resolution and a 400%-zoomed slide blurry. The backing size therefore
 * follows the element's on-screen size times the device pixel ratio. That size
 * is the layout box times the composed scale of its ancestors' transforms, not
 * `getBoundingClientRect`: a rotated element's bounding rect is the axis-aligned
 * box around the turned element, which is a different size and aspect, so a
 * view that was rotated on the slide would be redrawn at that wrong shape.
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

/** The linear part of a 2D transform: `x' = a x + c y`, `y' = b x + d y`. */
export interface Linear2D {
	a: number;
	b: number;
	c: number;
	d: number;
}

const IDENTITY: Linear2D = { a: 1, b: 0, c: 0, d: 1 };

/** `outer` applied after `inner`. */
function compose(outer: Linear2D, inner: Linear2D): Linear2D {
	return {
		a: outer.a * inner.a + outer.c * inner.b,
		b: outer.b * inner.a + outer.d * inner.b,
		c: outer.a * inner.c + outer.c * inner.d,
		d: outer.b * inner.c + outer.d * inner.d,
	};
}

/**
 * The linear part of a computed `transform` (`matrix(...)` or `matrix3d(...)`,
 * the only forms `getComputedStyle` returns), or `null` for `none` or text it
 * cannot read.
 */
export function parseComputedTransform(value: string | undefined): Linear2D | null {
	const match = /^(matrix3d|matrix)\(([^)]*)\)$/u.exec((value ?? '').trim());
	if (!match) {
		return null;
	}
	const n = (match[2] ?? '').split(',').map((part) => Number.parseFloat(part));
	const at = match[1] === 'matrix3d' ? [0, 1, 4, 5] : [0, 1, 2, 3];
	const [a, b, c, d] = at.map((i) => n[i]);
	return [a, b, c, d].every((v) => v !== undefined && Number.isFinite(v))
		? { a: a as number, b: b as number, c: c as number, d: d as number }
		: null;
}

/** Scale factors of a 2D linear map, which a rotation leaves unchanged. */
export function matrixScale(m: Linear2D): { x: number; y: number } {
	return { x: Math.hypot(m.a, m.b), y: Math.hypot(m.c, m.d) };
}

/** The next element up the tree, stepping out of a shadow root onto its host. */
function parentOf(node: Element): Element | null {
	if (node.parentElement) {
		return node.parentElement;
	}
	const root = node.getRootNode?.();
	return root && 'host' in root ? ((root as ShadowRoot).host ?? null) : null;
}

/**
 * The scale the page applies to `element` through CSS transforms (`transform`
 * and the individual `scale` property) on it and its ancestors. Rotation and
 * translation do not change it.
 */
export function measureTransformScale(element: Element): { x: number; y: number } {
	const win = element.ownerDocument?.defaultView;
	if (!win) {
		return { x: 1, y: 1 };
	}
	let total = IDENTITY;
	for (let node: Element | null = element; node; node = parentOf(node)) {
		const style = win.getComputedStyle(node);
		if (style.scale && style.scale !== 'none') {
			const [sx = '1', sy = sx] = style.scale.split(/\s+/u);
			const x = Number.parseFloat(sx);
			const y = Number.parseFloat(sy);
			if (Number.isFinite(x) && Number.isFinite(y)) {
				total = compose({ a: x, b: 0, c: 0, d: y }, total);
			}
		}
		const transform = parseComputedTransform(style.transform);
		if (transform) {
			total = compose(transform, total);
		}
	}
	return matrixScale(total);
}

/** Measure an element's {@link ThreeViewSize}. */
export function measureThreeViewSize(element: HTMLElement): ThreeViewSize {
	const win = element.ownerDocument?.defaultView;
	const layoutWidth = element.clientWidth;
	const layoutHeight = element.clientHeight;
	// A detached or display:none element has no layout, so a zero layout size
	// gives a zero screen size and `computeThreeViewSize` draws at layout size.
	const scale = measureTransformScale(element);
	return computeThreeViewSize(
		layoutWidth,
		layoutHeight,
		layoutWidth * scale.x,
		layoutHeight * scale.y,
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
