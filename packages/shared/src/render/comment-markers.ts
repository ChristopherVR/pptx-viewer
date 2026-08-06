/**
 * Framework-agnostic canvas comment-marker model.
 *
 * Builds the numbered marker-dot descriptors every binding draws over the
 * slide canvas: the position comes from {@link getCommentMarkerPosition}
 * (explicit comment x/y clamped to the slide, else a 4-column grid fallback),
 * the label is the 1-based comment number, and the title is
 * `"<author>: <text>"`, the neutral hook the cross-binding e2e suite reads.
 *
 * No framework imports; each binding renders these descriptors inside its
 * `aria-roledescription="slide"` stage.
 */

import type { PptxComment } from 'pptx-viewer-core';

import { getCommentMarkerPosition } from './element';

/** Rendered diameter of a marker dot, in unscaled slide px. */
export const COMMENT_MARKER_SIZE = 20;

/** Marker dot fill shared by every binding (orange, slightly translucent). */
export const COMMENT_MARKER_COLOR = 'rgba(255, 165, 0, 0.9)';

/** One renderable marker dot. */
export interface CommentMarkerDescriptor {
	/** Id of the comment the dot represents (click payload). */
	commentId: string;
	/** 1-based comment number rendered inside the dot. */
	label: string;
	/** Dot CENTER x, in unscaled slide coordinates. */
	x: number;
	/** Dot CENTER y, in unscaled slide coordinates. */
	y: number;
	/** Tooltip text: `"<author>: <text>"`. */
	title: string;
}

/** The marker tooltip: `"<author>: <text>"`, falling back for blank authors. */
export function commentMarkerTitle(comment: PptxComment, fallbackAuthor: string): string {
	return `${comment.author || fallbackAuthor}: ${comment.text}`;
}

/**
 * Map a slide's comments to renderable marker descriptors.
 * @param fallbackAuthor label used in the tooltip when a comment has no author
 *   (bindings pass their localized "Unknown" string).
 */
export function buildCommentMarkers(
	comments: readonly PptxComment[],
	canvasWidth: number,
	canvasHeight: number,
	fallbackAuthor: string,
): CommentMarkerDescriptor[] {
	return comments.map((comment, index) => {
		const pos = getCommentMarkerPosition(comment, index, canvasWidth, canvasHeight);
		return {
			commentId: comment.id,
			label: String(index + 1),
			x: pos.x,
			y: pos.y,
			title: commentMarkerTitle(comment, fallbackAuthor),
		};
	});
}
