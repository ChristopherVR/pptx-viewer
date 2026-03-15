/**
 * usePresenceTracking — Broadcasts local cursor/selection state and
 * collects remote user presence via the Yjs awareness protocol.
 *
 * Features:
 * - 50ms throttle on outgoing presence broadcasts (rate limiting)
 * - Sanitises all incoming presence data (XSS prevention, bounds clamping)
 * - Filters out stale presence entries (> 30 seconds without update)
 *
 * @module collaboration/usePresenceTracking
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { UserPresence } from "./types";
import { sanitizePresence } from "./sanitize";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Awareness {
  setLocalStateField: (field: string, value: any) => void;
  getLocalState: () => any;
  getStates: () => Map<number, any>;
  on: (event: string, cb: (...args: any[]) => void) => void;
  off: (event: string, cb: (...args: any[]) => void) => void;
  clientID: number;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface UsePresenceTrackingInput {
  awareness: Awareness | null;
  localClientId: number | null;
  userName: string;
  userColor: string;
  userAvatar?: string;
  canvasWidth: number;
  canvasHeight: number;
}

export interface UsePresenceTrackingResult {
  /** Presence data for all remote users (excludes local). */
  remoteUsers: UserPresence[];
  /** Broadcast a partial presence update for the local user. */
  broadcastPresence: (update: Partial<Omit<UserPresence, "clientId">>) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum interval between outgoing presence broadcasts (ms). */
const BROADCAST_THROTTLE_MS = 50;

/** Presence entries older than this are considered stale and filtered out. */
const STALE_PRESENCE_MS = 30_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePresenceTracking({
  awareness,
  localClientId,
  userName,
  userColor,
  userAvatar,
  canvasWidth,
  canvasHeight,
}: UsePresenceTrackingInput): UsePresenceTrackingResult {
  const [remoteUsers, setRemoteUsers] = useState<UserPresence[]>([]);

  // Throttle state
  const lastBroadcastRef = useRef(0);
  const pendingBroadcastRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const latestLocalState = useRef<Partial<Omit<UserPresence, "clientId">>>({});

  // ── Broadcast (throttled) ────────────────────────────────────────
  const broadcastPresence = useCallback(
    (update: Partial<Omit<UserPresence, "clientId">>) => {
      if (!awareness) return;

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
          lastUpdated: new Date().toISOString(),
        };
        awareness.setLocalStateField("presence", state);
        lastBroadcastRef.current = Date.now();
      };

      if (elapsed >= BROADCAST_THROTTLE_MS) {
        // Enough time has passed — send immediately
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
    [awareness, userName, userColor, userAvatar],
  );

  // ── Listen for awareness changes ─────────────────────────────────
  useEffect(() => {
    if (!awareness || localClientId == null) return;

    const handleChange = () => {
      const now = Date.now();
      const states = awareness.getStates();
      const users: UserPresence[] = [];

      states.forEach((state, cid) => {
        // Skip local user
        if (cid === localClientId) return;

        const raw = state?.presence;
        if (!raw || typeof raw !== "object") return;

        const sanitized = sanitizePresence(
          { ...raw, clientId: cid },
          canvasWidth,
          canvasHeight,
        );
        if (!sanitized) return;

        // Filter stale entries
        const updatedAt = new Date(sanitized.lastUpdated).getTime();
        if (Number.isNaN(updatedAt) || now - updatedAt > STALE_PRESENCE_MS) {
          return;
        }

        users.push(sanitized);
      });

      setRemoteUsers(users);
    };

    awareness.on("change", handleChange);

    // Initial read
    handleChange();

    return () => {
      awareness.off("change", handleChange);
    };
  }, [awareness, localClientId, canvasWidth, canvasHeight]);

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
