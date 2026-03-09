import { describe, it, expect } from "vitest";
import type { ShapeStyle, XmlObject } from "pptx-viewer-core";
import { applyJoinCapCompound } from "./stroke-serialization-helpers";

describe("applyJoinCapCompound", () => {
  // -------------------------------------------------------------------
  // Line join
  // -------------------------------------------------------------------
  describe("line join from a:ln XML node", () => {
    it('sets lineJoin = "round" when a:round is present', () => {
      const lineNode: XmlObject = { "a:round": {} };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineJoin).toBe("round");
    });

    it('sets lineJoin = "bevel" when a:bevel is present', () => {
      const lineNode: XmlObject = { "a:bevel": {} };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineJoin).toBe("bevel");
    });

    it('sets lineJoin = "miter" when a:miter is present', () => {
      const lineNode: XmlObject = { "a:miter": {} };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineJoin).toBe("miter");
    });

    it("does not set lineJoin when no join element is present", () => {
      const lineNode: XmlObject = {};
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineJoin).toBeUndefined();
    });

    it("prefers first matching join (a:round over a:bevel when both exist)", () => {
      const lineNode: XmlObject = { "a:round": {}, "a:bevel": {} };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      // The if/else-if chain picks a:round first
      expect(style.lineJoin).toBe("round");
    });

    it('handles a:miter with @_lim attribute', () => {
      const lineNode: XmlObject = { "a:miter": { "@_lim": "800000" } };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineJoin).toBe("miter");
    });
  });

  // -------------------------------------------------------------------
  // Line cap
  // -------------------------------------------------------------------
  describe("line cap from @_cap attribute", () => {
    it('sets lineCap = "rnd" for cap="rnd"', () => {
      const lineNode: XmlObject = { "@_cap": "rnd" };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineCap).toBe("rnd");
    });

    it('sets lineCap = "sq" for cap="sq"', () => {
      const lineNode: XmlObject = { "@_cap": "sq" };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineCap).toBe("sq");
    });

    it('sets lineCap = "flat" for cap="flat"', () => {
      const lineNode: XmlObject = { "@_cap": "flat" };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineCap).toBe("flat");
    });

    it("does not set lineCap when @_cap is missing", () => {
      const lineNode: XmlObject = {};
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineCap).toBeUndefined();
    });

    it("does not set lineCap for invalid cap value", () => {
      const lineNode: XmlObject = { "@_cap": "invalid" };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineCap).toBeUndefined();
    });

    it("does not set lineCap for empty string cap", () => {
      const lineNode: XmlObject = { "@_cap": "" };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineCap).toBeUndefined();
    });

    it("trims whitespace from cap value", () => {
      const lineNode: XmlObject = { "@_cap": "  rnd  " };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineCap).toBe("rnd");
    });

    it("normalizes uppercase cap to lowercase", () => {
      const lineNode: XmlObject = { "@_cap": "RND" };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineCap).toBe("rnd");
    });
  });

  // -------------------------------------------------------------------
  // Compound line
  // -------------------------------------------------------------------
  describe("compound line from @_cmpd attribute", () => {
    it('sets compoundLine = "dbl" for cmpd="dbl"', () => {
      const lineNode: XmlObject = { "@_cmpd": "dbl" };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.compoundLine).toBe("dbl");
    });

    it('sets compoundLine = "thickThin" for cmpd="thickThin"', () => {
      const lineNode: XmlObject = { "@_cmpd": "thickThin" };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.compoundLine).toBe("thickThin");
    });

    it('sets compoundLine = "thinThick" for cmpd="thinThick"', () => {
      const lineNode: XmlObject = { "@_cmpd": "thinThick" };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.compoundLine).toBe("thinThick");
    });

    it('sets compoundLine = "sng" for cmpd="sng"', () => {
      const lineNode: XmlObject = { "@_cmpd": "sng" };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.compoundLine).toBe("sng");
    });

    it('sets compoundLine = "tri" for cmpd="tri"', () => {
      const lineNode: XmlObject = { "@_cmpd": "tri" };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.compoundLine).toBe("tri");
    });

    it("does not set compoundLine when @_cmpd is missing", () => {
      const lineNode: XmlObject = {};
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.compoundLine).toBeUndefined();
    });

    it("does not set compoundLine for invalid cmpd value", () => {
      const lineNode: XmlObject = { "@_cmpd": "unknown" };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.compoundLine).toBeUndefined();
    });

    it("does not set compoundLine for empty string cmpd", () => {
      const lineNode: XmlObject = { "@_cmpd": "" };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.compoundLine).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // Invalid / missing values don't set properties
  // -------------------------------------------------------------------
  describe("invalid / missing values leave style untouched", () => {
    it("leaves all properties undefined for empty lineNode", () => {
      const lineNode: XmlObject = {};
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineJoin).toBeUndefined();
      expect(style.lineCap).toBeUndefined();
      expect(style.compoundLine).toBeUndefined();
    });

    it("does not overwrite existing style properties when no matching input", () => {
      const lineNode: XmlObject = {};
      const style: ShapeStyle = { lineJoin: "round" };
      applyJoinCapCompound(lineNode, style);
      // lineJoin was already set and should remain unchanged (no join in node)
      expect(style.lineJoin).toBe("round");
    });

    it("handles null-ish @_cap gracefully", () => {
      const lineNode: XmlObject = { "@_cap": null };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineCap).toBeUndefined();
    });

    it("handles undefined @_cmpd gracefully", () => {
      const lineNode: XmlObject = { "@_cmpd": undefined };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.compoundLine).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------
  // Combined: all three properties at once
  // -------------------------------------------------------------------
  describe("combined: all three properties set simultaneously", () => {
    it("sets join, cap, and compound from a single a:ln node", () => {
      const lineNode: XmlObject = {
        "a:round": {},
        "@_cap": "rnd",
        "@_cmpd": "dbl",
      };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineJoin).toBe("round");
      expect(style.lineCap).toBe("rnd");
      expect(style.compoundLine).toBe("dbl");
    });

    it("sets miter join with sq cap and thickThin compound", () => {
      const lineNode: XmlObject = {
        "a:miter": { "@_lim": "800000" },
        "@_cap": "sq",
        "@_cmpd": "thickThin",
      };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineJoin).toBe("miter");
      expect(style.lineCap).toBe("sq");
      expect(style.compoundLine).toBe("thickThin");
    });

    it("sets bevel join with flat cap and tri compound", () => {
      const lineNode: XmlObject = {
        "a:bevel": {},
        "@_cap": "flat",
        "@_cmpd": "tri",
      };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineJoin).toBe("bevel");
      expect(style.lineCap).toBe("flat");
      expect(style.compoundLine).toBe("tri");
    });

    it("sets only valid properties when some inputs are invalid", () => {
      const lineNode: XmlObject = {
        "a:round": {},
        "@_cap": "invalid",
        "@_cmpd": "nope",
      };
      const style: ShapeStyle = {};
      applyJoinCapCompound(lineNode, style);
      expect(style.lineJoin).toBe("round");
      expect(style.lineCap).toBeUndefined();
      expect(style.compoundLine).toBeUndefined();
    });
  });
});
