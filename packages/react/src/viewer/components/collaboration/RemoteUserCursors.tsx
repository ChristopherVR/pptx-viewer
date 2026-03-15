/**
 * RemoteUserCursors — Renders other users' cursors as an SVG overlay
 * on the slide canvas.
 *
 * Each remote user's cursor is drawn as a coloured pointer arrow with
 * their username label. Only cursors on the same slide as the local
 * user are displayed.
 *
 * @module collaboration/RemoteUserCursors
 */
import React from "react";

import type { UserPresence } from "../../hooks/collaboration/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RemoteUserCursorsProps {
  /** Presence data for remote users. */
  remoteUsers: UserPresence[];
  /** The slide index the local user is currently viewing. */
  activeSlideIndex: number;
  /** Canvas width in CSS px (for SVG viewBox). */
  canvasWidth: number;
  /** Canvas height in CSS px (for SVG viewBox). */
  canvasHeight: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RemoteUserCursors({
  remoteUsers,
  activeSlideIndex,
  canvasWidth,
  canvasHeight,
}: RemoteUserCursorsProps): React.ReactElement | null {
  // Only show cursors for users on the same slide
  const visibleUsers = remoteUsers.filter(
    (u) => u.activeSlideIndex === activeSlideIndex,
  );

  if (visibleUsers.length === 0) return null;

  return (
    <svg
      data-testid="remote-user-cursors"
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 9999 }}
      width={canvasWidth}
      height={canvasHeight}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      aria-hidden="true"
    >
      {visibleUsers.map((user) => (
        <g
          key={user.clientId}
          transform={`translate(${user.cursorX}, ${user.cursorY})`}
          data-testid={`remote-cursor-${user.clientId}`}
        >
          {/* Cursor arrow */}
          <path
            d="M0 0 L0 16 L4.5 12.5 L8 20 L10.5 19 L7 11.5 L12 11 Z"
            fill={user.userColor}
            stroke="#fff"
            strokeWidth={1}
            opacity={0.9}
          />
          {/* Username label */}
          <g transform="translate(14, 18)">
            <rect
              rx={3}
              ry={3}
              x={-2}
              y={-10}
              width={Math.min(user.userName.length * 7 + 8, 150)}
              height={16}
              fill={user.userColor}
              opacity={0.85}
            />
            <text
              fill="#fff"
              fontSize={10}
              fontFamily="system-ui, sans-serif"
              fontWeight={500}
              dominantBaseline="central"
              y={-2}
              x={2}
            >
              {user.userName.length > 20
                ? `${user.userName.slice(0, 18)}...`
                : user.userName}
            </text>
          </g>
        </g>
      ))}
    </svg>
  );
}
