/**
 * Comment marker dots rendered on top of the slide canvas.
 *
 * The descriptors (position clamped to the slide or a 4-column grid
 * fallback, 1-based numbering, and the `"<author>: <text>"` tooltip) come
 * from the shared `buildCommentMarkers`, so the dots match every other
 * binding (Vue, Angular, Svelte, Vanilla).
 */
import type { PptxComment } from 'pptx-viewer-core';
import { buildCommentMarkers, COMMENT_MARKER_SIZE } from 'pptx-viewer-shared';
import { useTranslation } from 'react-i18next';

import type { CanvasSize } from '../../types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CommentMarkersOverlayProps {
	comments: PptxComment[];
	canvasSize: CanvasSize;
	onCommentMarkerClick?: (commentId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CommentMarkersOverlay({
	comments,
	canvasSize,
	onCommentMarkerClick,
}: CommentMarkersOverlayProps) {
	const { t } = useTranslation(),
		half = COMMENT_MARKER_SIZE / 2,
		markers = buildCommentMarkers(
			comments,
			canvasSize.width,
			canvasSize.height,
			t('pptx.comments.unknownAuthor'),
		);
	return (
		<div className='absolute inset-0 pointer-events-none z-[45]'>
			{markers.map((marker) => (
				<div
					key={marker.commentId}
					className='absolute pointer-events-auto cursor-pointer'
					style={{
						left: marker.x - half,
						top: marker.y - half,
						width: COMMENT_MARKER_SIZE,
						height: COMMENT_MARKER_SIZE,
						borderRadius: '50%',
						backgroundColor: 'rgba(255, 165, 0, 0.9)',
						border: '2px solid #fff',
						boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						fontSize: 10,
						fontWeight: 700,
						color: '#fff',
						lineHeight: 1,
					}}
					title={marker.title}
					onClick={(e) => {
						e.stopPropagation();
						onCommentMarkerClick?.(marker.commentId);
					}}
				>
					{marker.label}
				</div>
			))}
		</div>
	);
}
