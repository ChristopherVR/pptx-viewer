/**
 * Tests for collaboration sanitization utilities.
 */
import { describe, it, expect } from "vitest";

import {
  validateRoomId,
  sanitizeUserName,
  clampCursorPosition,
  sanitizeColor,
  sanitizeAvatarUrl,
  sanitizeSlideIndex,
  sanitizePresence,
} from "./sanitize";

// ---------------------------------------------------------------------------
// validateRoomId
// ---------------------------------------------------------------------------

describe("validateRoomId", () => {
  it("accepts valid alphanumeric room IDs", () => {
    expect(validateRoomId("room-123")).toBe("room-123");
    expect(validateRoomId("my_room_456")).toBe("my_room_456");
    expect(validateRoomId("AbCdEf")).toBe("AbCdEf");
  });

  it("accepts room IDs with hyphens and underscores", () => {
    expect(validateRoomId("a-b_c")).toBe("a-b_c");
  });

  it("rejects empty strings", () => {
    expect(() => validateRoomId("")).toThrow("Invalid collaboration room ID");
  });

  it("rejects room IDs with spaces", () => {
    expect(() => validateRoomId("room 123")).toThrow(
      "Invalid collaboration room ID",
    );
  });

  it("rejects room IDs with special characters", () => {
    expect(() => validateRoomId("room@123")).toThrow(
      "Invalid collaboration room ID",
    );
    expect(() => validateRoomId("room/path")).toThrow(
      "Invalid collaboration room ID",
    );
    expect(() => validateRoomId("<script>")).toThrow(
      "Invalid collaboration room ID",
    );
  });

  it("rejects room IDs longer than 128 characters", () => {
    const longId = "a".repeat(129);
    expect(() => validateRoomId(longId)).toThrow(
      "Invalid collaboration room ID",
    );
  });

  it("accepts room IDs exactly 128 characters", () => {
    const id = "a".repeat(128);
    expect(validateRoomId(id)).toBe(id);
  });
});

// ---------------------------------------------------------------------------
// sanitizeUserName
// ---------------------------------------------------------------------------

describe("sanitizeUserName", () => {
  it("returns the name for valid strings", () => {
    expect(sanitizeUserName("Alice")).toBe("Alice");
  });

  it("strips HTML tags", () => {
    expect(sanitizeUserName("<b>Bob</b>")).toBe("Bob");
    expect(sanitizeUserName('<script>alert("xss")</script>Alice')).toBe(
      'alert("xss")Alice',
    );
    expect(sanitizeUserName("<img src=x onerror=alert(1)>")).toBe("Anonymous");
  });

  it("returns 'Anonymous' for empty names after stripping", () => {
    expect(sanitizeUserName("<img src=x>")).toBe("Anonymous");
    expect(sanitizeUserName("   ")).toBe("Anonymous");
    expect(sanitizeUserName("")).toBe("Anonymous");
  });

  it("returns 'Anonymous' for non-string values", () => {
    expect(sanitizeUserName(null)).toBe("Anonymous");
    expect(sanitizeUserName(undefined)).toBe("Anonymous");
    expect(sanitizeUserName(42)).toBe("Anonymous");
    expect(sanitizeUserName({})).toBe("Anonymous");
  });

  it("truncates to 64 characters", () => {
    const longName = "A".repeat(100);
    expect(sanitizeUserName(longName)).toBe("A".repeat(64));
  });

  it("trims whitespace", () => {
    expect(sanitizeUserName("  Alice  ")).toBe("Alice");
  });
});

// ---------------------------------------------------------------------------
// clampCursorPosition
// ---------------------------------------------------------------------------

describe("clampCursorPosition", () => {
  it("clamps to slide bounds with margin", () => {
    expect(clampCursorPosition(500, 0, 960)).toBe(500);
    expect(clampCursorPosition(-100, 0, 960)).toBe(-20); // clamped to -margin
    expect(clampCursorPosition(1000, 0, 960)).toBe(980); // clamped to max+margin
  });

  it("returns 0 for non-number values", () => {
    expect(clampCursorPosition("abc", 0, 960)).toBe(0);
    expect(clampCursorPosition(null, 0, 960)).toBe(0);
    expect(clampCursorPosition(undefined, 0, 960)).toBe(0);
    expect(clampCursorPosition(NaN, 0, 960)).toBe(0);
    expect(clampCursorPosition(Infinity, 0, 960)).toBe(0);
  });

  it("allows positions within the margin zone", () => {
    expect(clampCursorPosition(-10, 0, 960)).toBe(-10);
    expect(clampCursorPosition(970, 0, 960)).toBe(970);
  });
});

// ---------------------------------------------------------------------------
// sanitizeColor
// ---------------------------------------------------------------------------

