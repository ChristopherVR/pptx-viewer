/**
 * usePresenceTracking: Broadcasts local cursor/selection state and
 * collects remote user presence via the Yjs awareness protocol.
 *
 * Features:
 * - 50ms throttle on outgoing presence broadcasts (rate limiting)
 * - Sanitises all incoming presence data (XSS prevention, bounds clamping)
 * - Filters out stale presence entries (> 30 seconds without update)
 *
 * @module collaboration/usePresenceTracking
 */
import { BROADCAST_THROTTLE_MS, createPresenceProjector } from 'pptx-viewer-shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';

import type { UserPresence } from './types';

export interface UsePresenceTrackingInput {
	awareness: Awareness | null;
	localClientId: number | null;
	userName: string;
	userColor: string;
	userAvatar?: string;
	/** Role in the session (broadcaster, viewer, or collaborator). */
	role?: string;
	canvasWidth: number;
	canvasHeight: number;
}

export interface UsePresenceTrackingResult {
	/** Presence data for all remote users (excludes local). */
	remoteUsers: UserPresence[];
	/** Broadcast a partial presence update for the local user. */
	broadcastPresence: (update: Partial<Omit<UserPresence, 'clientId'>>) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePresenceTracking({
	awareness,
	localClientId,
	userName,
	userColor,
	userAvatar,
	role,
	canvasWidth,
	canvasHeight,
}: UsePresenceTrackingInput): UsePresenceTrackingResult {
	const [remoteUsers, setRemoteUsers] = useState<UserPresence[]>([]);
	const projectorRef = useRef<ReturnType<typeof createPresenceProjector> | null>(null);
	projectorRef.current ??= createPresenceProjector();
	const projector = projectorRef.current;

	// Throttle state
	const lastBroadcastRef = useRef(0);
	const pendingBroadcastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const latestLocalState = useRef<Partial<Omit<UserPresence, 'clientId'>>>({});

	// ── Broadcast (throttled) ────────────────────────────────────────
	const broadcastPresence = useCallback(
		(update: Partial<Omit<UserPresence, 'clientId'>>) => {
			if (!awareness) {
				return;
			}

			// Merge into latest local state
			Object.assign(latestLocalState.current, update);

			const now = Date.now();
			const elapsed = now - lastBroadcastRef.current;

			const flush = () => {
				const state = {
					...latestLocalState.current,
					userName,
					userColor,
					userAvatar,
					role,
					lastUpdated: new Date().toISOString(),
				};
				awareness.setLocalStateField('presence', state);
				lastBroadcastRef.current = Date.now();
			};

			if (elapsed >= BROADCAST_THROTTLE_MS) {
				// Enough time has passed: send immediately
				if (pendingBroadcastRef.current) {
					clearTimeout(pendingBroadcastRef.current);
					pendingBroadcastRef.current = null;
				}
				flush();
			} else if (!pendingBroadcastRef.current) {
				// Schedule a deferred broadcast
				pendingBroadcastRef.current = setTimeout(() => {
					pendingBroadcastRef.current = null;
					flush();
				}, BROADCAST_THROTTLE_MS - elapsed);
			}
		},
		[awareness, userName, userColor, userAvatar, role],
	);

	// ── Announce presence immediately when connected ────────────────
	useEffect(() => {
		if (!awareness) {
			return;
		}
		// Broadcast initial presence so other clients know we exist
		awareness.setLocalStateField('presence', {
			userName,
			userColor,
			userAvatar,
			role,
			activeSlideIndex: 0,
			cursorX: 0,
			cursorY: 0,
			lastUpdated: new Date().toISOString(),
		});
	}, [awareness, userName, userColor, userAvatar, role]);

	// ── Listen for awareness changes ─────────────────────────────────
	useEffect(() => {
		if (!awareness || localClientId === null) {
			return;
		}

		const handleChange = () => {
			// Sanitise + stale-drop + skip-local in one shared pass; the returned
			// SanitizedPresence[] is structurally a UserPresence[].
			//
			// Awareness also fires for our OWN local writes and for every peer's
			// heartbeat, neither of which changes anything visible. The shared
			// projector answers that once for all five bindings: when nothing a
			// user could see moved it reports `changed: false`, and we leave the
			// existing array in place rather than re-rendering the collaboration
			// layer on a timer (issue #145).
			const { list, changed } = projector.project(
				awareness.getStates() as Map<number, Record<string, unknown>>,
				localClientId,
				canvasWidth,
				canvasHeight,
			);
			if (!changed) {
				return;
			}
			setRemoteUsers(list);
		};

		awareness.on('change', handleChange);
		// Also listen for 'update' events which fire on awareness state changes
		awareness.on('update', handleChange);

		// Initial read
		handleChange();

		return () => {
			awareness.off('change', handleChange);
			awareness.off('update', handleChange);
		};
	}, [awareness, localClientId, canvasWidth, canvasHeight, projector]);

	// ── Heartbeat: keep presence fresh so stale filter doesn't expire us
	useEffect(() => {
		if (!awareness) {
			return;
		}
		const interval = setInterval(() => {
			awareness.setLocalStateField('presence', {
				...latestLocalState.current,
				userName,
				userColor,
				userAvatar,
				role,
				lastUpdated: new Date().toISOString(),
			});
		}, 10_000); // Every 10 seconds
		return () => clearInterval(interval);
	}, [awareness, userName, userColor, userAvatar, role]);

	// Cleanup pending timeout on unmount
	useEffect(() => {
		return () => {
			if (pendingBroadcastRef.current) {
				clearTimeout(pendingBroadcastRef.current);
			}
		};
	}, []);

	return { remoteUsers, broadcastPresence };
}
