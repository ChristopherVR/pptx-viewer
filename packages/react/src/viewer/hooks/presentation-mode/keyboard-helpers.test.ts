import { describe, it, expect } from "vitest";
import {
  mapKeyToPresentationAction,
  isNavigationKey,
  NEXT_SLIDE_KEYS,
  PREV_SLIDE_KEYS,
} from "./keyboard-helpers";

// ---------------------------------------------------------------------------
// mapKeyToPresentationAction
// ---------------------------------------------------------------------------

describe("mapKeyToPresentationAction", () => {
  // Exit
  it("maps Escape to exit", () => {
    expect(mapKeyToPresentationAction("Escape", false)).toEqual({
      action: "exit",
    });
  });

  it("maps Escape with ctrl to exit", () => {
    expect(mapKeyToPresentationAction("Escape", true)).toEqual({
      action: "exit",
    });
  });

  // Next slide
  it("maps ArrowRight to next", () => {
    expect(mapKeyToPresentationAction("ArrowRight", false)).toEqual({
      action: "next",
    });
  });

  it("maps PageDown to next", () => {
    expect(mapKeyToPresentationAction("PageDown", false)).toEqual({
      action: "next",
    });
  });

  it("maps Space to next", () => {
    expect(mapKeyToPresentationAction(" ", false)).toEqual({
      action: "next",
    });
  });

  // Previous slide
  it("maps ArrowLeft to prev", () => {
    expect(mapKeyToPresentationAction("ArrowLeft", false)).toEqual({
      action: "prev",
    });
  });

  it("maps PageUp to prev", () => {
    expect(mapKeyToPresentationAction("PageUp", false)).toEqual({
      action: "prev",
    });
  });

  // Annotation tool shortcuts
  it("maps 'l' to toggleLaser", () => {
    expect(mapKeyToPresentationAction("l", false)).toEqual({
      action: "toggleLaser",
    });
  });

  it("maps 'L' to toggleLaser", () => {
    expect(mapKeyToPresentationAction("L", false)).toEqual({
      action: "toggleLaser",
    });
  });

  it("maps 'p' to togglePen", () => {
    expect(mapKeyToPresentationAction("p", false)).toEqual({
      action: "togglePen",
    });
  });

  it("maps 'P' to togglePen", () => {
    expect(mapKeyToPresentationAction("P", false)).toEqual({
      action: "togglePen",
    });
  });

  it("maps 'e' to toggleEraser", () => {
    expect(mapKeyToPresentationAction("e", false)).toEqual({
      action: "toggleEraser",
    });
  });

  it("maps 'E' to toggleEraser", () => {
    expect(mapKeyToPresentationAction("E", false)).toEqual({
      action: "toggleEraser",
    });
  });

  // Toolbar toggle (Ctrl+M)
  it("maps Ctrl+m to toggleToolbar", () => {
    expect(mapKeyToPresentationAction("m", true)).toEqual({
      action: "toggleToolbar",
    });
  });

  it("maps 'm' without ctrl to none", () => {
    expect(mapKeyToPresentationAction("m", false)).toEqual({
      action: "none",
    });
  });

  // Unmapped keys
  it("returns none for unmapped keys", () => {
    expect(mapKeyToPresentationAction("a", false)).toEqual({
      action: "none",
    });
  });

  it("returns none for number keys", () => {
    expect(mapKeyToPresentationAction("1", false)).toEqual({
      action: "none",
    });
  });

  it("returns none for Tab", () => {
    expect(mapKeyToPresentationAction("Tab", false)).toEqual({
      action: "none",
    });
  });
});

// ---------------------------------------------------------------------------
// isNavigationKey
// ---------------------------------------------------------------------------

describe("isNavigationKey", () => {
  it("returns true for all next-slide keys", () => {
    for (const key of NEXT_SLIDE_KEYS) {
      expect(isNavigationKey(key)).toBe(true);
    }
  });

  it("returns true for all prev-slide keys", () => {
    for (const key of PREV_SLIDE_KEYS) {
      expect(isNavigationKey(key)).toBe(true);
    }
  });

  it("returns false for non-navigation keys", () => {
    expect(isNavigationKey("Escape")).toBe(false);
    expect(isNavigationKey("l")).toBe(false);
    expect(isNavigationKey("Enter")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Key constants
// ---------------------------------------------------------------------------

describe("key constants", () => {
  it("NEXT_SLIDE_KEYS contains the expected keys", () => {
    expect(NEXT_SLIDE_KEYS).toContain("ArrowRight");
    expect(NEXT_SLIDE_KEYS).toContain("PageDown");
    expect(NEXT_SLIDE_KEYS).toContain(" ");
  });

  it("PREV_SLIDE_KEYS contains the expected keys", () => {
    expect(PREV_SLIDE_KEYS).toContain("ArrowLeft");
    expect(PREV_SLIDE_KEYS).toContain("PageUp");
  });
});
