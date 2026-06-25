/**
 * presenter-view-utils
 *
 * The pure presenter-view helpers (notes font-size constants/clamping, time and
 * elapsed formatting, and the framework-agnostic notes -> render-spec
 * conversion) now live in `pptx-viewer-shared` (`render/presenter-view`). This
 * file re-exports those and keeps only the React-specific
 * `renderNotesSegments`, which maps the shared `NotesSpan[]` spec into React
 * nodes.
 */
import type { TextSegment } from 'pptx-viewer-core';
import { notesSegmentsToSpans } from 'pptx-viewer-shared';
import React from 'react';

export {
	clampNotesFontSize,
	formatElapsed,
	formatTime,
	NOTES_FONT_SIZE_DEFAULT,
	NOTES_FONT_SIZE_MAX,
	NOTES_FONT_SIZE_MIN,
	NOTES_FONT_SIZE_STEP,
	notesSegmentsToSpans,
} from 'pptx-viewer-shared';

/**
 * Render rich-text notes segments into React nodes, consuming the shared
 * `notesSegmentsToSpans` render spec.
 */
export function renderNotesSegments(segments: TextSegment[]): React.ReactNode[] {
	return notesSegmentsToSpans(segments).map((span) => {
		if (span.kind === 'break') {
			return React.createElement('br', { key: span.key });
		}
		return React.createElement(
			'span',
			{ key: span.key, style: span.style as React.CSSProperties },
			span.text,
		);
	});
}
