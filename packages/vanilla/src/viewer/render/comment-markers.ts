import type { PptxComment } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import { buildCommentMarkers, COMMENT_MARKER_SIZE } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from './dom';

/**
 * Append the numbered comment marker dots to a slide stage (Vanilla port of
 * React's `canvas/CommentMarkersOverlay.tsx` / Vue's
 * `CommentMarkersOverlay.vue`). The descriptors (position clamped to the
 * slide or a 4-column grid fallback, 1-based numbering, and the
 * `"<author>: <text>"` tooltip) come from the shared `buildCommentMarkers`,
 * so the dots match every other binding.
 *
 * The overlay lives INSIDE the stage (the `aria-roledescription="slide"`
 * region, the framework-neutral e2e hook), authored in raw slide coordinates
 * so the stage's CSS scale applies exactly once. The stage is rebuilt on
 * every store change, so the dots track the comment model with no
 * subscription of their own.
 */
export function appendCommentMarkers(
	doc: Document,
	stage: HTMLElement,
	comments: readonly PptxComment[],
	canvasSize: CanvasSize,
	t: Translator,
	onMarkerClick?: (commentId: string) => void,
): void {
	if (comments.length === 0) {
		return;
	}
	const overlay = createEl(doc, 'div', 'pptxv-comment-markers', {
		position: 'absolute',
		inset: '0',
		pointerEvents: 'none',
		zIndex: '45',
	});
	const markers = buildCommentMarkers(
		comments,
		canvasSize.width,
		canvasSize.height,
		t('pptx.comments.unknownAuthor'),
	);
	for (const marker of markers) {
		const dot = createEl(doc, 'button', 'pptxv-comment-marker', {
			position: 'absolute',
			left: `${marker.x - COMMENT_MARKER_SIZE / 2}px`,
			top: `${marker.y - COMMENT_MARKER_SIZE / 2}px`,
			width: `${COMMENT_MARKER_SIZE}px`,
			height: `${COMMENT_MARKER_SIZE}px`,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			padding: '0',
			pointerEvents: 'auto',
			cursor: 'pointer',
			borderRadius: '50%',
			background: 'rgba(255, 165, 0, 0.9)',
			border: '2px solid #fff',
			boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
			fontSize: '10px',
			fontWeight: '700',
			lineHeight: '1',
			color: '#fff',
		});
		dot.type = 'button';
		dot.title = marker.title;
		dot.textContent = marker.label;
		dot.addEventListener('click', (event) => {
			event.stopPropagation();
			onMarkerClick?.(marker.commentId);
		});
		overlay.appendChild(dot);
	}
	stage.appendChild(overlay);
}
