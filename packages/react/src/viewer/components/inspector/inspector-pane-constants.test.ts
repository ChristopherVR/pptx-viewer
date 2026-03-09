import { describe, it, expect } from "vitest";
import {
  INSPECTOR_TABS,
  HEADING,
  CARD,
  INPUT,
  BTN,
  POS_FIELDS,
} from "./inspector-pane-constants";

describe("inspector-pane-constants", () => {
  describe("INSPECTOR_TABS", () => {
    it("is a non-empty array", () => {
      expect(Array.isArray(INSPECTOR_TABS)).toBe(true);
      expect(INSPECTOR_TABS.length).toBeGreaterThan(0);
    });

    it("has no duplicate keys", () => {
      const keys = INSPECTOR_TABS.map((t) => t.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("contains expected tab keys", () => {
      const keys = INSPECTOR_TABS.map((t) => t.key);
      expect(keys).toContain("elements");
      expect(keys).toContain("properties");
      expect(keys).toContain("comments");
    });

    it("every entry has key, label, and icon", () => {
      for (const tab of INSPECTOR_TABS) {
        expect(typeof tab.key).toBe("string");
        expect(tab.key.length).toBeGreaterThan(0);
        expect(typeof tab.label).toBe("string");
        expect(tab.label.length).toBeGreaterThan(0);
        expect(tab.icon).toBeDefined();
      }
    });

    it("has no duplicate labels", () => {
      const labels = INSPECTOR_TABS.map((t) => t.label);
      expect(new Set(labels).size).toBe(labels.length);
    });
  });

  describe("CSS class tokens", () => {
    it("HEADING is a non-empty string", () => {
      expect(typeof HEADING).toBe("string");
      expect(HEADING.length).toBeGreaterThan(0);
    });

    it("CARD is a non-empty string", () => {
      expect(typeof CARD).toBe("string");
      expect(CARD.length).toBeGreaterThan(0);
    });

    it("INPUT is a non-empty string", () => {
      expect(typeof INPUT).toBe("string");
      expect(INPUT.length).toBeGreaterThan(0);
    });

    it("BTN is a non-empty string", () => {
      expect(typeof BTN).toBe("string");
      expect(BTN.length).toBeGreaterThan(0);
    });
  });

  describe("POS_FIELDS", () => {
    it("is a 4-element tuple", () => {
      expect(POS_FIELDS.length).toBe(4);
    });

    it("contains expected label-key pairs", () => {
      expect(POS_FIELDS[0]).toEqual(["X", "x"]);
      expect(POS_FIELDS[1]).toEqual(["Y", "y"]);
      expect(POS_FIELDS[2]).toEqual(["W", "width"]);
      expect(POS_FIELDS[3]).toEqual(["H", "height"]);
    });

    it("has no duplicate labels", () => {
      const labels = POS_FIELDS.map((f) => f[0]);
      expect(new Set(labels).size).toBe(labels.length);
    });

    it("has no duplicate keys", () => {
      const keys = POS_FIELDS.map((f) => f[1]);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});
