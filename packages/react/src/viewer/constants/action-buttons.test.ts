import { describe, it, expect } from "vitest";
import {
  ACTION_BUTTON_PRESETS,
  ACTION_BUTTON_DEFAULT_ACTIONS,
} from "./action-buttons";

describe("ACTION_BUTTON_PRESETS", () => {
  it("is a non-empty array", () => {
    expect(ACTION_BUTTON_PRESETS.length).toBeGreaterThan(0);
  });

  it("contains exactly five presets", () => {
    expect(ACTION_BUTTON_PRESETS).toHaveLength(5);
  });

  it("each preset has shapeType, label, defaultAction, and iconPath", () => {
    for (const preset of ACTION_BUTTON_PRESETS) {
      expect(typeof preset.shapeType).toBe("string");
      expect(preset.shapeType.length).toBeGreaterThan(0);
      expect(typeof preset.label).toBe("string");
      expect(preset.label.length).toBeGreaterThan(0);
      expect(typeof preset.defaultAction).toBe("string");
      expect(preset.defaultAction.length).toBeGreaterThan(0);
      expect(typeof preset.iconPath).toBe("string");
      expect(preset.iconPath.length).toBeGreaterThan(0);
    }
  });

  it("all shapeType values start with 'actionButton'", () => {
    for (const preset of ACTION_BUTTON_PRESETS) {
      expect(preset.shapeType).toMatch(/^actionButton/);
    }
  });

  it("all shapeType values are unique", () => {
    const types = ACTION_BUTTON_PRESETS.map((p) => p.shapeType);
    expect(new Set(types).size).toBe(types.length);
  });

  it("includes back/previous, forward/next, beginning, end, and return", () => {
    const types = ACTION_BUTTON_PRESETS.map((p) => p.shapeType);
    expect(types).toContain("actionButtonBackPrevious");
    expect(types).toContain("actionButtonForwardNext");
    expect(types).toContain("actionButtonBeginning");
    expect(types).toContain("actionButtonEnd");
    expect(types).toContain("actionButtonReturn");
  });

  it("back/previous has prevSlide as default action", () => {
    const back = ACTION_BUTTON_PRESETS.find(
      (p) => p.shapeType === "actionButtonBackPrevious",
    );
    expect(back?.defaultAction).toBe("prevSlide");
  });

  it("forward/next has nextSlide as default action", () => {
    const forward = ACTION_BUTTON_PRESETS.find(
      (p) => p.shapeType === "actionButtonForwardNext",
    );
    expect(forward?.defaultAction).toBe("nextSlide");
  });

  it("beginning has firstSlide as default action", () => {
    const beginning = ACTION_BUTTON_PRESETS.find(
      (p) => p.shapeType === "actionButtonBeginning",
    );
    expect(beginning?.defaultAction).toBe("firstSlide");
  });

  it("end has lastSlide as default action", () => {
    const end = ACTION_BUTTON_PRESETS.find(
      (p) => p.shapeType === "actionButtonEnd",
    );
    expect(end?.defaultAction).toBe("lastSlide");
  });

  it("iconPath values are valid SVG path data strings", () => {
    for (const preset of ACTION_BUTTON_PRESETS) {
      // SVG path data should contain command letters (M, L, Z, etc.)
      expect(preset.iconPath).toMatch(/[MLZCQSTAHVmlzcqstahv]/);
    }
  });
});

describe("ACTION_BUTTON_DEFAULT_ACTIONS", () => {
  it("is a plain object", () => {
    expect(typeof ACTION_BUTTON_DEFAULT_ACTIONS).toBe("object");
    expect(ACTION_BUTTON_DEFAULT_ACTIONS).not.toBeNull();
  });

  it("has one entry for each preset", () => {
    expect(Object.keys(ACTION_BUTTON_DEFAULT_ACTIONS)).toHaveLength(
      ACTION_BUTTON_PRESETS.length,
    );
  });

  it("maps each shapeType to its defaultAction", () => {
    for (const preset of ACTION_BUTTON_PRESETS) {
      expect(ACTION_BUTTON_DEFAULT_ACTIONS[preset.shapeType]).toBe(
        preset.defaultAction,
      );
    }
  });

  it("returns undefined for a non-existent shape type", () => {
    expect(
      ACTION_BUTTON_DEFAULT_ACTIONS["nonExistentType"],
    ).toBeUndefined();
  });
});
