/**
 * presenter-view-helpers.ts
 *
 * Helpers for `PresenterViewComponent`: rich-notes segment -> view-model
 * derivation, elapsed-time derivation, and current/next-slide selection.
 *
 * Everything genuinely pure now lives in `pptx-viewer-shared` and is re-exported
 * here so existing Angular imports of `./presenter-view-helpers` keep resolving.
 * The three forks this file used to carry are gone, and each of them was a real
 * divergence rather than a stylistic one:
 *
 *  - `formatElapsed` clamped negative input while shared's did not, so the two
 *    disagreed on a snapshot restored from a peer with a future start time. The
 *    clamp now happens where the elapsed value is COMPUTED (see
 *    {@link elapsedSince} and the presentation toolbar), which is the only place
 *    that can tell a negative duration from a legitimate one.
 *  - `computeTimerProgress` / `TIMER_SEGMENT_MS` re-derived the console's
 *    five-minute progress segment that shared now owns as
 *    `presenterTimerProgress` / `PRESENTER_TIMER_SEGMENT_MS`.
 *  - `buildNotesSegments` emitted `font-size` in **px** where shared's
 *    `notesSegmentsToSpans` emits **pt**, so a 12pt notes run rendered at 12px
 *    in Angular and 16px in every other binding. It now delegates and only
 *    rewrites the camelCase keys into the kebab-case {@link StyleMap} the
 *    Angular template binds through `ngStyle`; the UNIT is shared's.
 *
 * Kept TestBed-free (vitest + happy-dom). ng-packagr lib-target constraints:
 * no `String.prototype.replaceAll`, no `Array.prototype.at`/`findLastIndex`,
 * no regex named-capture-groups.
 *
 * `slideLabel` accepts an optional `TranslateService` so callers with access
 * to one get translated text; callers without one (e.g. plain unit tests)
 * still get the English fallback.
 */
import type { TranslateService } from '@ngx-translate/core';
import type { PptxSlide, TextSegment } from 'pptx-viewer-core';

import { nextPresentedSlide, notesSegmentsToSpans } from '../internal/shared';
import type { StyleMap } from './element-style';
import { cssObjectToStyleMap } from './table-renderer-helpers';

export {
	clampNotesFontSize,
	formatElapsed,
	formatTime,
	NOTES_FONT_SIZE_DEFAULT,
	NOTES_FONT_SIZE_MAX,
	NOTES_FONT_SIZE_MIN,
	NOTES_FONT_SIZE_STEP,
	PRESENTER_TIMER_SEGMENT_MS,
	presenterTimerProgress,
} from '../internal/shared';
export type { PresenterTimerProgress } from '../internal/shared';

// ---------------------------------------------------------------------------
// Elapsed time from a start timestamp
// ---------------------------------------------------------------------------

/**
 * Compute the elapsed milliseconds between `startTime` (epoch ms, or null when
 * the presentation has not started) and `now`. Returns 0 when no start time is
 * set or the clock has not advanced past the start.
 *
 * This clamp is why shared's `formatElapsed` needs none: a duration handed to
 * the formatter has already been resolved against a wall clock here.
 */
export function elapsedSince(startTime: number | null, now: number): number {
	if (startTime === null || startTime === undefined) {
		return 0;
	}
	const delta = now - startTime;
	return delta > 0 ? delta : 0;
}

// ---------------------------------------------------------------------------
// Current / next slide selection
// ---------------------------------------------------------------------------

/**
 * Return the slide at `index`, or undefined when the index is out of range.
 */
export function currentSlideAt(slides: readonly PptxSlide[], index: number): PptxSlide | undefined {
	if (index < 0 || index >= slides.length) {
		return undefined;
	}
	return slides[index];
}

/**
 * Return the slide the show would advance to from `index`, or undefined at the
 * end of the deck.
 *
 * Delegates to the shared `nextPresentedSlide`, which is what makes the
 * next-slide preview agree with the show itself: it skips hidden slides and
 * honours custom-show membership, neither of which a naive `slides[index + 1]`
 * can do.
 */
export function nextSlideAfter(slides: readonly PptxSlide[], index: number): PptxSlide | undefined {
	return nextPresentedSlide(slides, index);
}

/** "Slide 3 of 12" style label for the current position. */
export function slideLabel(index: number, total: number, translate?: TranslateService): string {
	if (translate) {
		return translate.instant('pptx.presenter.slideLabel', { current: index + 1, total });
	}
	return `Slide ${index + 1} of ${total}`;
}

/** "3 / 12" compact counter label. */
export function slideCounter(index: number, total: number): string {
	return `${index + 1} / ${total}`;
}

// ---------------------------------------------------------------------------
// Notes derivation
// ---------------------------------------------------------------------------

/** A single rendered notes token for the presenter notes pane. */
export interface NotesSegmentViewModel {
	/** Stable key for `@for` tracking. */
	key: string;
	/** True when this token is a paragraph break (rendered as a line break). */
	isBreak: boolean;
	/** Plain text to render (empty for breaks). */
	text: string;
	/** Inline style derived from the segment's text style. */
	style: StyleMap;
}

/**
 * Derive notes view-model tokens from rich-text `TextSegment`s.
 *
 * The styling rules (which properties, in which units) belong to shared's
 * `notesSegmentsToSpans`; all this adds is the camelCase -> kebab-case rewrite
 * the Angular `ngStyle` binding is written against.
 */
export function buildNotesSegments(segments: readonly TextSegment[]): NotesSegmentViewModel[] {
	return notesSegmentsToSpans([...segments]).map((span) =>
		span.kind === 'break'
			? { key: span.key, isBreak: true, text: '', style: {} }
			: {
					key: span.key,
					isBreak: false,
					text: span.text,
					style: cssObjectToStyleMap(span.style),
				},
	);
}

export interface PresenterNotes {
	/** True when rich-text segments are available and non-empty. */
	hasRichNotes: boolean;
	/** Derived rich-text view-model tokens (empty when no rich notes). */
	segments: NotesSegmentViewModel[];
	/** Plain notes text (used when no rich segments are present). */
	plainText: string;
	/** True when there is any displayable notes content (rich or plain). */
	hasAnyNotes: boolean;
}

/**
 * Resolve the presenter notes for a slide: prefer rich `notesSegments`, else
 * fall back to the plain `notes` string. Mirrors the React PresenterView's
 * `hasRichNotes` / `notesText` branching.
 */
export function resolvePresenterNotes(slide: PptxSlide | undefined): PresenterNotes {
	const notesSegments = slide?.notesSegments;
	const hasRichNotes = notesSegments !== undefined && notesSegments.length > 0;
	const plainText = slide?.notes ?? '';
	const hasPlain = plainText.trim().length > 0;
	return {
		hasRichNotes,
		segments: hasRichNotes ? buildNotesSegments(notesSegments) : [],
		plainText,
		hasAnyNotes: hasRichNotes || hasPlain,
	};
}
