/**
 * Pure editing helpers for a chart's drawing-overlay shapes (`c:userShapes`).
 *
 * Framework-neutral so every binding's chart inspector (React, Vue, Angular,
 * Svelte, vanilla) drives the same "Chart overlay shapes" section off one
 * source of truth: list the current overlays as a flat descriptor, build a
 * default text-box shape for "Add text box", convert a canvas-pixel drag
 * rect into the fractional anchor core expects, and validate an anchor
 * before it is written back through `updateChartUserShape`.
 *
 * @module render/chart-user-shape-edit
 */
import type { PptxChartUserShape } from 'pptx-viewer-core';

/** EMU per CSS pixel at 96 DPI, mirroring core's `EMU_PER_PIXEL`. */
const EMU_PER_PIXEL = 9525;

/** A flattened, inspector-friendly view of one overlay shape. */
export interface ChartUserShapeDescriptor {
	/** Index into `chartData.userShapes`; the id used by every mutation callback. */
	index: number;
	kind: PptxChartUserShape['kind'];
	anchor: 'rel' | 'abs';
	from: { x: number; y: number };
	to?: { x: number; y: number };
	ext?: { cx: number; cy: number };
	fill?: string;
	stroke?: string;
	/** Joined paragraph text, for a compact list-row label. */
	text?: string;
	/** Whether an inspector can move/resize/recolour this kind (only `sp`/`cxnSp` are editable). */
	editable: boolean;
}

/**
 * Build the inspector's list of overlay-shape descriptors from a chart's
 * typed `userShapes`, in document order.
 */
export function listChartUserShapeDescriptors(
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined,
): ChartUserShapeDescriptor[] {
	return (userShapes ?? []).map((shape, index) => ({
		index,
		kind: shape.kind,
		anchor: shape.anchor,
		from: shape.from,
		to: shape.to,
		ext: shape.ext,
		fill: shape.fill,
		stroke: shape.stroke,
		text: shape.paragraphs
			?.map((p) => p.text)
			.filter((t) => t.length > 0)
			.join(' '),
		editable: shape.kind === 'sp' || shape.kind === 'cxnSp',
	}));
}

/**
 * A ready-to-insert text-box overlay shape, centred over the plot at a
 * modest default size, matching what "Add text box" offers in every
 * binding's inspector.
 */
export function createDefaultChartUserShape(): PptxChartUserShape {
	return {
		kind: 'sp',
		anchor: 'rel',
		from: { x: 0.35, y: 0.4 },
		to: { x: 0.65, y: 0.55 },
		prst: 'rect',
		fill: '#FFFFCC',
		stroke: '#808080',
		strokeWidth: 0.75,
		paragraphs: [{ text: 'Text', align: 'ctr' }],
	};
}

/** Clamp a fraction into the valid `[0, 1]` anchor range. */
function clampFraction(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/**
 * Convert a chart-canvas pixel rect (from an on-canvas drag/resize) into a
 * `relSizeAnchor`'s `from`/`to` fractions.
 *
 * @param rect - The dragged rect in chart-canvas pixels.
 * @param canvas - The chart canvas size in pixels.
 */
export function pixelRectToRelAnchor(
	rect: { x: number; y: number; w: number; h: number },
	canvas: { w: number; h: number },
): Pick<PptxChartUserShape, 'from' | 'to'> {
	if (canvas.w <= 0 || canvas.h <= 0) {
		return { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } };
	}
	return {
		from: { x: clampFraction(rect.x / canvas.w), y: clampFraction(rect.y / canvas.h) },
		to: {
			x: clampFraction((rect.x + rect.w) / canvas.w),
			y: clampFraction((rect.y + rect.h) / canvas.h),
		},
	};
}

/**
 * Convert a chart-canvas pixel rect into an `absSizeAnchor`'s `from`
 * fraction plus its EMU extent.
 */
export function pixelRectToAbsAnchor(
	rect: { x: number; y: number; w: number; h: number },
	canvas: { w: number; h: number },
): Pick<PptxChartUserShape, 'from' | 'ext'> {
	if (canvas.w <= 0 || canvas.h <= 0) {
		return { from: { x: 0, y: 0 }, ext: { cx: 0, cy: 0 } };
	}
	return {
		from: { x: clampFraction(rect.x / canvas.w), y: clampFraction(rect.y / canvas.h) },
		ext: { cx: Math.max(0, rect.w) * EMU_PER_PIXEL, cy: Math.max(0, rect.h) * EMU_PER_PIXEL },
	};
}

/**
 * Append a new overlay shape, returning a fresh array for the binding to
 * hand to its `onUpdateChartData({ userShapes: ... })` (or equivalent)
 * callback. Mirrors core's `addChartUserShape` SDK op, but operates directly
 * on the array so a binding's inspector does not need to fabricate a
 * throwaway `ChartPptxElement` just to call it.
 */
export function withChartUserShapeAdded(
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined,
	shape: PptxChartUserShape,
): PptxChartUserShape[] {
	return [...(userShapes ?? []), shape];
}

/** Patch one overlay shape's fields by index. Mirrors core's `updateChartUserShape`. */
export function withChartUserShapeUpdated(
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined,
	index: number,
	patch: Partial<PptxChartUserShape>,
): PptxChartUserShape[] {
	return (userShapes ?? []).map((shape, i) => (i === index ? { ...shape, ...patch } : shape));
}

/** Remove one overlay shape by index. Mirrors core's `removeChartUserShape`. */
export function withChartUserShapeRemoved(
	userShapes: ReadonlyArray<PptxChartUserShape> | undefined,
	index: number,
): PptxChartUserShape[] {
	return (userShapes ?? []).filter((_, i) => i !== index);
}

/**
 * Validate a (possibly partial) overlay-shape anchor edit before it is
 * applied via `updateChartUserShape`.
 *
 * @returns An error message, or `undefined` when the anchor is well-formed.
 */
export function validateChartUserShapeAnchor(
	shape: Pick<PptxChartUserShape, 'anchor' | 'from' | 'to' | 'ext'>,
): string | undefined {
	if (!shape.from || !Number.isFinite(shape.from.x) || !Number.isFinite(shape.from.y)) {
		return 'A chart overlay shape needs a valid anchor position.';
	}
	if (shape.anchor === 'rel') {
		if (!shape.to || !Number.isFinite(shape.to.x) || !Number.isFinite(shape.to.y)) {
			return 'A relative-size overlay anchor needs a valid opposite corner.';
		}
		if (shape.to.x <= shape.from.x || shape.to.y <= shape.from.y) {
			return "The overlay shape's opposite corner must be below and to the right of its origin.";
		}
	} else if (shape.anchor === 'abs') {
		if (!shape.ext || shape.ext.cx <= 0 || shape.ext.cy <= 0) {
			return 'An absolute-size overlay anchor needs a positive width and height.';
		}
	}
	return undefined;
}
