/**
 * viewer-presentation-mode.service.ts: Viewer-scoped state + logic for the
 * fullscreen slideshow and presenter (speaker) view overlays: their visibility
 * flags, the presenter-view elapsed-timer start time, opening/closing a
 * separate audience window, mapping a (possibly custom-show-filtered)
 * presentation-overlay index back to the full-deck active slide, and the
 * keep/discard-annotations prompt shown when a slideshow with ink on it exits.
 *
 * Extracted from {@link PowerPointViewerComponent}: the component binds the few
 * accessors it alone owns (active-slide-index get/set, the editing-id clear,
 * the source bytes for the audience hand-off, canEdit, and the keep-annotations
 * prompt trigger) via {@link bind}; the template reads the signals / invokes the
 * handlers off the injected instance directly (same pattern as `session`/`xport`).
 *
 * Provide it once on the viewer component (`providers: [ViewerPresentationModeService]`).
 */

import { inject, Injectable, signal } from '@angular/core';

import { LoadContentService } from './load-content.service';
import type { SlideAnnotationMap } from './presentation-annotations-helpers';
import { PresenterWindowService } from './presenter-window.service';
import { ViewerCustomShowsService } from './viewer-custom-shows.service';

/** Live host accessors the presentation-mode controller needs. */
interface PresentationModeHost {
	readonly slideCount: () => number;
	readonly activeSlideIndex: () => number;
	readonly setActiveSlideIndex: (index: number) => void;
	readonly clearEditing: () => void;
	readonly clearSelection: () => void;
	readonly sourceContent: () => Uint8Array | ArrayBuffer | null;
	readonly canEdit: () => boolean;
	readonly promptKeepAnnotations: (map: SlideAnnotationMap) => void;
}

@Injectable()
export class ViewerPresentationModeService {
	private readonly loader = inject(LoadContentService);
	private readonly presenterWindow = inject(PresenterWindowService);
	private readonly customShowsCtl = inject(ViewerCustomShowsService);

	/** Fullscreen presentation-mode overlay visibility. */
	readonly presenting = signal(false);
	/** Presenter-view (speaker) overlay visibility. */
	readonly presentingPresenter = signal(false);
	/** Epoch ms when presenter view started (drives the elapsed timer). */
	readonly presenterStartTime = signal<number | null>(null);

	private host: PresentationModeHost | null = null;

	/** Wire the host accessors (called once from the component constructor). */
	bind(host: PresentationModeHost): void {
		this.host = host;
	}

	private requireHost(): PresentationModeHost {
		if (!this.host) {
			throw new Error('ViewerPresentationModeService.bind() was not called');
		}
		return this.host;
	}

	/** Open the fullscreen presentation overlay from the current slide. */
	present(): void {
		const host = this.requireHost();
		if (host.slideCount() > 0) {
			// Deselect first so no edit chrome (selection outline / resize + rotate
			// "Adjust shape" handles) leaks over the slideshow.
			host.clearSelection();
			host.clearEditing();
			this.presenting.set(true);
		}
	}

	/**
	 * Map a presentation-overlay index back to the full-deck `activeSlideIndex`.
	 * The overlay's index is relative to the (possibly custom-show-filtered)
	 * presentation slides, so resolve by slide id to keep the editor selection
	 * correct when the show closes.
	 */
	onPresentationIndexChange(index: number): void {
		const host = this.requireHost();
		const target = this.customShowsCtl.presentationSlides()[index];
		if (!target) {
			return;
		}
		const fullIndex = this.loader.slides().findIndex((s) => s.id === target.id);
		host.setActiveSlideIndex(fullIndex >= 0 ? fullIndex : index);
	}

	/**
	 * Open a separate audience tab and hand off the deck via the shared
	 * IndexedDB store. Mirrors React's presenter "open audience window".
	 */
	openAudienceWindow(): void {
		const host = this.requireHost();
		this.presenterWindow.openAudienceWindow(host.sourceContent(), host.activeSlideIndex());
	}

	/** Open the presenter (speaker) view: current+next slide, notes, timer. */
	presentPresenter(): void {
		const host = this.requireHost();
		if (host.slideCount() > 0) {
			this.presenterStartTime.set(Date.now());
			this.presentingPresenter.set(true);
		}
	}

	/** Close the presenter view (and any audience overlay/window it opened). */
	exitPresenter(): void {
		this.presentingPresenter.set(false);
		this.presenting.set(false);
		this.presenterWindow.closeAudienceWindow();
	}

	/** Presentation exited with ink on it: offer the keep/discard prompt. */
	onPresentationAnnotationsExit(map: SlideAnnotationMap): void {
		const host = this.requireHost();
		if (host.canEdit()) {
			host.promptKeepAnnotations(map);
		}
	}
}