describe("sanitizeColor", () => {
  it("accepts valid hex colors", () => {
    expect(sanitizeColor("#ff0000")).toBe("#ff0000");
    expect(sanitizeColor("#6366f1")).toBe("#6366f1");
    expect(sanitizeColor("#AABBCC")).toBe("#AABBCC");
  });

  it("returns fallback for invalid colors", () => {
    expect(sanitizeColor("red")).toBe("#6366f1");
    expect(sanitizeColor("#fff")).toBe("#6366f1");
    expect(sanitizeColor("rgb(255,0,0)")).toBe("#6366f1");
    expect(sanitizeColor(null)).toBe("#6366f1");
    expect(sanitizeColor(42)).toBe("#6366f1");
  });

  it("uses custom fallback", () => {
    expect(sanitizeColor("invalid", "#000000")).toBe("#000000");
  });
});

// ---------------------------------------------------------------------------
// sanitizeAvatarUrl
// ---------------------------------------------------------------------------

describe("sanitizeAvatarUrl", () => {
  it("accepts https URLs", () => {
    expect(sanitizeAvatarUrl("https://example.com/avatar.png")).toBe(
      "https://example.com/avatar.png",
    );
  });

  it("accepts http URLs", () => {
    expect(sanitizeAvatarUrl("http://example.com/avatar.png")).toBe(
      "http://example.com/avatar.png",
    );
  });

  it("accepts data: URIs", () => {
    const dataUri = "data:image/png;base64,iVBORw0KGgo=";
    expect(sanitizeAvatarUrl(dataUri)).toBe(dataUri);
  });

  it("rejects javascript: URLs", () => {
    expect(sanitizeAvatarUrl("javascript:alert(1)")).toBeUndefined();
  });

  it("rejects invalid URLs", () => {
    expect(sanitizeAvatarUrl("not-a-url")).toBeUndefined();
  });

  it("returns undefined for non-string values", () => {
    expect(sanitizeAvatarUrl(null)).toBeUndefined();
    expect(sanitizeAvatarUrl(42)).toBeUndefined();
    expect(sanitizeAvatarUrl(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sanitizeSlideIndex
// ---------------------------------------------------------------------------

describe("sanitizeSlideIndex", () => {
  it("accepts non-negative integers", () => {
    expect(sanitizeSlideIndex(0)).toBe(0);
    expect(sanitizeSlideIndex(5)).toBe(5);
  });

  it("floors fractional values", () => {
    expect(sanitizeSlideIndex(2.7)).toBe(2);
  });

  it("clamps negative values to 0", () => {
    expect(sanitizeSlideIndex(-3)).toBe(0);
  });

  it("returns 0 for non-number values", () => {
    expect(sanitizeSlideIndex("abc")).toBe(0);
    expect(sanitizeSlideIndex(null)).toBe(0);
    expect(sanitizeSlideIndex(NaN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// sanitizePresence
// ---------------------------------------------------------------------------

describe("sanitizePresence", () => {
  const canvasWidth = 960;
  const canvasHeight = 540;

  it("sanitises valid presence data", () => {
    const result = sanitizePresence(
      {
        clientId: 1,
        userName: "Alice",
        userColor: "#ff0000",
        activeSlideIndex: 2,
        cursorX: 100,
        cursorY: 200,
        lastUpdated: "2026-01-01T00:00:00.000Z",
      },
      canvasWidth,
      canvasHeight,
    );
    expect(result).toEqual({
      clientId: 1,
      userName: "Alice",
      userAvatar: undefined,
      userColor: "#ff0000",
      activeSlideIndex: 2,
      cursorX: 100,
      cursorY: 200,
      lastUpdated: "2026-01-01T00:00:00.000Z",
      selectedElementId: undefined,
    });
  });

  it("returns null when clientId is missing", () => {
    expect(
      sanitizePresence(
        { userName: "Alice" },
        canvasWidth,
        canvasHeight,
      ),
    ).toBeNull();
  });

  it("sanitises HTML in userName", () => {
    const result = sanitizePresence(
      {
        clientId: 1,
        userName: "<b>Evil</b>",
        cursorX: 0,
        cursorY: 0,
      },
      canvasWidth,
      canvasHeight,
    );
    expect(result?.userName).toBe("Evil");
  });

  it("clamps out-of-bounds cursor positions", () => {
    const result = sanitizePresence(
      {
        clientId: 1,
        cursorX: 99999,
        cursorY: -99999,
      },
      canvasWidth,
      canvasHeight,
    );
    expect(result?.cursorX).toBe(canvasWidth + 20); // clamped to max+margin
    expect(result?.cursorY).toBe(-20); // clamped to -margin
  });

  it("truncates selectedElementId", () => {
    const longId = "x".repeat(200);
    const result = sanitizePresence(
      { clientId: 1, selectedElementId: longId },
      canvasWidth,
      canvasHeight,
    );
    expect(result?.selectedElementId).toBe("x".repeat(128));
  });

  it("rejects javascript: avatar URLs", () => {
    const result = sanitizePresence(
      { clientId: 1, userAvatar: "javascript:alert(1)" },
      canvasWidth,
      canvasHeight,
    );
    expect(result?.userAvatar).toBeUndefined();
  });
});
