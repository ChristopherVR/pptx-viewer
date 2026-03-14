import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimePlaceholderDefaults
// ---------------------------------------------------------------------------

const EMU_PER_PX = 9525;

interface XmlObject {
  [key: string]: unknown;
}

interface PlaceholderDefaults {
  type: string;
  idx?: number;
  bodyInsetLeft?: number;
  bodyInsetTop?: number;
  bodyInsetRight?: number;
  bodyInsetBottom?: number;
  textAnchor?: string;
  autoFit?: boolean;
  autoFitMode?: "shrink" | "normal" | "none";
  autoFitFontScale?: number;
  autoFitLineSpacingReduction?: number;
  textWrap?: string;
  promptText?: string;
  levelStyles?: Record<number, Record<string, unknown>>;
}

function ensureArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Extracted from extractPlaceholderDefaultsFromShape. Simplified to only
 * extract the parts that don't depend on service methods (level style
 * parsing via this.parsePlaceholderLevelStyle and this.parseColor).
 */
function extractPlaceholderDefaultsFromShape(
  shape: XmlObject,
): PlaceholderDefaults | null {
  const nvSpPr = shape["p:nvSpPr"] as XmlObject | undefined;
  const phNode = nvSpPr?.["p:nvPr"]?.["p:ph"] as XmlObject | undefined;
  if (!phNode) return null;

  const typeRaw = phNode["@_type"];
  const idxRaw = phNode["@_idx"];
  const type = typeRaw !== undefined ? String(typeRaw).toLowerCase() : "body";

  const defaults: PlaceholderDefaults = { type };
  if (idxRaw !== undefined) {
    const parsed = Number.parseInt(String(idxRaw), 10);
    if (Number.isFinite(parsed)) {
      defaults.idx = parsed;
    }
  }

  // Body properties (a:bodyPr)
  const txBody = shape["p:txBody"] as XmlObject | undefined;
  const bodyPr = txBody?.["a:bodyPr"] as XmlObject | undefined;
  if (bodyPr) {
    const lIns = bodyPr["@_lIns"];
    if (lIns !== undefined) {
      const val = Number.parseInt(String(lIns), 10);
      if (Number.isFinite(val)) defaults.bodyInsetLeft = val / EMU_PER_PX;
    }
    const tIns = bodyPr["@_tIns"];
    if (tIns !== undefined) {
      const val = Number.parseInt(String(tIns), 10);
      if (Number.isFinite(val)) defaults.bodyInsetTop = val / EMU_PER_PX;
    }
    const rIns = bodyPr["@_rIns"];
    if (rIns !== undefined) {
      const val = Number.parseInt(String(rIns), 10);
      if (Number.isFinite(val)) defaults.bodyInsetRight = val / EMU_PER_PX;
    }
    const bIns = bodyPr["@_bIns"];
    if (bIns !== undefined) {
      const val = Number.parseInt(String(bIns), 10);
      if (Number.isFinite(val)) defaults.bodyInsetBottom = val / EMU_PER_PX;
    }
    const anchor = String(bodyPr["@_anchor"] || "").trim();
    if (anchor.length > 0) defaults.textAnchor = anchor;

    if (bodyPr["a:spAutoFit"] !== undefined) {
      defaults.autoFit = true;
      defaults.autoFitMode = "shrink";
    } else if (bodyPr["a:normAutofit"] !== undefined) {
      defaults.autoFit = true;
      defaults.autoFitMode = "normal";
      const fontScaleRaw = parseInt(
        String(
          (bodyPr["a:normAutofit"] as Record<string, unknown>)?.["@_fontScale"] || "",
        ),
        10,
      );
      if (Number.isFinite(fontScaleRaw) && fontScaleRaw > 0) {
        defaults.autoFitFontScale = fontScaleRaw / 100000;
      }
      const lnSpcReductionRaw = parseInt(
        String(
          (bodyPr["a:normAutofit"] as Record<string, unknown>)?.["@_lnSpcReduction"] || "",
        ),
        10,
      );
      if (Number.isFinite(lnSpcReductionRaw) && lnSpcReductionRaw > 0) {
        defaults.autoFitLineSpacingReduction = lnSpcReductionRaw / 100000;
      }
    } else if (bodyPr["a:noAutofit"] !== undefined) {
      defaults.autoFit = false;
      defaults.autoFitMode = "none";
    }

    const wrapAttr = String(bodyPr["@_wrap"] || "")
      .trim()
      .toLowerCase();
    if (wrapAttr === "none" || wrapAttr === "square") {
      defaults.textWrap = wrapAttr;
    }
  }

  // Extract prompt text from paragraphs
  if (txBody) {
    const paras = ensureArray(txBody["a:p"]) as XmlObject[];
    const promptParts: string[] = [];
    for (const p of paras) {
      const runs = ensureArray(p?.["a:r"]) as XmlObject[];
      for (const r of runs) {
        if (!r) continue;
        const t = r["a:t"];
        if (t !== undefined) {
          promptParts.push(String(t));
        }
      }
      if (p?.["a:t"] !== undefined) {
        promptParts.push(String(p["a:t"]));
      }
      const fields = ensureArray(p?.["a:fld"]) as XmlObject[];
      for (const field of fields) {
        if (!field) continue;
        const t = field["a:t"];
        if (t !== undefined) {
          promptParts.push(String(t));
        }
      }
    }
    const promptText = promptParts.join("").trim();
    if (promptText.length > 0) {
      defaults.promptText = promptText;
    }
  }

  return defaults;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("extractPlaceholderDefaultsFromShape", () => {
  it("should return null when no p:nvSpPr", () => {
    expect(extractPlaceholderDefaultsFromShape({})).toBeNull();
  });

  it("should return null when no p:ph node", () => {
    expect(
      extractPlaceholderDefaultsFromShape({
        "p:nvSpPr": { "p:nvPr": {} },
      }),
    ).toBeNull();
  });

  it("should default type to body when @_type is absent", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": {} } },
    });
    expect(result!.type).toBe("body");
  });

  it("should extract type", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "title" } } },
    });
    expect(result!.type).toBe("title");
  });

  it("should lowercase the type", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "CtrTitle" } } },
    });
    expect(result!.type).toBe("ctrtitle");
  });

  it("should extract idx as number", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_idx": "2" } } },
    });
    expect(result!.idx).toBe(2);
  });

  it("should ignore non-finite idx", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_idx": "abc" } } },
    });
    expect(result!.idx).toBeUndefined();
  });

  it("should extract body insets", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "body" } } },
      "p:txBody": {
        "a:bodyPr": {
          "@_lIns": "91440",
          "@_tIns": "45720",
          "@_rIns": "91440",
          "@_bIns": "45720",
        },
      },
    });
    expect(result!.bodyInsetLeft).toBeCloseTo(91440 / EMU_PER_PX);
    expect(result!.bodyInsetTop).toBeCloseTo(45720 / EMU_PER_PX);
    expect(result!.bodyInsetRight).toBeCloseTo(91440 / EMU_PER_PX);
    expect(result!.bodyInsetBottom).toBeCloseTo(45720 / EMU_PER_PX);
  });

  it("should extract textAnchor", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "body" } } },
      "p:txBody": {
        "a:bodyPr": { "@_anchor": "ctr" },
      },
    });
    expect(result!.textAnchor).toBe("ctr");
  });

  it("should not set textAnchor when empty", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "body" } } },
      "p:txBody": {
        "a:bodyPr": { "@_anchor": "" },
      },
    });
    expect(result!.textAnchor).toBeUndefined();
  });

  it("should detect spAutoFit", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "body" } } },
      "p:txBody": {
        "a:bodyPr": { "a:spAutoFit": {} },
      },
    });
    expect(result!.autoFit).toBe(true);
    expect(result!.autoFitMode).toBe("shrink");
  });

  it("should detect normAutofit with fontScale and lnSpcReduction", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "body" } } },
      "p:txBody": {
        "a:bodyPr": {
          "a:normAutofit": { "@_fontScale": "90000", "@_lnSpcReduction": "20000" },
        },
      },
    });
    expect(result!.autoFit).toBe(true);
    expect(result!.autoFitMode).toBe("normal");
    expect(result!.autoFitFontScale).toBeCloseTo(0.9);
    expect(result!.autoFitLineSpacingReduction).toBeCloseTo(0.2);
  });

  it("should detect noAutofit", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "body" } } },
      "p:txBody": {
        "a:bodyPr": { "a:noAutofit": {} },
      },
    });
    expect(result!.autoFit).toBe(false);
    expect(result!.autoFitMode).toBe("none");
  });

  it("should extract textWrap none", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "body" } } },
      "p:txBody": {
        "a:bodyPr": { "@_wrap": "none" },
      },
    });
    expect(result!.textWrap).toBe("none");
  });

  it("should extract textWrap square", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "body" } } },
      "p:txBody": {
        "a:bodyPr": { "@_wrap": "square" },
      },
    });
    expect(result!.textWrap).toBe("square");
  });

  it("should not set textWrap for invalid values", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "body" } } },
      "p:txBody": {
        "a:bodyPr": { "@_wrap": "custom" },
      },
    });
    expect(result!.textWrap).toBeUndefined();
  });

  it("should extract prompt text from runs", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "title" } } },
      "p:txBody": {
        "a:p": {
          "a:r": { "a:t": "Click to add title" },
        },
      },
    });
    expect(result!.promptText).toBe("Click to add title");
  });

  it("should extract prompt text from multiple runs across paragraphs", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "body" } } },
      "p:txBody": {
        "a:p": [
          { "a:r": [{ "a:t": "Click " }, { "a:t": "to" }] },
          { "a:r": { "a:t": " add text" } },
        ],
      },
    });
    expect(result!.promptText).toBe("Click to add text");
  });

  it("should extract prompt text from field elements", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "dt" } } },
      "p:txBody": {
        "a:p": {
          "a:fld": { "a:t": "12/15/2024" },
        },
      },
    });
    expect(result!.promptText).toBe("12/15/2024");
  });

  it("should extract prompt text from direct p a:t", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "sldNum" } } },
      "p:txBody": {
        "a:p": {
          "a:t": "42",
        },
      },
    });
    expect(result!.promptText).toBe("42");
  });

  it("should not set promptText for empty text", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "body" } } },
      "p:txBody": {
        "a:p": {},
      },
    });
    expect(result!.promptText).toBeUndefined();
  });

  it("should handle normAutofit without fontScale", () => {
    const result = extractPlaceholderDefaultsFromShape({
      "p:nvSpPr": { "p:nvPr": { "p:ph": { "@_type": "body" } } },
      "p:txBody": {
        "a:bodyPr": { "a:normAutofit": {} },
      },
    });
    expect(result!.autoFit).toBe(true);
    expect(result!.autoFitMode).toBe("normal");
    expect(result!.autoFitFontScale).toBeUndefined();
    expect(result!.autoFitLineSpacingReduction).toBeUndefined();
  });
});
