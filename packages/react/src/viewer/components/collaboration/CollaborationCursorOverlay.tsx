/**
 * CollaborationCursorOverlay: Reads from the collaboration context,
 * broadcasts local cursor position on mouse move, and renders
 * `RemoteUserCursors` for other participants.
 *
 * This component is only mounted when collaboration is enabled.
 * It is rendered inside the `SlideCanvas` stage div.
 *
 * @module collaboration/CollaborationCursorOverlay
 */
import React, { useEffect, useRef } from 'react';

import type { CollaborationContextValue } from '../../hooks/collaboration/types';
import { useCollaboration } from './CollaborationProvider';
import { RemoteUserCursors } from './RemoteUserCursors';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CollaborationCursorOverlayProps {
	/** Headless hosts can supply the same state without mounting another provider. */
	collaboration?: CollaborationContextValue | null;
	activeSlideIndex: number;
	canvasWidth: number;
	canvasHeight: number;
	/** Currently selected element ID (broadcast to remote users). */
	selectedElementId?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CollaborationCursorOverlay({
	collaboration,
	activeSlideIndex,
	canvasWidth,
	canvasHeight,
	selectedElementId,
}: CollaborationCursorOverlayProps): React.ReactElement | null {
	const context = useCollaboration();
	const collab = collaboration === undefined ? context : collaboration;
	const broadcastPresence = collab?.broadcastPresence;
	const containerRef = useRef<HTMLDivElement>(null);

	// Broadcast selectedElementId changes to remote users
	useEffect(() => {
		broadcastPresence?.({
			selectedElementId: selectedElementId ?? undefined,
			activeSlideIndex,
		});
	}, [broadcastPresence, selectedElementId, activeSlideIndex]);

	// Attach pointermove listener to the parent canvas element so we can
	// track cursor position without blocking clicks, drags, or other events.
	useEffect(() => {
		if (!broadcastPresence) {
			return;
		}
		const parent = containerRef.current?.parentElement;
		if (!parent) {
			return;
		}
		const handler = (e: PointerEvent) => {
			const rect = parent.getBoundingClientRect();
			const x = ((e.clientX - rect.left) / rect.width) * canvasWidth;
			const y = ((e.clientY - rect.top) / rect.height) * canvasHeight;
			broadcastPresence({
				cursorX: x,
				cursorY: y,
				activeSlideIndex,
			});
		};
		parent.addEventListener('pointermove', handler);
		return () => parent.removeEventListener('pointermove', handler);
	}, [broadcastPresence, canvasWidth, canvasHeight, activeSlideIndex]);

	if (!collab) {
		return null;
	}

	return (
		<div
			ref={containerRef}
			data-testid='collab-pointer-tracker'
			data-export-ignore='true'
			style={{ display: 'contents' }}
		>
			{/* Remote cursor SVG overlay: pointer-events: none so it doesn't block interactions */}
			<RemoteUserCursors
				remoteUsers={collab.remoteUsers}
				activeSlideIndex={activeSlideIndex}
				canvasWidth={canvasWidth}
				canvasHeight={canvasHeight}
			/>
		</div>
	);
}
