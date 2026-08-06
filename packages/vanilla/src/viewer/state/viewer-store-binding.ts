/**
 * Vanilla adapter for the shared selectively-subscribable viewer store.
 *
 * This binding has no reactivity system to adapt to: it repaints by calling
 * DOM-writing functions. The useful adapter is therefore "run this painter with
 * the current value, then again whenever it changes, and never otherwise",
 * which is what keeps an unrelated part of the viewer state moving from costing
 * a DOM write here (issue #145).
 *
 * The immediate first call is the point: an imperative binding otherwise has to
 * paint once by hand and subscribe separately, which is exactly how a painter
 * and its subscription drift apart.
 */
import type { ViewerStore, ViewerStoreEquality } from 'pptx-viewer-shared';

/**
 * Call `paint` with the selected value now, and again on every change to it.
 * Returns an unsubscribe function.
 */
export function watchViewerStore<S, T>(
	store: ViewerStore<S>,
	selector: (state: S) => T,
	paint: (value: T, previous: T | undefined) => void,
	isEqual?: ViewerStoreEquality<T>,
): () => void {
	paint(selector(store.getState()), undefined);
	return store.subscribeSelector(selector, paint, isEqual);
}
