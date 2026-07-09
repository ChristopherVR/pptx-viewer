/**
 * presenter-view-helpers.ts
 *
 * Helpers for `PresenterViewComponent`: time/elapsed formatting, notes
 * font-size clamping, rich-notes segment → view-model derivation, timer
 * progress, and current/next-slide selection.
 *
 * The identical pure helpers (notes font-size constants, `clampNotesFontSize`,
 * `formatTime`) now live in `pptx-viewer-shared` and are re-exported here from
 * `../internal/shared` so existing Angular imports of
 * `./presenter-view-helpers` keep resolving.
 *
 * Kept LOCAL (intentionally diverging from shared):
 *  - `formatElapsed`: clamps negative input to zero (shared's does not).
 *  - `NotesSegmentViewModel` / `buildNotesSegments`: produce a kebab-case
 *    `StyleMap` with `px` font sizes for the Angular template, unlike shared's
 *    camelCase `NotesSpan` (`pt`).
 *
 * Kept TestBed-free (vitest + happy-dom). ng-packagr lib-target constraints:
 * no `String.prototype.replaceAll`, no regex named-capture-groups.
 *
 * `slideLabel` accepts an optional `TranslateService` so callers with access
 * to one get translated text; callers without one (e.g. plain unit tests)
 * still get the English fallback.
 */
import type { TranslateService } from '@ngx-translate/core';
import type { PptxSlide, TextSegment } from 'pptx-viewer-core';

import type { StyleMap } from './element-style';

export {
	clampNotesFontSize,
	formatTime,
	NOTES_FONT_SIZE_DEFAULT,
	NOTES_FONT_SIZE_MAX,
	NOTES_FONT_SIZE_MIN,
	NOTES_FONT_SIZE_STEP,
} from '../internal/shared';

// ---------------------------------------------------------------------------
// Time formatting (local: negative-clamping differs from shared)
// ---------------------------------------------------------------------------

/**
 * Format a millisecond duration as MM:SS, or HH:MM:SS when the elapsed
 * time is one hour or longer. Sub-second values are floored; negative inputs
 * are treated as zero.
 */
export function formatElapsed(elapsedMs: number): string {
	const safeMs = elapsedMs > 0 ? elapsedMs : 0;
	const totalSeconds = Math.floor(safeMs / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
	}
	return `${pad2(minutes)}:${pad2(seconds)}`;
}

/** Zero-pad a non-negative integer to at least two digits. */
function pad2(value: number): string {
	return String(value).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// Timer progress (5-minute segments)
// ---------------------------------------------------------------------------

/** Milliseconds per timer progress-bar fill (one 5-minute segment). */
export const TIMER_SEGMENT_MS = 5 * 60 * 1000;

export interface TimerProgress {
	/** Fill percentage of the current segment, clamped to [0, 100]. */
	percent: number;
	/** Zero-based index of the current 5-minute segment. */
	segment: number;
}

/**
 * Derive the timer progress-bar fill (percent within the current 5-minute
 * segment) and the segment index from an elapsed duration. Mirrors the React
 * PresenterView `timerProgress` / `timerSegment` computation.
 */
export function computeTimerProgress(elapsedMs: number): TimerProgress {
	const safeMs = elapsedMs > 0 ? elapsedMs : 0;
	const percent = Math.min(100, ((safeMs % TIMER_SEGMENT_MS) / TIMER_SEGMENT_MS) * 100);
	const segment = Math.floor(safeMs / TIMER_SEGMENT_MS);
	return { percent, segment };
}

// ---------------------------------------------------------------------------
// Elapsed time from a start timestamp
// ---------------------------------------------------------------------------

/**
 * Compute the elapsed milliseconds between `startTime` (epoch ms, or null when
 * the presentation has not started) and `now`. Returns 0 when no start time is
 * set or the clock has not advanced past the start.
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
 * Return the next slide (index + 1), or undefined when `index` is the last
 * slide. Note: presenter "next" preview is linear (does not skip hidden
 * slides), matching the React PresenterView.
 */
export function nextSlideAfter(slides: readonly PptxSlide[], index: number): PptxSlide | undefined {
	const nextIndex = index + 1;
	if (nextIndex < 0 || nextIndex >= slides.length) {
		return undefined;
	}
	return slides[nextIndex];
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
 * Derive a list of notes view-model tokens from rich-text `TextSegment`s,
 * mirroring the React `renderNotesSegments` styling rules. Paragraph breaks
 * become break tokens; styled runs carry an inline `StyleMap`.
 */
export function buildNotesSegments(segments: readonly TextSegment[]): NotesSegmentViewModel[] {
	return segments.map((segment, index) => {
		if (segment.isParagraphBreak) {
			return { key: `br-${index}`, isBreak: true, text: '', style: {} };
		}
		const style: StyleMap = {};
		const s = segment.style;
		if (s.bold) {
			style['font-weight'] = 'bold';
		}
		if (s.italic) {
			style['font-style'] = 'italic';
		}
		const decorations: string[] = [];
		if (s.underline) {
			decorations.push('underline');
		}
		if (s.strikethrough) {
			decorations.push('line-through');
		}
		if (decorations.length > 0) {
			style['text-decoration'] = decorations.join(' ');
		}
		if (s.color) {
			style['color'] = s.color;
		}
		if (s.fontSize) {
			style['font-size'] = `${s.fontSize}px`;
		}
		if (s.fontFamily) {
			style['font-family'] = s.fontFamily;
		}
		return { key: `seg-${index}`, isBreak: false, text: segment.text, style };
	});
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
