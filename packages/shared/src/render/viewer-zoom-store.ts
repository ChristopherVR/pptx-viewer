/**
 * viewer-zoom-store.ts: the canvas zoom slice, on the shared viewer runtime.
 *
 * This is the first vertical slice migrated onto {@link createViewerCommandStore},
 * and it was chosen because the five bindings had genuinely diverged on how
 * "zoom" is even represented:
 *
 *   react    `scale` (1 = fit) plus a separately derived `fitScale`
 *   vue      `zoom` plus `fitScale`, product exposed as `effectiveZoom`
 *   angular  `zoom` signal only, fit factor hidden inside the canvas component
 *   svelte   `zoomPercent: number | null`, where null means fit
 *   vanilla  `zoom: number | 'fit'`
 *
 * Three encodings of "fit to viewport" across five bindings is exactly the
 * drift the parity rule exists to stop: it is why a zoom readout could be
 * correct in one app and wrong in another, and why "reset zoom" and "zoom to
 * fit" were subtly different operations depending on which binding you were in.
 *
 * The model here is one thing:
 *  - `zoom` is the USER's factor, where 1 means "whatever fits".
 *  - `fitScale` is the viewport measurement the binding feeds in (<= 1).
 *  - `manual` records whether the user has taken control, which is what
 *    separates "reset to 100%" from "fit to viewport" without needing a
 *    sentinel value smuggled into the number.
 *
 * On-screen scale is always the product, so a binding can never accidentally
 * render at the user factor and map pointer coordinates at the effective one.
 */
import { createViewerCommandStore } from './viewer-store';
import type { ViewerCommandStore } from './viewer-store';
import { clampZoomScale, zoomInScale, zoomOutScale } from './zoom-step';

export interface ViewerZoomState {
	/** The user's zoom factor. 1 means "fit to viewport", not "100% of natural size". */
	zoom: number;
	/** Fit-to-viewport factor measured by the binding's canvas (<= 1). */
	fitScale: number;
	/** True once the user has zoomed explicitly, false while following the viewport. */
	manual: boolean;
}

export type ViewerZoomCommand =
	| { type: 'zoom-in' }
	| { type: 'zoom-out' }
	/** Jump to an explicit user factor (clamped). Marks the zoom manual. */
	| { type: 'set-zoom'; zoom: number }
	/** Back to 1x the fit scale, and no longer manual. */
	| { type: 'zoom-to-fit' }
	/** Report a newly measured viewport fit factor. Never marks the zoom manual. */
	| { type: 'set-fit-scale'; fitScale: number };

export const DEFAULT_VIEWER_ZOOM_STATE: ViewerZoomState = {
	zoom: 1,
	fitScale: 1,
	manual: false,
};

function withZoom(state: ViewerZoomState, zoom: number): ViewerZoomState {
	const clamped = clampZoomScale(zoom);
	// Returning the SAME state when nothing moved keeps the store silent, so
	// holding zoom-out at the minimum does not re-render anything (issue #145).
	if (clamped === state.zoom && state.manual) {
		return state;
	}
	return { ...state, zoom: clamped, manual: true };
}

export function reduceViewerZoom(
	state: ViewerZoomState,
	command: ViewerZoomCommand,
): ViewerZoomState {
	switch (command.type) {
		case 'zoom-in':
			return withZoom(state, zoomInScale(state.zoom));
		case 'zoom-out':
			return withZoom(state, zoomOutScale(state.zoom));
		case 'set-zoom':
			return withZoom(state, command.zoom);
		case 'zoom-to-fit':
			return state.zoom === 1 && !state.manual ? state : { ...state, zoom: 1, manual: false };
		case 'set-fit-scale': {
			// A viewport measurement is not a user action: it must never flip
			// `manual`, or a window resize would silently look like a zoom.
			const fitScale =
				Number.isFinite(command.fitScale) && command.fitScale > 0 ? command.fitScale : 1;
			return fitScale === state.fitScale ? state : { ...state, fitScale };
		}
		default:
			return state;
	}
}

export type ViewerZoomStore = ViewerCommandStore<ViewerZoomState, ViewerZoomCommand>;

export function createViewerZoomStore(initial?: Partial<ViewerZoomState>): ViewerZoomStore {
	return createViewerCommandStore<ViewerZoomState, ViewerZoomCommand>(
		{ ...DEFAULT_VIEWER_ZOOM_STATE, ...initial },
		reduceViewerZoom,
	);
}

/** On-screen scale: the user factor applied on top of the viewport fit. */
export function effectiveZoomScale(state: ViewerZoomState): number {
	return state.fitScale * state.zoom;
}

/**
 * The user factor as a whole percentage, for a zoom readout.
 *
 * Takes the factor rather than the whole state so a binding can derive it from
 * just the `zoom` slice it subscribed to, instead of having to depend on (and
 * be re-rendered by) the rest of the zoom state.
 */
export function viewerZoomPercent(zoom: number): number {
	return Math.round(zoom * 100);
}
