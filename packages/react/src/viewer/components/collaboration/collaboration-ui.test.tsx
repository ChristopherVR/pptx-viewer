/**
 * Tests for collaboration UI components — pure logic and rendering checks.
 *
 * Since @testing-library/react is not available, these tests verify the
 * component logic and output via direct React element creation and
 * structure validation.
 */
import { describe, it, expect } from "vitest";
import React from "react";

import type { UserPresence } from "../../hooks/collaboration/types";
import { RemoteUserCursors } from "./RemoteUserCursors";
import { UserAvatarBar } from "./UserAvatarBar";
import { CollaborationStatusIndicator } from "./CollaborationStatusIndicator";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockUser1: UserPresence = {
  clientId: 1,
  userName: "Alice",
  userColor: "#ff0000",
  activeSlideIndex: 0,
  cursorX: 100,
  cursorY: 200,
  lastUpdated: new Date().toISOString(),
};

const mockUser2: UserPresence = {
  clientId: 2,
  userName: "Bob",
  userColor: "#00ff00",
  activeSlideIndex: 0,
  cursorX: 300,
  cursorY: 400,
  lastUpdated: new Date().toISOString(),
};

const mockUserOnDifferentSlide: UserPresence = {
  clientId: 3,
  userName: "Charlie",
  userColor: "#0000ff",
  activeSlideIndex: 1,
  cursorX: 150,
  cursorY: 250,
  lastUpdated: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// RemoteUserCursors
// ---------------------------------------------------------------------------

describe("RemoteUserCursors", () => {
  it("returns null for no visible users", () => {
    const result = RemoteUserCursors({
      remoteUsers: [],
      activeSlideIndex: 0,
      canvasWidth: 960,
      canvasHeight: 540,
    });
    expect(result).toBeNull();
  });

  it("returns null when all users are on different slides", () => {
    const result = RemoteUserCursors({
      remoteUsers: [mockUserOnDifferentSlide],
      activeSlideIndex: 0,
      canvasWidth: 960,
      canvasHeight: 540,
    });
    expect(result).toBeNull();
  });

  it("renders an SVG element for visible users", () => {
    const result = RemoteUserCursors({
      remoteUsers: [mockUser1, mockUser2],
      activeSlideIndex: 0,
      canvasWidth: 960,
      canvasHeight: 540,
    });
    expect(result).not.toBeNull();
    expect(result?.type).toBe("svg");
    expect(result?.props["data-testid"]).toBe("remote-user-cursors");
  });

  it("only renders cursors for users on the active slide", () => {
    const result = RemoteUserCursors({
      remoteUsers: [mockUser1, mockUserOnDifferentSlide],
      activeSlideIndex: 0,
      canvasWidth: 960,
      canvasHeight: 540,
    });
    expect(result).not.toBeNull();
    // Should have 1 child <g> (only mockUser1 on slide 0)
    const children = React.Children.toArray(result?.props.children);
    expect(children).toHaveLength(1);
  });

  it("renders both users when both are on the active slide", () => {
    const result = RemoteUserCursors({
      remoteUsers: [mockUser1, mockUser2],
      activeSlideIndex: 0,
      canvasWidth: 960,
      canvasHeight: 540,
    });
    const children = React.Children.toArray(result?.props.children);
    expect(children).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// UserAvatarBar
// ---------------------------------------------------------------------------

describe("UserAvatarBar", () => {
  it("returns null when disconnected", () => {
    const result = UserAvatarBar({
      remoteUsers: [mockUser1],
      localUserName: "Local",
      localUserColor: "#6366f1",
      status: "disconnected",
    });
    expect(result).toBeNull();
  });

  it("returns null when status is error", () => {
    const result = UserAvatarBar({
      remoteUsers: [mockUser1],
      localUserName: "Local",
      localUserColor: "#6366f1",
      status: "error",
    });
    expect(result).toBeNull();
  });

  it("renders when connected", () => {
    const result = UserAvatarBar({
      remoteUsers: [mockUser1],
      localUserName: "Local",
      localUserColor: "#6366f1",
      status: "connected",
    });
    expect(result).not.toBeNull();
    expect(result?.props["data-testid"]).toBe("user-avatar-bar");
  });

  it("renders local + remote user circles", () => {
    const result = UserAvatarBar({
      remoteUsers: [mockUser1, mockUser2],
      localUserName: "Local",
      localUserColor: "#6366f1",
      status: "connected",
    });
    // 1 local + 2 remote = 3 children (no overflow)
    const children = React.Children.toArray(result?.props.children);
    expect(children).toHaveLength(3);
  });

  it("shows overflow indicator when exceeding maxVisible", () => {
    const users = Array.from({ length: 6 }, (_, i) => ({
      ...mockUser1,
      clientId: i + 10,
      userName: `User${i}`,
    }));
    const result = UserAvatarBar({
      remoteUsers: users,
      localUserName: "Local",
      localUserColor: "#6366f1",
      status: "connected",
      maxVisible: 3,
    });
    // 3 visible + 1 overflow div = 4 children
    const children = React.Children.toArray(result?.props.children);
    expect(children).toHaveLength(4); // 3 visible circles + 1 overflow
  });
});

// ---------------------------------------------------------------------------
// CollaborationStatusIndicator
// ---------------------------------------------------------------------------

describe("CollaborationStatusIndicator", () => {
  it("renders with connected status and user count", () => {
    const result = CollaborationStatusIndicator({
      status: "connected",
      connectedCount: 3,
    });
    expect(result.props["data-testid"]).toBe("collaboration-status");
    expect(result.props["aria-label"]).toContain("Connected");
    expect(result.props["aria-label"]).toContain("3 users");
  });

  it("renders singular form for 1 user", () => {
    const result = CollaborationStatusIndicator({
      status: "connected",
      connectedCount: 1,
    });
    expect(result.props["aria-label"]).toContain("1 user connected");
  });

  it("shows connecting label", () => {
    const result = CollaborationStatusIndicator({
      status: "connecting",
      connectedCount: 0,
    });
    expect(result.props["aria-label"]).toContain("Connecting");
  });

  it("shows disconnected label", () => {
    const result = CollaborationStatusIndicator({
      status: "disconnected",
      connectedCount: 0,
    });
    expect(result.props["aria-label"]).toContain("Disconnected");
  });

  it("shows error label", () => {
    const result = CollaborationStatusIndicator({
      status: "error",
      connectedCount: 0,
    });
    expect(result.props["aria-label"]).toContain("Connection error");
  });
});
