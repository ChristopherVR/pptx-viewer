import { describe, it, expect } from "vitest";
import {
  selectAlternateContentBranch,
  unwrapAlternateContent,
  areNamespacesSupported,
  isNamespaceSupported,
  getSupportedNamespaces,
} from "./alternate-content";

describe("areNamespacesSupported", () => {
  it("returns true for empty or whitespace requires", () => {
    expect(areNamespacesSupported("")).toBe(true);
    expect(areNamespacesSupported("  ")).toBe(true);
  });

  it("returns true for known namespaces", () => {
    expect(areNamespacesSupported("p14")).toBe(true);
    expect(areNamespacesSupported("p15")).toBe(true);
    expect(areNamespacesSupported("a14")).toBe(true);
    expect(areNamespacesSupported("asvg")).toBe(true);
  });

  it("returns true for multiple known namespaces", () => {
    expect(areNamespacesSupported("p14 a14")).toBe(true);
    expect(areNamespacesSupported("p15 a16 asvg")).toBe(true);
  });

  it("returns false when any namespace is unknown", () => {
    expect(areNamespacesSupported("p99")).toBe(false);
    expect(areNamespacesSupported("p14 unknownNs")).toBe(false);
  });
});

describe("isNamespaceSupported", () => {
  it("returns true for supported namespaces", () => {
    expect(isNamespaceSupported("p14")).toBe(true);
    expect(isNamespaceSupported("p16r3")).toBe(true);
  });

  it("returns false for unsupported namespaces", () => {
    expect(isNamespaceSupported("p99")).toBe(false);
  });
});

describe("getSupportedNamespaces", () => {
  it("returns a set containing known namespaces", () => {
    const ns = getSupportedNamespaces();
    expect(ns.has("p14")).toBe(true);
    expect(ns.has("a14")).toBe(true);
    expect(ns.has("p16r3")).toBe(true);
  });
});

describe("selectAlternateContentBranch", () => {
  it("returns Choice when requires is supported", () => {
    const ac = {
      "mc:Choice": {
        "@_Requires": "p14",
        "p:sp": { id: "choiceShape" },
      },
      "mc:Fallback": {
        "p:sp": { id: "fallbackShape" },
      },
    };

    const result = selectAlternateContentBranch(ac);
    expect(result).toBeDefined();
    expect((result?.["p:sp"] as { id: string })?.id).toBe("choiceShape");
  });

  it("returns Fallback when requires is not supported", () => {
    const ac = {
      "mc:Choice": {
        "@_Requires": "p99",
        "p:sp": { id: "choiceShape" },
      },
      "mc:Fallback": {
        "p:sp": { id: "fallbackShape" },
      },
    };

    const result = selectAlternateContentBranch(ac);
    expect(result).toBeDefined();
    expect((result?.["p:sp"] as { id: string })?.id).toBe("fallbackShape");
  });

  it("returns Choice with empty Requires", () => {
    const ac = {
      "mc:Choice": {
        "@_Requires": "",
        "p:sp": { id: "choiceShape" },
      },
      "mc:Fallback": {
        "p:sp": { id: "fallbackShape" },
      },
    };

    const result = selectAlternateContentBranch(ac);
    expect(result).toBeDefined();
    expect((result?.["p:sp"] as { id: string })?.id).toBe("choiceShape");
  });

  it("returns undefined when no Choice matches and no Fallback", () => {
    const ac = {
      "mc:Choice": {
        "@_Requires": "p99",
        "p:sp": { id: "choiceShape" },
      },
    };

    const result = selectAlternateContentBranch(ac);
    expect(result).toBeUndefined();
  });

  it("iterates multiple Choices and picks first matching", () => {
    const ac = {
      "mc:Choice": [
        {
          "@_Requires": "p99",
          "p:sp": { id: "choice1" },
        },
        {
          "@_Requires": "p14",
          "p:sp": { id: "choice2" },
        },
      ],
      "mc:Fallback": {
        "p:sp": { id: "fallback" },
      },
    };

    const result = selectAlternateContentBranch(ac);
    expect(result).toBeDefined();
    expect((result?.["p:sp"] as { id: string })?.id).toBe("choice2");
  });

  it("handles multi-namespace Requires", () => {
    const ac = {
      "mc:Choice": {
        "@_Requires": "p14 a14",
        "p:sp": { id: "choiceShape" },
      },
      "mc:Fallback": {
        "p:sp": { id: "fallbackShape" },
      },
    };

    const result = selectAlternateContentBranch(ac);
    expect(result).toBeDefined();
    expect((result?.["p:sp"] as { id: string })?.id).toBe("choiceShape");
  });

  it("falls back when one of multiple namespaces is unsupported", () => {
    const ac = {
      "mc:Choice": {
        "@_Requires": "p14 unknownNs",
        "p:sp": { id: "choiceShape" },
      },
      "mc:Fallback": {
        "p:sp": { id: "fallbackShape" },
      },
    };

    const result = selectAlternateContentBranch(ac);
    expect(result).toBeDefined();
    expect((result?.["p:sp"] as { id: string })?.id).toBe("fallbackShape");
  });

  it("handles nested AlternateContent in Choice branch", () => {
    const ac = {
      "mc:Choice": {
        "@_Requires": "p14",
        "mc:AlternateContent": {
          "mc:Choice": {
            "@_Requires": "p99",
            "p:sp": { id: "nestedChoice" },
          },
          "mc:Fallback": {
            "p:sp": { id: "nestedFallback" },
          },
        },
      },
      "mc:Fallback": {
        "p:sp": { id: "outerFallback" },
      },
    };

    const result = selectAlternateContentBranch(ac);
    expect(result).toBeDefined();
    // The nested AC should resolve to its fallback since p99 is not supported
    expect((result?.["p:sp"] as { id: string })?.id).toBe("nestedFallback");
  });

  it("handles nested AlternateContent in Fallback branch", () => {
    const ac = {
      "mc:Choice": {
        "@_Requires": "p99",
        "p:sp": { id: "outerChoice" },
      },
      "mc:Fallback": {
        "mc:AlternateContent": {
          "mc:Choice": {
            "@_Requires": "p14",
            "p:sp": { id: "nestedChoice" },
          },
          "mc:Fallback": {
            "p:sp": { id: "nestedFallback" },
          },
        },
      },
    };

    const result = selectAlternateContentBranch(ac);
    expect(result).toBeDefined();
    // Outer falls back, nested Choice (p14) is supported
    expect((result?.["p:sp"] as { id: string })?.id).toBe("nestedChoice");
  });
});

