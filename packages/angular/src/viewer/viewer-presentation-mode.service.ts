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
 * This service owns no DOM node, so the real browser Fullscreen API request/exit
 * (mirroring React's `usePresentationMode` / Vue's `PresentationMode.vue`) is
 * driven by `PresentationOverlayComponent` itself off this `presenting` signal's
 * mount/unmount, not from here; see that component for the fullscreen wiring.
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
	readonly applyRehearsalTimings: (timings: Record<number, number>) => void;
}

export type RehearsalStart = 'beginning' | 'current';

/** Resolve the editor slide that a Record ribbon command should start from. */
export function resolveRehearsalStartIndex(
	start: RehearsalStart,
	currentIndex: number,
	slideCount: number,
): number {
	if (slideCount <= 0) {
		return 0;
	}
	return start === 'beginning' ? 0 : Math.min(Math.max(currentIndex, 0), slideCount - 1);
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
	readonly rehearsing = signal(false);
	readonly rehearsalPaused = signal(false);
	readonly showRehearsalSummary = signal(false);
	readonly rehearsalStartedAt = signal<number | null>(null);
	readonly slideStartedAt = signal<number | null>(null);
	readonly recordedTimings = signal<Record<number, number>>({});
	private pauseStartedAt: number | null = null;
	private pausedOnSlideMs = 0;

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

	/**
	 * Open the presentation overlay from the current slide. The overlay itself
	 * (`PresentationOverlayComponent`) requests real browser fullscreen once it
	 * mounts as a result of `presenting` flipping true.
	 */
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

	startRehearsalFromBeginning(): void {
		this.startRehearsal('beginning');
	}

	startRehearsalFromCurrent(): void {
		this.startRehearsal('current');
	}

	private startRehearsal(start: RehearsalStart): void {
		const host = this.requireHost();
		if (host.slideCount() <= 0) {
			return;
		}
		host.setActiveSlideIndex(
			resolveRehearsalStartIndex(start, host.activeSlideIndex(), host.slideCount()),
		);
		this.recordedTimings.set({});
		this.showRehearsalSummary.set(false);
		this.rehearsalPaused.set(false);
		this.rehearsing.set(true);
		this.pauseStartedAt = null;
		this.pausedOnSlideMs = 0;
		const now = Date.now();
		this.rehearsalStartedAt.set(now);
		this.slideStartedAt.set(now);
		this.present();
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
		if (this.rehearsing() && fullIndex !== host.activeSlideIndex()) {
			this.recordCurrentSlide();
			this.slideStartedAt.set(Date.now());
			this.pausedOnSlideMs = 0;
		}
		host.setActiveSlideIndex(fullIndex >= 0 ? fullIndex : index);
	}

	toggleRehearsalPause(): void {
		const now = Date.now();
		if (this.rehearsalPaused()) {
			this.pausedOnSlideMs += this.pauseStartedAt ? now - this.pauseStartedAt : 0;
			this.pauseStartedAt = null;
			this.rehearsalPaused.set(false);
		} else {
			this.pauseStartedAt = now;
			this.rehearsalPaused.set(true);
		}
	}

	closePresentation(): void {
		this.presenting.set(false);
		if (this.rehearsing()) {
			this.recordCurrentSlide();
			this.rehearsing.set(false);
			this.showRehearsalSummary.set(true);
		}
	}

	saveRehearsalTimings(): void {
		this.requireHost().applyRehearsalTimings(this.recordedTimings());
		this.dismissRehearsalSummary();
	}

	dismissRehearsalSummary(): void {
		this.showRehearsalSummary.set(false);
		this.rehearsing.set(false);
	}

	private recordCurrentSlide(): void {
		const host = this.requireHost();
		const started = this.slideStartedAt();
		if (started === null) {
			return;
		}
		const pausedNow = this.pauseStartedAt ? Date.now() - this.pauseStartedAt : 0;
		const elapsed = Math.max(0, Date.now() - started - this.pausedOnSlideMs - pausedNow);
		this.recordedTimings.update((current) => ({ ...current, [host.activeSlideIndex()]: elapsed }));
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
