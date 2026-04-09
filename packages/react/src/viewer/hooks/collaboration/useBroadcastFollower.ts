/**
 * useBroadcastFollower — Automatically follows the broadcaster's active
 * slide when the local user has the `viewer` role.
 *
 * Detects the first remote user with `role === 'broadcaster'` and syncs
 * the local `activeSlideIndex` to match theirs.
 *
 * @module collaboration/useBroadcastFollower
 */
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
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBroadcastFollower({
	collab,
	activeSlideIndex,
	setActiveSlideIndex,
	slideCount,
}: UseBroadcastFollowerInput): void {
	const lastBroadcasterSlide = useRef(-1);

	useEffect(() => {
		if (!collab) {
			return;
		}

		// Only viewers auto-follow the broadcaster
		if (collab.config.role !== 'viewer') {
			return;
		}

		// Find the broadcaster
		const broadcaster = collab.remoteUsers.find((u) => u.role === 'broadcaster');
		if (!broadcaster) {
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
	}, [collab, activeSlideIndex, setActiveSlideIndex, slideCount]);
}
