/**
 * comments.service.ts — Angular port of the Vue `useComments` composable and
 * the React `useComments` hook (viewer-first subset).
 *
 * ## Data model & how comments link to slides
 *
 * In `pptx-viewer-core`, comments are stored **per slide** on
 * `PptxSlide.comments?: PptxComment[]`. The {@link PptxComment} interface itself
 * carries **no** slide-reference field (no `slideId`/`slideIndex`) — a comment's
 * owning slide is implied purely by which slide's `comments` array it lives in.
 *
 * Because of that, the "deck-wide list filtered to the active slide" is realised
 * by the **host**: it slices `slides[activeSlideIndex].comments` into the
 * `comments` signal here. This service therefore treats `comments` as the active
 * slide's comment list (the deck slice for `activeSlideIndex`) and the mutators
 * return the **new full comment array** for that slide, which the host writes
 * back history-aware (e.g. `slides[i].comments = next`).
 *
 * `activeSlideIndex` is retained for symmetry and so callers / marker-positioning
 * can reason about which slide is active.
 *
 * Provide it at the component level so its lifetime tracks the host viewer:
 * `@Component({ providers: [CommentsService] })`.
 *
 * No `any`; all regexes use the `/u` flag; framework-agnostic core types only.
 */

import { Injectable, computed, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import type { PptxComment } from 'pptx-viewer-core';

import {
	addCommentToList,
	removeCommentFromList,
	toggleCommentResolvedInList,
} from './comments-helpers';

export { generateCommentId } from './comments-helpers';

@Injectable()
export class CommentsService {
	/**
	 * The active slide's comments (the deck slice for `activeSlideIndex`).
	 * `PptxComment` has no slide field, so the host slices the per-slide
	 * `PptxSlide.comments` into this signal.
	 */
	private readonly _comments = signal<PptxComment[]>([]);
	/** Index of the slide whose comments these are. */
	private readonly _activeSlideIndex = signal(0);
	/** Display name written as the `author` of newly-created comments. */
	private readonly _authorName = signal('You');

	/** The active slide's comments (read-only mirror of the input signal). */
	readonly slideComments: Signal<PptxComment[]> = computed(() => this._comments());
	/** Index of the slide whose comments these are. */
	readonly activeSlideIndex: Signal<number> = computed(() => this._activeSlideIndex());
	/** Display name written as the `author` of newly-created comments. */
	readonly authorName: Signal<string> = computed(() => this._authorName());

	/** Set the active slide's comments (the deck slice for `activeSlideIndex`). */
	setComments(comments: PptxComment[] | null | undefined): void {
		this._comments.set(comments ?? []);
	}

	/** Set the index of the slide whose comments these are. */
	setActiveSlideIndex(index: number): void {
		this._activeSlideIndex.set(index);
	}

	/** Set the display name written as the `author` of newly-created comments. */
	setAuthorName(name: string): void {
		this._authorName.set(name);
	}

	/**
	 * Append a new comment to the active slide.
	 * @returns the NEW full comment array for the active slide, or `null` when
	 *   `text` is blank.
	 */
	addComment(text: string, x?: number, y?: number): PptxComment[] | null {
		return addCommentToList(this.slideComments(), text, this.authorName(), x, y);
	}

	/**
	 * Remove a comment (by id) from the active slide.
	 * @returns the NEW full comment array, or `null` when nothing changed.
	 */
	removeComment(id: string): PptxComment[] | null {
		return removeCommentFromList(this.slideComments(), id);
	}

	/**
	 * Toggle the `resolved` flag of a comment (by id) on the active slide.
	 * @returns the NEW full comment array, or `null` when nothing changed.
	 */
	resolveComment(id: string): PptxComment[] | null {
		return toggleCommentResolvedInList(this.slideComments(), id);
	}
}
