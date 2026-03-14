import { describe, it, expect } from "vitest";

// Since extractBackgroundColor is a protected method on a deeply chained mixin,
// we extract its pure-logic portion and test it directly.
// The method delegates to this.parseColor() for actual colour resolution,
// so we test the structural XML navigation and fallback logic.

// --- Minimal parseColor stub: returns hex from a:srgbClr ---
function parseColor(node: Record<string, unknown> | undefined): string | undefined {
  if (!node) return undefined;
  const solidFill = node as Record<string, unknown>;
  const srgb = solidFill["a:srgbClr"] as Record<string, unknown> | undefined;
  if (srgb) {
    const val = String(srgb["@_val"] || "").trim();
    return val.length > 0 ? `#${val}` : undefined;
  }
  return undefined;
}

// --- Extracted from extractBackgroundColor ---
function extractBackgroundColor(
  slideXml: Record<string, unknown>,
  rootElement: string = "p:sld",
): string | undefined {
  try {
    const root = slideXml[rootElement] as Record<string, unknown> | undefined;
    const bg = (root?.["p:cSld"] as Record<string, unknown> | undefined)?.[
      "p:bg"
    ] as Record<string, unknown> | undefined;
    if (!bg) return undefined;

    // Try solid fill from bgPr
    const bgPr = bg["p:bgPr"] as Record<string, unknown> | undefined;
    if (bgPr) {
      const solidFill = bgPr["a:solidFill"] as Record<string, unknown> | undefined;
      if (solidFill) {
        return parseColor(solidFill);
      }
      // Pattern fill foreground colour as fallback
      const pattFill = bgPr["a:pattFill"] as Record<string, unknown> | undefined;
      if (pattFill) {
        const fgClr = parseColor(pattFill["a:fgClr"] as Record<string, unknown> | undefined);
        if (fgClr) return fgClr;
        const bgClr = parseColor(pattFill["a:bgClr"] as Record<string, unknown> | undefined);
        if (bgClr) return bgClr;
      }
    }

    // Try bgRef
    const bgRef = bg["p:bgRef"] as Record<string, unknown> | undefined;
    if (bgRef) {
      const solidFill = bgRef["a:solidFill"] as Record<string, unknown> | undefined;
      if (solidFill) {
        return parseColor(solidFill);
      }
      const refColor = parseColor(bgRef);
      if (refColor) return refColor;
      return "#FFFFFF";
    }
  } catch {
    // Ignore
  }
  return undefined;
}

// --- Extracted: check if background has a gradient fill ---
function hasBackgroundGradient(
  slideXml: Record<string, unknown>,
  rootElement: string = "p:sld",
): boolean {
  const root = slideXml[rootElement] as Record<string, unknown> | undefined;
  const bg = (root?.["p:cSld"] as Record<string, unknown> | undefined)?.[
    "p:bg"
  ] as Record<string, unknown> | undefined;
  if (!bg) return false;
  const bgPr = bg["p:bgPr"] as Record<string, unknown> | undefined;
  if (bgPr && bgPr["a:gradFill"]) return true;
  return false;
}

// ---------------------------------------------------------------------------
// extractBackgroundColor
// ---------------------------------------------------------------------------
describe("extractBackgroundColor", () => {
  it("should return undefined when no background is present", () => {
    expect(
      extractBackgroundColor({
        "p:sld": { "p:cSld": {} },
      }),
    ).toBeUndefined();
  });

  it("should return undefined when slideXml has no root element", () => {
    expect(extractBackgroundColor({})).toBeUndefined();
  });

  it("should extract solid fill color from bgPr", () => {
    const result = extractBackgroundColor({
      "p:sld": {
        "p:cSld": {
          "p:bg": {
            "p:bgPr": {
              "a:solidFill": {
                "a:srgbClr": { "@_val": "FF0000" },
              },
            },
          },
        },
      },
    });
    expect(result).toBe("#FF0000");
  });

  it("should use pattern fill foreground as fallback", () => {
    const result = extractBackgroundColor({
      "p:sld": {
        "p:cSld": {
          "p:bg": {
            "p:bgPr": {
              "a:pattFill": {
                "a:fgClr": {
                  "a:srgbClr": { "@_val": "00FF00" },
                },
              },
            },
          },
        },
      },
    });
    expect(result).toBe("#00FF00");
  });

  it("should use pattern fill background colour when foreground is missing", () => {
    const result = extractBackgroundColor({
      "p:sld": {
        "p:cSld": {
          "p:bg": {
            "p:bgPr": {
              "a:pattFill": {
                "a:bgClr": {
                  "a:srgbClr": { "@_val": "0000FF" },
                },
              },
            },
          },
        },
      },
    });
    expect(result).toBe("#0000FF");
  });

  it("should fall through to bgRef when bgPr has no fill", () => {
    const result = extractBackgroundColor({
      "p:sld": {
        "p:cSld": {
          "p:bg": {
            "p:bgRef": {
              "a:solidFill": {
                "a:srgbClr": { "@_val": "AABBCC" },
              },
            },
          },
        },
      },
    });
    expect(result).toBe("#AABBCC");
  });

  it("should default to #FFFFFF when bgRef has no resolvable color", () => {
    const result = extractBackgroundColor({
      "p:sld": {
        "p:cSld": {
          "p:bg": {
            "p:bgRef": { "@_idx": "1001" },
          },
        },
      },
    });
    expect(result).toBe("#FFFFFF");
  });

  it("should work with p:sldLayout root element", () => {
    const result = extractBackgroundColor(
      {
        "p:sldLayout": {
          "p:cSld": {
            "p:bg": {
              "p:bgPr": {
                "a:solidFill": {
                  "a:srgbClr": { "@_val": "112233" },
                },
              },
            },
          },
        },
      },
      "p:sldLayout",
    );
    expect(result).toBe("#112233");
  });

  it("should work with p:sldMaster root element", () => {
    const result = extractBackgroundColor(
      {
        "p:sldMaster": {
          "p:cSld": {
            "p:bg": {
              "p:bgPr": {
                "a:solidFill": {
                  "a:srgbClr": { "@_val": "445566" },
                },
              },
            },
          },
        },
      },
      "p:sldMaster",
    );
    expect(result).toBe("#445566");
  });

  it("should return undefined when bgPr has neither solid, pattern, nor blip fill", () => {
    const result = extractBackgroundColor({
      "p:sld": {
        "p:cSld": {
          "p:bg": {
            "p:bgPr": {
              "a:gradFill": {},
            },
          },
        },
      },
    });
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// hasBackgroundGradient
// ---------------------------------------------------------------------------
describe("hasBackgroundGradient", () => {
  it("should return false when no background is present", () => {
    expect(hasBackgroundGradient({ "p:sld": { "p:cSld": {} } })).toBe(false);
  });

  it("should return true when bgPr contains gradFill", () => {
    expect(
      hasBackgroundGradient({
        "p:sld": {
          "p:cSld": {
            "p:bg": {
              "p:bgPr": {
                "a:gradFill": {
                  "a:gsLst": {},
                },
              },
            },
          },
        },
      }),
    ).toBe(true);
  });

  it("should return false when bgPr contains solidFill instead", () => {
    expect(
      hasBackgroundGradient({
        "p:sld": {
          "p:cSld": {
            "p:bg": {
              "p:bgPr": {
                "a:solidFill": {},
              },
            },
          },
        },
      }),
    ).toBe(false);
  });
});
