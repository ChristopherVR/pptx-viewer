import {
	firstShowSlideIndex,
	hasShowSlideAfter,
	lastShowSlideIndex,
	nextShowSlideIndex,
	previousShowSlideIndex,
	resolveShowSlideIndexes,
	zoomInScale,
	zoomOutScale,
} from 'pptx-viewer-shared';

import type { RenderController } from './render-controller';
import { clampSlideIndex } from './state';
import type { Store, ViewerState, ZoomLevel } from './state';

/**
 * Bounds on the ABSOLUTE stage scale the store holds, which is the user zoom
 * multiplied by the fit-to-viewport scale. They are deliberately wider than the
 * shared `clampZoomScale` bounds (which constrain the fit-relative user zoom,
 * where fit === 100%): on a small viewport a legal 20% user zoom is a far
 * smaller absolute scale, and clamping it with the user-zoom rule would pin the
 * stage at the wrong size.
 */
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

/**
 * Navigation + zoom controls for the vanilla viewer, factored out of
 * `PptxViewer` so the orchestrator class stays within its file-size budget.
 * Pure store/renderer plumbing: slide clamping and zoom-scale math only.
 */
export interface ViewerControls {
	next(): void;
	prev(): void;
	/** Jump to the show's first slide (Home). */
	firstSlide(): void;
	/** Jump to the show's last slide (End). */
	lastSlide(): void;
	goToSlide(index: number): void;
	slideCount(): number;
	currentSlide(): number;
	zoom(): number;
	setZoom(zoom: ZoomLevel): void;
	zoomIn(): void;
	zoomOut(): void;
	zoomToFit(): void;
}

export function createViewerControls(
	store: Store<ViewerState>,
	renderer: RenderController,
	/** Ends the show; called when the end screen is dismissed forward. */
	onEndShow?: () => void,
	/**
	 * File > Options > Advanced > "End with black slide". PowerPoint's default is
	 * ON: running past the last slide raises the black end screen and only the
	 * NEXT forward input ends the show. Off ends it at once. Read lazily because
	 * the options controller is constructed after these controls.
	 */
	getEndWithBlackSlide?: () => boolean | undefined,
): ViewerControls {
	/**
	 * The deck indexes a running show visits: every slide the author did not hide.
	 * PowerPoint's "Hide Slide" keeps the slide in the deck, the thumbnail rail
	 * and the sorter but skips it while presenting, so this is consulted only by
	 * `next` / `prev` / Home / End and never by `goToSlide`.
	 */
	const showOrder = (): number[] => resolveShowSlideIndexes(store.get().slides);

	/**
	 * Jump straight to a deck index. Deliberately NOT filtered by the show order:
	 * PowerPoint's typed "slide number + Enter" reaches a hidden slide on purpose.
	 */
	const goToSlide = (index: number, enteringBackward = false): void => {
		store.set({
			currentSlide: clampSlideIndex(index, store.get().slides.length),
			endOfShow: false,
			enteringBackward,
		});
	};
	const setZoom = (zoom: ZoomLevel): void => {
		store.set({
			zoom: zoom === 'fit' ? 'fit' : Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM),
		});
	};
	return {
		// While presenting, a "next" first reveals the current slide's next
		// on-click animation build; only once the timeline is exhausted does the
		// slide advance. Backward navigation just jumps slides (matches Vue).
		next: () => {
			const state = store.get();
			// While the end screen is up a forward input ends the show (PowerPoint's
			// "click to exit"); it never advances anything.
			if (state.endOfShow) {
				store.set({ endOfShow: false });
				onEndShow?.();
				return;
			}
			if (state.presenting && renderer.presentationPlayback.advance()) {
				return;
			}
			const order = showOrder();
			if (state.presenting && !hasShowSlideAfter(state.currentSlide, order)) {
				if (getEndWithBlackSlide?.() === false) {
					// No black slide configured: PowerPoint ends the show outright
					// rather than sitting on the last slide swallowing every advance.
					onEndShow?.();
					return;
				}
				// Nothing further to advance to: raise the black end screen rather
				// than sitting on the last slide ignoring every further advance.
				store.set({ endOfShow: true });
				return;
			}
			// Outside a show the deck pages one slide at a time (hidden slides are
			// still editable and still reachable); inside one the show order rules.
			goToSlide(
				state.presenting
					? (nextShowSlideIndex(state.currentSlide, order) ?? state.currentSlide)
					: state.currentSlide + 1,
			);
		},
		prev: () => {
			// A backward input while the end screen is up just dismisses it.
			if (store.get().endOfShow) {
				store.set({ endOfShow: false });
				return;
			}
			// A slide entered backward shows its builds already complete. The next
			// back press replays them from the start rather than leaving the slide,
			// so a presenter who overshot can watch the build again (PowerPoint).
			if (store.get().presenting && renderer.presentationPlayback.isSeededCompleted()) {
				renderer.presentationPlayback.replayCurrentSlide(document);
				return;
			}
			const state = store.get();
			goToSlide(
				state.presenting
					? (previousShowSlideIndex(state.currentSlide, showOrder()) ?? state.currentSlide)
					: state.currentSlide - 1,
				state.presenting,
			);
		},
		// Home / End land on the show's first / last slide, so a deck whose first
		// or last slide is hidden does not open one on a key PowerPoint reads as
		// "go to the start / end of the show".
		firstSlide: () => {
			const state = store.get();
			goToSlide(state.presenting ? (firstShowSlideIndex(showOrder()) ?? 0) : 0);
		},
		lastSlide: () => {
			const state = store.get();
			goToSlide(
				state.presenting
					? (lastShowSlideIndex(showOrder()) ?? state.slides.length - 1)
					: state.slides.length - 1,
			);
		},
		goToSlide,
		slideCount: () => store.get().slides.length,
		currentSlide: () => store.get().currentSlide,
		zoom: () => renderer.effectiveScale(),
		setZoom,
		// The store holds an ABSOLUTE scale, but the shared step (like React's) is
		// relative to fit, where fit === 100%. So step the fit-relative factor and
		// multiply it back out; stepping the absolute scale would make one press
		// worth a different amount of zoom in every viewport size.
		zoomIn: () => setZoom(renderer.fitScale() * zoomInScale(renderer.zoomPercent() / 100)),
		zoomOut: () => setZoom(renderer.fitScale() * zoomOutScale(renderer.zoomPercent() / 100)),
		zoomToFit: () => setZoom('fit'),
	};
}
