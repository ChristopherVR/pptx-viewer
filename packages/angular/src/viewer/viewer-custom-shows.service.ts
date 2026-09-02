/**
 * viewer-custom-shows.service.ts: Viewer-scoped state + logic for user-defined
 * custom shows (named, ordered slide subsets) and the presentation-mode slide
 * resolution that depends on them. Owns the custom-shows dialog visibility, the
 * active-show id, and derives the slides/start-index the presentation overlay
 * renders.
 *
 * The SHOWS themselves are not owned here: they live on
 * {@link LoadContentService.customShows} in the package's own key space, which
 * is what makes them both seeded from the loaded deck and carried through save.
 * This service is the editing surface over that list, translating between the
 * package's relationship ids and the dialog's slide ids (see
 * `custom-shows-deck.ts`, and note that writing a slide's archive path into
 * `p:sld/@r:id` produces a package PowerPoint refuses to open).
 *
 * The subset a running show visits is likewise NOT computed here: the overlay
 * gets the whole deck plus {@link activeCustomShow}, and the shared
 * `resolveShowSlideIndexes` rule decides which slides it visits. Hand-rolling
 * that subset locally is how Angular ended up ignoring hidden slides inside a
 * custom show.
 *
 * Extracted from {@link PowerPointViewerComponent}: the component binds the live
 * active-slide-index accessor via {@link bind} (used to start a normal show at
 * the current slide) and the template reads the signals / invokes the handlers
 * off the injected instance.
 *
 * Provide it once on the viewer component (`providers: [ViewerCustomShowsService]`).
 */

import { computed, inject, Injectable, signal } from '@angular/core';
import type { PptxCustomShow, PptxSlide } from 'pptx-viewer-core';

import {
	firstShowSlideIndex,
	generateCustomShowId,
	presentationEntrySlideIndex,
	resolveAuthoredCustomShowId,
	resolveShowSlideIndexes,
} from '../internal/shared';
import type { AuthoredSlideRange, CustomShow, ShowOrderCustomShow } from '../internal/shared';
import {
	activeCustomShowMembership,
	customShowsFromDeck,
	customShowsToDeck,
} from './custom-shows-deck';
import { LoadContentService } from './load-content.service';

@Injectable()
export class ViewerCustomShowsService {
	private readonly loader = inject(LoadContentService);

	/** Whether the custom-shows dialog is open. */
	readonly showDialog = signal(false);
	/** The id of the currently active custom show, or null. */
	readonly activeId = signal<string | null>(null);

	/** Active-slide index of the host viewer (bound from the component). */
	private activeSlideIndex: () => number = () => 0;

	/**
	 * The viewer's LIVE (edited) slides accessor, bound from the component. The
	 * presentation overlay must reflect in-session edits (inserted media, moved
	 * shapes, etc.), so it reads these rather than the pristine loaded deck
	 * (`loader.slides()`), mirroring React/Vue where present mode shows the
	 * working set. Defaults to the loaded slides until bound.
	 */
	private liveSlides: () => readonly PptxSlide[] = () => this.loader.slides();

	/** Wire the host's active-slide-index + live-slides accessors (called once from the constructor). */
	bind(accessors: {
		activeSlideIndex: () => number;
		liveSlides: () => readonly PptxSlide[];
	}): void {
		this.activeSlideIndex = accessors.activeSlideIndex;
		this.liveSlides = accessors.liveSlides;
	}

	/** The deck's shows in the dialog's key space (slide ids, not relationship ids). */
	readonly shows = computed<readonly CustomShow[]>(() =>
		customShowsFromDeck(this.loader.customShows(), this.liveSlides()),
	);

	/** Custom shows in the core shape consumed by set-up-slide-show and by save. */
	readonly pptxCustomShows = computed<PptxCustomShow[]>(() =>
		this.loader.customShows().map((show) => ({ ...show, slideRIds: [...show.slideRIds] })),
	);

	/**
	 * The running show's membership for the shared show-order rule, or `null`
	 * when the whole deck is playing.
	 */
	readonly activeCustomShow = computed<ShowOrderCustomShow | null>(() =>
		activeCustomShowMembership(this.loader.customShows(), this.activeId()),
	);

	/**
	 * Slides handed to the presentation overlay: always the whole (live) deck.
	 * The custom-show subset is applied by the shared show-order rule, which the
	 * overlay runs against {@link activeCustomShow}.
	 */
	readonly presentationSlides = computed<PptxSlide[]>(() => [...this.liveSlides()]);

	/**
	 * Start index into {@link presentationSlides}: always the editor's active
	 * slide, which the show itself keeps up to date through `indexChange`.
	 *
	 * It must NOT be pinned to the custom show's first slide. `startIndex` is a
	 * live input, not a constructor argument: the overlay re-adopts it whenever
	 * it changes, and an audience display mirrors the presenter through it. While
	 * this returned the show's first slide it never changed, so the overlay's
	 * "adopt a host-pushed index" effect - which re-runs on the overlay's OWN
	 * index too - snapped every advance straight back to slide 1, and Angular
	 * alone could not leave the first slide of a custom show.
	 *
	 * Where a custom show STARTS is a one-shot seed instead, taken as the show
	 * opens; see {@link showEntryIndex}.
	 */
	readonly presentationStartIndex = computed<number>(() => this.activeSlideIndex());

