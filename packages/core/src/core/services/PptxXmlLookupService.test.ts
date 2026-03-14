import { describe, it, expect } from "vitest";
import { PptxXmlLookupService } from "./PptxXmlLookupService";
import type { XmlObject } from "../types";

describe("PptxXmlLookupService", () => {
  const service = new PptxXmlLookupService();

  // ── getChildByLocalName ────────────────────────────────────────────

  describe("getChildByLocalName", () => {
    it("returns undefined for undefined parent", () => {
      expect(service.getChildByLocalName(undefined, "child")).toBeUndefined();
    });

    it("returns a direct child by exact name", () => {
      const parent: XmlObject = {
        child: { "@_val": "test" },
      };
      const result = service.getChildByLocalName(parent, "child");
      expect(result).toEqual({ "@_val": "test" });
    });

    it("returns a namespaced child by local name", () => {
      const parent: XmlObject = {
        "p:transition": { "@_dur": "500" },
      };
      const result = service.getChildByLocalName(parent, "transition");
      expect(result).toEqual({ "@_dur": "500" });
    });

    it("returns undefined when no matching child exists", () => {
      const parent: XmlObject = {
        "p:other": { "@_val": "1" },
      };
      expect(service.getChildByLocalName(parent, "missing")).toBeUndefined();
    });

    it("returns undefined for non-object values", () => {
      const parent: XmlObject = {
        child: "string-value",
      };
      expect(service.getChildByLocalName(parent, "child")).toBeUndefined();
    });

    it("returns undefined for array values", () => {
      const parent: XmlObject = {
        child: [{ "@_val": "1" }, { "@_val": "2" }],
      };
      expect(service.getChildByLocalName(parent, "child")).toBeUndefined();
    });

    it("prefers direct match over namespaced match", () => {
      const parent: XmlObject = {
        sld: { "@_direct": "yes" },
        "p:sld": { "@_namespaced": "yes" },
      };
      const result = service.getChildByLocalName(parent, "sld");
      expect(result).toEqual({ "@_direct": "yes" });
    });

    it("handles deeply namespaced keys like a14:ext", () => {
      const parent: XmlObject = {
        "a14:ext": { "@_uri": "some-uri" },
      };
      const result = service.getChildByLocalName(parent, "ext");
      expect(result).toEqual({ "@_uri": "some-uri" });
    });
  });

  // ── getChildrenArrayByLocalName ────────────────────────────────────

  describe("getChildrenArrayByLocalName", () => {
    it("returns empty array for undefined parent", () => {
      expect(service.getChildrenArrayByLocalName(undefined, "child")).toEqual(
        [],
      );
    });

    it("wraps a single object child in an array", () => {
      const parent: XmlObject = {
        "p:ext": { "@_uri": "ext-1" },
      };
      const result = service.getChildrenArrayByLocalName(parent, "ext");
      expect(result).toEqual([{ "@_uri": "ext-1" }]);
    });

    it("returns an array of children when multiple exist", () => {
      const parent: XmlObject = {
        "p:ext": [{ "@_uri": "ext-1" }, { "@_uri": "ext-2" }],
      };
      const result = service.getChildrenArrayByLocalName(parent, "ext");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ "@_uri": "ext-1" });
      expect(result[1]).toEqual({ "@_uri": "ext-2" });
    });

    it("returns empty array when key does not exist", () => {
      const parent: XmlObject = {
        "p:other": { "@_val": "1" },
      };
      expect(service.getChildrenArrayByLocalName(parent, "missing")).toEqual(
        [],
      );
    });

    it("filters out non-object entries in arrays", () => {
      const parent: XmlObject = {
        "p:ext": [{ "@_uri": "ext-1" }, "string-entry", { "@_uri": "ext-2" }],
      };
      const result = service.getChildrenArrayByLocalName(parent, "ext");
      expect(result).toHaveLength(2);
    });

    it("handles direct name match", () => {
      const parent: XmlObject = {
        ext: { "@_uri": "direct" },
      };
      const result = service.getChildrenArrayByLocalName(parent, "ext");
      expect(result).toEqual([{ "@_uri": "direct" }]);
    });

    it("returns empty array for scalar values", () => {
      const parent: XmlObject = {
        "p:ext": 42,
      };
      const result = service.getChildrenArrayByLocalName(parent, "ext");
      expect(result).toEqual([]);
    });
  });

  // ── getScalarChildByLocalName ─────────────────────────────────────

  describe("getScalarChildByLocalName", () => {
    it("returns undefined for undefined parent", () => {
      expect(
        service.getScalarChildByLocalName(undefined, "val"),
      ).toBeUndefined();
    });

    it("returns a direct string value", () => {
      const parent: XmlObject = {
        name: "hello",
      };
      expect(service.getScalarChildByLocalName(parent, "name")).toBe("hello");
    });

    it("returns a numeric value as string", () => {
      const parent: XmlObject = {
        count: 42,
      };
      expect(service.getScalarChildByLocalName(parent, "count")).toBe("42");
    });

    it("returns namespaced scalar by local name", () => {
      const parent: XmlObject = {
        "cp:revision": "5",
      };
      expect(service.getScalarChildByLocalName(parent, "revision")).toBe("5");
    });

    it("returns undefined for object values", () => {
      const parent: XmlObject = {
        child: { nested: "value" },
      };
      expect(
        service.getScalarChildByLocalName(parent, "child"),
      ).toBeUndefined();
    });

    it("returns undefined when key is not found", () => {
      const parent: XmlObject = {
        other: "value",
      };
      expect(
        service.getScalarChildByLocalName(parent, "missing"),
      ).toBeUndefined();
    });

    it("returns numeric 0 as string", () => {
      const parent: XmlObject = {
        "p:count": 0,
      };
      expect(service.getScalarChildByLocalName(parent, "count")).toBe("0");
    });
  });
});
