/**
 * useBroadcastFollower: Automatically follows the broadcaster's active
 * slide when the local user has the `viewer` role.
 *
 * Detects the first remote user with `role === 'owner'` (the broadcaster is
 * the session owner) and syncs the local `activeSlideIndex` to match theirs.
 *
 * @module collaboration/useBroadcastFollower
 */
import { shouldAutoFollowBroadcaster } from 'pptx-viewer-shared';
import { useEffect, useRef } from 'react';

import type { CollaborationContextValue } from './types';

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface UseBroadcastFollowerInput {
	/** The collaboration context (null when collaboration is disabled). */
	collab: CollaborationContextValue | null;
	/** Current local active slide index. */
	activeSlideIndex: number;
	/** Setter for the active slide index. */
	setActiveSlideIndex: (index: number) => void;
	/** Total number of slides (for bounds checking). */
	slideCount: number;
	/**
	 * When true, auto-follow stands down (e.g. the local user is manually
	 * following a specific peer via the follow bar). Defaults to false.
	 */
	paused?: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBroadcastFollower({
	collab,
	activeSlideIndex,
	setActiveSlideIndex,
	slideCount,
	paused = false,
}: UseBroadcastFollowerInput): void {
	const lastBroadcasterSlide = useRef(-1);

	useEffect(() => {
		if (!collab || paused) {
			return;
		}

		// Find the broadcaster (the session owner)
		const broadcaster = collab.remoteUsers.find((u) => u.role === 'owner');
		if (!broadcaster) {
			return;
		}

		// Auto-follow policy lives in one shared helper so React/Vue/Angular
		// cannot drift: only a local `viewer` follows the `owner`.
		if (
			!shouldAutoFollowBroadcaster({
				localRole: collab.config.role,
				broadcasterRole: broadcaster.role,
			})
		) {
			return;
		}

		const targetSlide = broadcaster.activeSlideIndex;

		// Bounds check
		if (targetSlide < 0 || targetSlide >= slideCount) {
			return;
		}

		// Only change if the broadcaster actually moved
		if (targetSlide === lastBroadcasterSlide.current) {
			return;
		}

		lastBroadcasterSlide.current = targetSlide;

		// Navigate to the broadcaster's slide
		if (targetSlide !== activeSlideIndex) {
			setActiveSlideIndex(targetSlide);
		}
	}, [collab, activeSlideIndex, setActiveSlideIndex, slideCount, paused]);
}