	/**
	 * The slide a show should OPEN on: the active slide when the show (the
	 * active custom show plus the deck's authored `p:showPr/p:sldRg` range, if
	 * any) includes it, else the closest show slide at or after it, else the
	 * show's own first slide. Read once, when the show starts.
	 *
	 * This is "From Current Slide" / the status-bar "Slide show" button /
	 * `setMode('present')`. A deck authored `p:sldRg st="2" end="3"` used to
	 * open on the editor's active slide unconditionally, which put a slide the
	 * author took out of the show on screen first.
	 */
	showEntryIndex(authoredRange?: AuthoredSlideRange | null): number {
		const showIndexes = resolveShowSlideIndexes(
			this.liveSlides(),
			this.activeCustomShow(),
			authoredRange,
		);
		return presentationEntrySlideIndex(this.activeSlideIndex(), showIndexes);
	}

	/**
	 * The show's own first slide ("From Beginning" / F5), honouring the active
	 * custom show and the deck's authored range the same way {@link showEntryIndex}
	 * does. Unlike `showEntryIndex`, this ignores the current active slide
	 * entirely: PowerPoint's "From Beginning" always opens the show's first
	 * slide, even when the editor is parked somewhere else in (or outside) it.
	 */
	showFirstIndex(authoredRange?: AuthoredSlideRange | null): number {
		const showIndexes = resolveShowSlideIndexes(
			this.liveSlides(),
			this.activeCustomShow(),
			authoredRange,
		);
		return firstShowSlideIndex(showIndexes) ?? 0;
	}

	/**
	 * The show a running `ppaction://customshow?id=<id>[&return=true]` action
	 * left pending: the show + slide to restore once the SUB-show it switched
	 * to runs off its end (PowerPoint's "Resume last slide viewed after showing
	 * this custom show"). `null` when no such action is in flight.
	 */
	private readonly pendingReturn = signal<{ originId: string | null; originIndex: number } | null>(
		null,
	);

	/**
	 * Run `ppaction://customshow?id=<id>[&return=true]`: switch the active
	 * custom show to `customShowId` (an id naming no surviving show is a
	 * no-op, returning `null`) and resolve the deck index its show should open
	 * on. When `returnAfter` is true, remembers the origin show + slide so
	 * {@link consumeReturnAfterOnEnd} can restore it once the sub-show ends.
	 *
	 * @returns The deck index to navigate to, or `null` for an unresolvable id.
	 */
	runCustomShow(customShowId: string, returnAfter: boolean): number | null {
		const show = this.loader.customShows().find((candidate) => candidate.id === customShowId);
		if (!show) {
			return null;
		}
		if (returnAfter) {
			this.pendingReturn.set({ originId: this.activeId(), originIndex: this.activeSlideIndex() });
		}
		this.activeId.set(customShowId);
		return (
			firstShowSlideIndex(
				resolveShowSlideIndexes(this.liveSlides(), { slideRIds: show.slideRIds }),
			) ?? 0
		);
	}

	/**
	 * The running show just reached its end (`endOfShowChange` from the
	 * overlay). If a `runCustomShow(..., returnAfter: true)` is pending,
	 * restores the origin show and reports the origin slide to navigate back
	 * to; otherwise a no-op (`null`), leaving the ordinary end-of-show screen
	 * up.
	 */
	consumeReturnAfterOnEnd(): number | null {
		const pending = this.pendingReturn();
		if (!pending) {
			return null;
		}
		this.pendingReturn.set(null);
		this.activeId.set(pending.originId);
		return pending.originIndex;
	}

	/**
	 * Adopt the loaded deck's authored show selection.
	 *
	 * `p:showPr/p:custShow/@id` is PowerPoint's "Set Up Slide Show > Custom show"
	 * radio, and it is authored intent. Every binding parsed it and then played
	 * the whole deck anyway. Called once per load; a manual pick made afterwards
	 * simply overwrites {@link activeId} and wins until the next deck arrives.
	 */
	seedFromDeck(): void {
		this.activeId.set(
			resolveAuthoredCustomShowId(
				this.loader.presentationProperties(),
				this.loader.customShows(),
			) ?? null,
		);
	}

	onCreate(show: { name: string; slideIds: string[] }): void {
		const created: CustomShow = {
			id: generateCustomShowId(),
			name: show.name.trim(),
			slideIds: [...show.slideIds],
		};
		this.commit([...this.shows(), created]);
	}

	onRemove(id: string): void {
		this.commit(this.shows().filter((s) => s.id !== id));
		if (this.activeId() === id) {
			this.activeId.set(null);
		}
	}

	onUpdate(show: { id: string; name: string; slideIds: string[] }): void {
		this.commit(
			this.shows().map((s) =>
				s.id === show.id ? { ...s, name: show.name, slideIds: show.slideIds } : s,
			),
		);
	}

	/** Write an edited list back into the deck's key space (relationship ids). */
	private commit(shows: readonly CustomShow[]): void {
		this.loader.customShows.set(customShowsToDeck(shows, this.liveSlides()));
	}
}
