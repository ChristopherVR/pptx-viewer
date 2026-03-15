/**
 * CollaborationStatusIndicator — A small status pill that shows the
 * WebSocket connection state and connected user count.
 *
 * Designed to sit in the status bar area at the bottom of the viewer.
 *
 * @module collaboration/CollaborationStatusIndicator
 */
import React from "react";

import type { ConnectionStatus } from "../../hooks/collaboration/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CollaborationStatusIndicatorProps {
  /** Current WebSocket connection status. */
  status: ConnectionStatus;
  /** Number of connected users (including local). */
  connectedCount: number;
}

// ---------------------------------------------------------------------------
// Status colour mapping
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<ConnectionStatus, { dot: string; text: string; label: string }> = {
  connected: {
    dot: "bg-green-400",
    text: "text-green-400",
    label: "Connected",
  },
  connecting: {
    dot: "bg-yellow-400 animate-pulse",
    text: "text-yellow-400",
    label: "Connecting...",
  },
  disconnected: {
    dot: "bg-gray-500",
    text: "text-gray-500",
    label: "Disconnected",
  },
  error: {
    dot: "bg-red-400",
    text: "text-red-400",
    label: "Connection error",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CollaborationStatusIndicator({
  status,
  connectedCount,
}: CollaborationStatusIndicatorProps): React.ReactElement {
  const style = STATUS_STYLES[status];

  return (
    <div
      data-testid="collaboration-status"
      className="flex items-center gap-1.5"
      aria-label={`Collaboration: ${style.label}. ${connectedCount} user${connectedCount !== 1 ? "s" : ""} connected.`}
    >
      <span
        className={`inline-block w-2 h-2 rounded-full ${style.dot}`}
        aria-hidden="true"
      />
      <span className={`text-[10px] ${style.text}`}>
        {status === "connected"
          ? `${connectedCount} user${connectedCount !== 1 ? "s" : ""}`
          : style.label}
      </span>
    </div>
  );
}
