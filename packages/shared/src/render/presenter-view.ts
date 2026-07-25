/**
 * presenter-view.ts: pure presenter-view helpers shared across bindings.
 *
 * Time formatting, notes font-size clamping, and rich-text notes -> render-spec
 * conversion. DOM-free; each binding renders the returned `NotesSpan[]` spec
 * into its own `<span>`/`<br>` nodes.
 */

import type { TextSegment } from 'pptx-viewer-core';

import type { PresentationPointerTool } from './presentation-session-types';

/**
 * Whether a click on the presenter console's current-slide pane should advance
 * the show.
 *
 * PowerPoint's presenter console advances when you click the big slide, which
 * is how presenters actually drive a deck - the Next button and the keyboard
 * are the fallbacks, not the primary control. The exception is an active
 * drawing tool: pen, highlighter and eraser own the pointer, so clicking then
 * annotates instead of jumping the deck out from under the stroke. The laser
 * only tracks the cursor and does not consume clicks, so it still advances.
 */
export function presenterPaneAdvancesOnClick(tool: PresentationPointerTool | undefined): boolean {
	return tool === undefined || tool === 'none' || tool === 'laser';
}

/** Minimum font size (px) for speaker notes in presenter view. */
export const NOTES_FONT_SIZE_MIN = 10;

/** Maximum font size (px) for speaker notes in presenter view. */
export const NOTES_FONT_SIZE_MAX = 32;

/** Step increment (px) when increasing/decreasing notes font size. */
export const NOTES_FONT_SIZE_STEP = 2;

/** Default font size (px) for speaker notes. */
export const NOTES_FONT_SIZE_DEFAULT = 14;

/** Clamp a notes font size to the allowed range. */
export function clampNotesFontSize(size: number): number {
	return Math.max(NOTES_FONT_SIZE_MIN, Math.min(NOTES_FONT_SIZE_MAX, size));
}

/** Format a Date as a locale time string (HH:MM:SS). */
export function formatTime(date: Date): string {
	return date.toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
}

/**
 * Format a millisecond duration as `MM:SS`, or `HH:MM:SS` once the elapsed time
 * reaches one hour.
 */
export function formatElapsed(elapsedMs: number): string {
	const totalSeconds = Math.floor(elapsedMs / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) {
		return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}
	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** A render-spec node for a rich-text notes segment. */
export type NotesSpan =
	| { kind: 'break'; key: string }
	| { kind: 'text'; key: string; text: string; style: Record<string, string> };

/**
 * Convert rich-text notes segments into a framework-agnostic render spec. Each
 * binding maps each entry to a `<br>` or styled `<span>`.
 */
export function notesSegmentsToSpans(segments: TextSegment[]): NotesSpan[] {
	return segments.map((segment, index) => {
		if (segment.isParagraphBreak) {
			return { kind: 'break', key: `br-${index}` };
		}
		const style: Record<string, string> = {};
		if (segment.style.bold) {
			style.fontWeight = 'bold';
		}
		if (segment.style.italic) {
			style.fontStyle = 'italic';
		}
		if (segment.style.underline) {
			style.textDecoration = 'underline';
		}
		if (segment.style.strikethrough) {
			style.textDecoration = `${style.textDecoration ? `${style.textDecoration} ` : ''}line-through`;
		}
		if (segment.style.color) {
			style.color = segment.style.color;
		}
		if (segment.style.fontSize) {
			style.fontSize = `${segment.style.fontSize}pt`;
		}
		if (segment.style.fontFamily) {
			style.fontFamily = segment.style.fontFamily;
		}
		return { kind: 'text', key: `seg-${index}`, text: segment.text, style };
	});
}
