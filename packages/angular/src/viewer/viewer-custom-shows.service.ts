/**
 * viewer-custom-shows.service.ts: Viewer-scoped state + logic for user-defined
 * custom shows (named, ordered slide subsets) and the presentation-mode slide
 * resolution that depends on them. Owns the custom-shows dialog visibility, the
 * list of shows, the active-show id, and derives the slides/start-index the
 * presentation overlay renders.
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

import { createCustomShow } from './custom-shows-helpers';
import type { CustomShow } from './custom-shows-helpers';
import { LoadContentService } from './load-content.service';

@Injectable()
export class ViewerCustomShowsService {
	private readonly loader = inject(LoadContentService);

	/** Whether the custom-shows dialog is open. */
	readonly showDialog = signal(false);
	/** The list of user-defined custom shows for this session. */
	readonly shows = signal<readonly CustomShow[]>([]);
	/** The id of the currently active custom show, or null. */
	readonly activeId = signal<string | null>(null);

	/** Active-slide index of the host viewer (bound from the component). */
	private activeSlideIndex: () => number = () => 0;

	/** Wire the host's active-slide-index accessor (called once from the constructor). */
	bind(activeSlideIndex: () => number): void {
		this.activeSlideIndex = activeSlideIndex;
	}

	/** Custom shows mapped to the core shape consumed by set-up-slide-show. */
	readonly pptxCustomShows = computed<PptxCustomShow[]>(() =>
		this.shows().map((show) => ({
			id: show.id,
			name: show.name,
			slideRIds: [...show.slideIds],
		})),
	);

	/** Slides shown in presentation mode: the active custom show, else the full deck. */
	readonly presentationSlides = computed<PptxSlide[]>(
		() => this.resolveActiveShowSlides() ?? [...this.loader.slides()],
	);

	/** Start index into {@link presentationSlides}: first slide of a custom show, else the active slide. */
	readonly presentationStartIndex = computed<number>(() =>
		this.resolveActiveShowSlides() ? 0 : this.activeSlideIndex(),
	);

	onCreate(show: { name: string; slideIds: string[] }): void {
		this.shows.update((list) => [...list, createCustomShow(show.name, show.slideIds)]);
	}

	onRemove(id: string): void {
		this.shows.update((list) => list.filter((s) => s.id !== id));
		if (this.activeId() === id) {
			this.activeId.set(null);
		}
	}

	onUpdate(show: { id: string; name: string; slideIds: string[] }): void {
		this.shows.update((list) =>
			list.map((s) => (s.id === show.id ? { ...s, name: show.name, slideIds: show.slideIds } : s)),
		);
	}

	/**
	 * The active custom show's slides, in its defined order, or null when no show
	 * is active (or it resolves to nothing). Used to filter the presentation.
	 */
	private resolveActiveShowSlides(): PptxSlide[] | null {
		const id = this.activeId();
		if (!id) {
			return null;
		}
		const show = this.shows().find((s) => s.id === id);
		if (!show || show.slideIds.length === 0) {
			return null;
		}
		const byId = new Map(this.loader.slides().map((s) => [s.id, s]));
		const picked = show.slideIds
			.map((sid) => byId.get(sid))
			.filter((s): s is PptxSlide => s !== undefined);
		return picked.length > 0 ? picked : null;
	}
}