describe("unwrapAlternateContent", () => {
  it("does nothing when no mc:AlternateContent is present", () => {
    const container: Record<string, unknown> = {
      "p:sp": [{ id: "existingShape" }],
    };
    unwrapAlternateContent(container);
    expect((container["p:sp"] as unknown[]).length).toBe(1);
  });

  it("merges Choice elements into container when supported", () => {
    const container: Record<string, unknown> = {
      "p:sp": [{ id: "existing" }],
      "mc:AlternateContent": {
        "mc:Choice": {
          "@_Requires": "p14",
          "p:sp": { id: "fromChoice" },
        },
        "mc:Fallback": {
          "p:sp": { id: "fromFallback" },
        },
      },
    };

    unwrapAlternateContent(container);
    const shapes = container["p:sp"] as Array<{ id: string }>;
    expect(shapes.length).toBe(2);
    expect(shapes[0].id).toBe("existing");
    expect(shapes[1].id).toBe("fromChoice");
  });

  it("merges Fallback elements into container when not supported", () => {
    const container: Record<string, unknown> = {
      "mc:AlternateContent": {
        "mc:Choice": {
          "@_Requires": "p99",
          "p:sp": { id: "fromChoice" },
        },
        "mc:Fallback": {
          "p:pic": { id: "fromFallback" },
        },
      },
    };

    unwrapAlternateContent(container);
    const pics = container["p:pic"] as Array<{ id: string }>;
    expect(pics.length).toBe(1);
    expect(pics[0].id).toBe("fromFallback");
    // Choice shape should NOT be present
    expect(container["p:sp"]).toBeUndefined();
  });

  it("handles multiple mc:AlternateContent blocks", () => {
    const container: Record<string, unknown> = {
      "mc:AlternateContent": [
        {
          "mc:Choice": {
            "@_Requires": "p14",
            "p:sp": { id: "ac1Choice" },
          },
          "mc:Fallback": {
            "p:sp": { id: "ac1Fallback" },
          },
        },
        {
          "mc:Choice": {
            "@_Requires": "p99",
            "p:sp": { id: "ac2Choice" },
          },
          "mc:Fallback": {
            "p:pic": { id: "ac2Fallback" },
          },
        },
      ],
    };

    unwrapAlternateContent(container);
    const shapes = container["p:sp"] as Array<{ id: string }>;
    expect(shapes.length).toBe(1);
    expect(shapes[0].id).toBe("ac1Choice");

    const pics = container["p:pic"] as Array<{ id: string }>;
    expect(pics.length).toBe(1);
    expect(pics[0].id).toBe("ac2Fallback");
  });

  it("handles graphicFrame, grpSp, cxnSp, contentPart tags", () => {
    const container: Record<string, unknown> = {
      "mc:AlternateContent": {
        "mc:Choice": {
          "@_Requires": "a14",
          "p:graphicFrame": { id: "frame1" },
          "p:cxnSp": { id: "conn1" },
        },
        "mc:Fallback": {},
      },
    };

    unwrapAlternateContent(container);
    expect(
      (container["p:graphicFrame"] as Array<{ id: string }>)[0].id,
    ).toBe("frame1");
    expect((container["p:cxnSp"] as Array<{ id: string }>)[0].id).toBe(
      "conn1",
    );
  });
});
