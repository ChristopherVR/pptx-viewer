/**
 * Pure helpers for the gradient picker editor control, shared by every binding.
 *
 * Readers extract current gradient values from a PptxElement (falling back to
 * sensible defaults), and patch-builders produce shallow-merge-ready
 * `Partial<PptxElement>` objects safe to pass to each binding's element-update
 * action.
 *
 * No framework imports; every type is concrete or `unknown` + narrowed.
 */

import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

// -- Defaults -----------------------------------------------------------------

const DEFAULT_STOP_A: GradientStop = { color: '#4472c4', position: 0, opacity: 1 };
const DEFAULT_STOP_B: GradientStop = { color: '#ffffff', position: 100, opacity: 1 };

// -- Types --------------------------------------------------------------------

/** A single gradient stop, mirroring the ShapeStyle array item shape. */
export interface GradientStop {
	color: string;
	position: number;
	opacity?: number;
}

/** The editable gradient state surfaced to the component. */
export interface GradientState {
	type: 'linear' | 'radial';
	/** Angle in degrees (only meaningful for linear). */
	angle: number;
	stops: GradientStop[];
}

// -- Readers ------------------------------------------------------------------

/**
 * Extract the current GradientState from an element's shapeStyle.
 * Falls back to a two-stop linear gradient when no gradient is configured.
 */
export function gradientStateOf(el: PptxElement): GradientState {
	if (!hasShapeProperties(el)) {
		return defaultGradientState();
	}
	const ss = el.shapeStyle;
	return gradientStateFromStyle(ss);
}

/**
 * Extract a GradientState from a raw ShapeStyle, without needing the element.
 * Useful when the caller already holds the style reference.
 */
export function gradientStateFromStyle(ss: ShapeStyle | undefined): GradientState {
	const type: 'linear' | 'radial' = ss?.fillGradientType ?? 'linear';
	const angle = typeof ss?.fillGradientAngle === 'number' ? ss.fillGradientAngle : 90;
	const rawStops = ss?.fillGradientStops ?? [];
	const stops = sanitizeStops(rawStops.length >= 2 ? rawStops : [DEFAULT_STOP_A, DEFAULT_STOP_B]);
	return { type, angle, stops };
}

/** Whether the element currently has an active gradient fill. */
export function hasGradientFill(el: PptxElement): boolean {
	if (!hasShapeProperties(el)) {
		return false;
	}
	return el.shapeStyle?.fillMode === 'gradient';
}

// -- Patch builders -----------------------------------------------------------

/**
 * Build a Partial<PptxElement> that merges updated gradient state into the
 * element's existing shapeStyle. Activates fillMode = 'gradient' and preserves
 * all other shapeStyle fields.
 */
export function gradientStatePatch(el: PptxElement, state: GradientState): Partial<PptxElement> {
	const base: ShapeStyle = hasShapeProperties(el) ? (el.shapeStyle ?? {}) : {};
	return {
		shapeStyle: {
			...base,
			fillMode: 'gradient',
			fillGradientType: state.type,
			fillGradientAngle: state.angle,
			fillGradientStops: state.stops.map((s) => ({
				color: s.color,
				position: s.position,
				opacity: s.opacity,
			})),
		},
	} as Partial<PptxElement>;
}

/**
 * Build a Partial<PptxElement> that adds a new stop to the existing gradient.
 * The new stop is inserted at `position` (0-100) with `color`.
 */
export function addGradientStopPatch(
	el: PptxElement,
	color: string,
	position: number,
): Partial<PptxElement> {
	const state = gradientStateOf(el);
	const clampedPos = Math.max(0, Math.min(100, position));
	const newStop: GradientStop = { color, position: clampedPos, opacity: 1 };
	const next = sortStops([...state.stops, newStop]);
	return gradientStatePatch(el, { ...state, stops: next });
}

/**
 * Build a Partial<PptxElement> that removes the stop at `index` (only when
 * at least two stops would remain after removal).
 */
export function removeGradientStopPatch(
	el: PptxElement,
	index: number,
): Partial<PptxElement> | null {
	const state = gradientStateOf(el);
	if (state.stops.length <= 2) {
		return null; // must keep at least 2 stops
	}
	const next = state.stops.filter((_, i) => i !== index);
	return gradientStatePatch(el, { ...state, stops: next });
}

/**
 * Build a Partial<PptxElement> that updates a single stop at `index`.
 */
export function updateGradientStopPatch(
	el: PptxElement,
	index: number,
	changes: Partial<GradientStop>,
): Partial<PptxElement> {
	const state = gradientStateOf(el);
	const stops = state.stops.map((s, i) => (i === index ? { ...s, ...changes } : s));
	return gradientStatePatch(el, { ...state, stops: sortStops(stops) });
}

// -- Private helpers ----------------------------------------------------------

function defaultGradientState(): GradientState {
	return { type: 'linear', angle: 90, stops: [{ ...DEFAULT_STOP_A }, { ...DEFAULT_STOP_B }] };
}

function sortStops(stops: GradientStop[]): GradientStop[] {
	return stops.slice().sort((a, b) => a.position - b.position);
}

function sanitizeStops(
	raw: Array<{ color: string; position: number; opacity?: number }>,
): GradientStop[] {
	const valid = raw.filter(
		(s) =>
			typeof s.color === 'string' &&
			s.color.trim().length > 0 &&
			typeof s.position === 'number' &&
			Number.isFinite(s.position),
	);
	const mapped: GradientStop[] = valid.map((s) => ({
		color: s.color,
		position: Math.max(0, Math.min(100, s.position)),
		opacity: typeof s.opacity === 'number' && Number.isFinite(s.opacity) ? s.opacity : undefined,
	}));
	return sortStops(mapped);
}
