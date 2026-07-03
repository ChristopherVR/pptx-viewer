/**
 * useFollowMode: manual "follow a collaborator" navigation.
 *
 * The local user picks a remote peer (via the follow bar) and the viewer
 * mirrors that peer's `activeSlideIndex` until either the local user navigates
 * away manually or clicks stop. Distinct from {@link useBroadcastFollower},
 * which auto-follows the one-way broadcaster: manual follow is opt-in and
 * peer-agnostic.
 *
 * @module collaboration/useFollowMode
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import type { CollaborationContextValue } from './types';

// ---------------------------------------------------------------------------
// Input / Output
// ---------------------------------------------------------------------------

export interface UseFollowModeInput {
	/** The collaboration context (null when collaboration is disabled). */
	collab: CollaborationContextValue | null;
	/** Current local active slide index. */
	activeSlideIndex: number;
	/** Setter for the active slide index. */
	setActiveSlideIndex: (index: number) => void;
	/** Total number of slides (for bounds checking). */
	slideCount: number;
}

export interface UseFollowModeResult {
	/** The clientId currently being followed, or null. */
	followedClientId: number | null;
	/** Follow the given peer, or `null` to stop following. */
	followUser: (clientId: number | null) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFollowMode({
	collab,
	activeSlideIndex,
	setActiveSlideIndex,
	slideCount,
}: UseFollowModeInput): UseFollowModeResult {
	const [followedClientId, setFollowedClientId] = useState<number | null>(null);
	// The slide index we last navigated to on the followed peer's behalf. Used
	// to tell an auto-applied slide change apart from a manual one.
	const lastAppliedRef = useRef<number>(-1);

	const followUser = useCallback((clientId: number | null) => {
		lastAppliedRef.current = -1;
		setFollowedClientId(clientId);
	}, []);

	const followedPeer =
		followedClientId === null
			? null
			: (collab?.remoteUsers.find((u) => u.clientId === followedClientId) ?? null);

	// Stop following once the peer leaves the session.
	useEffect(() => {
		if (followedClientId !== null && collab && followedPeer === null) {
			setFollowedClientId(null);
		}
	}, [collab, followedClientId, followedPeer]);

	// Mirror the followed peer's active slide.
	const targetSlide = followedPeer?.activeSlideIndex ?? null;
	useEffect(() => {
		if (targetSlide === null || targetSlide < 0 || targetSlide >= slideCount) {
			return;
		}
		if (targetSlide === activeSlideIndex) {
			lastAppliedRef.current = targetSlide;
			return;
		}
		lastAppliedRef.current = targetSlide;
		setActiveSlideIndex(targetSlide);
		// activeSlideIndex intentionally omitted: including it would re-fire this
		// effect on the local navigation the manual-nav guard below handles.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [targetSlide, slideCount, setActiveSlideIndex]);

	// A local navigation to any slide other than the one we auto-applied means
	// the user took over: stop following.
	useEffect(() => {
		if (followedClientId === null) {
			return;
		}
		if (lastAppliedRef.current !== -1 && activeSlideIndex !== lastAppliedRef.current) {
			setFollowedClientId(null);
		}
	}, [activeSlideIndex, followedClientId]);

	return { followedClientId, followUser };
}
