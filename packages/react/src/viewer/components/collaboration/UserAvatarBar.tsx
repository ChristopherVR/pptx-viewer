/**
 * UserAvatarBar — Displays connected collaborators as a row of avatar circles
 * in the toolbar area.
 *
 * Shows up to 5 avatar circles with a "+N" overflow indicator.
 * Each circle shows the user's avatar image (if available) or their initials.
 *
 * @module collaboration/UserAvatarBar
 */
import React from "react";

import type { UserPresence, ConnectionStatus } from "../../hooks/collaboration/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UserAvatarBarProps {
  /** Remote user presence data. */
  remoteUsers: UserPresence[];
  /** Local user display name. */
  localUserName: string;
  /** Local user's colour. */
  localUserColor: string;
  /** Local user's avatar URL. */
  localUserAvatar?: string;
  /** Connection status. */
  status: ConnectionStatus;
  /** Maximum visible avatars before showing overflow (default: 5). */
  maxVisible?: number;
}

// ---------------------------------------------------------------------------
// Avatar circle sub-component
// ---------------------------------------------------------------------------

function AvatarCircle({
  name,
  color,
  avatar,
  isLocal,
}: {
  name: string;
  color: string;
  avatar?: string;
  isLocal?: boolean;
}) {
  const initials = getInitials(name);
  const title = isLocal ? `${name} (you)` : name;

  return (
    <div
      className="relative w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border-2 -ml-1 first:ml-0"
      style={{
        backgroundColor: color,
        borderColor: isLocal ? "#fff" : color,
      }}
      title={title}
      aria-label={title}
    >
      {avatar ? (
        <img
          src={avatar}
          alt=""
          className="w-full h-full rounded-full object-cover"
          onError={(e) => {
            // Fall back to initials on load error
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        initials
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserAvatarBar({
  remoteUsers,
  localUserName,
  localUserColor,
  localUserAvatar,
  status,
  maxVisible = 5,
}: UserAvatarBarProps): React.ReactElement | null {
  if (status === "disconnected" || status === "error") return null;

  const allUsers = [
    { name: localUserName, color: localUserColor, avatar: localUserAvatar, isLocal: true },
    ...remoteUsers.map((u) => ({
      name: u.userName,
      color: u.userColor,
      avatar: u.userAvatar,
      isLocal: false,
    })),
  ];

  const visible = allUsers.slice(0, maxVisible);
  const overflow = allUsers.length - maxVisible;

  return (
    <div
      data-testid="user-avatar-bar"
      className="flex items-center px-2"
      aria-label={`${allUsers.length} user${allUsers.length !== 1 ? "s" : ""} connected`}
    >
      {visible.map((user, i) => (
        <AvatarCircle
          key={user.isLocal ? "local" : `remote-${i}`}
          name={user.name}
          color={user.color}
          avatar={user.avatar}
          isLocal={user.isLocal}
        />
      ))}
      {overflow > 0 && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-gray-300 bg-gray-700 border-2 border-gray-600 -ml-1"
          title={`${overflow} more user${overflow !== 1 ? "s" : ""}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
