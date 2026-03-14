import { describe, it, expect } from "vitest";
import {
  _b,
  gB,
  gL,
  grp,
  pill,
  ic,
  ics,
  MODES,
  ALIGN_BTNS,
  DRAW_TOOLS,
  OV,
  FMT,
  ATXT,
} from "./toolbar-constants";

// ---------------------------------------------------------------------------
// Style token strings
// ---------------------------------------------------------------------------

describe("style token strings", () => {
  it("_b contains base flex alignment classes", () => {
    expect(_b).toContain("inline-flex");
    expect(_b).toContain("items-center");
    expect(_b).toContain("justify-center");
  });

  it("gB extends _b with border and hover classes", () => {
    expect(gB).toContain(_b);
    expect(gB).toContain("border-r");
    expect(gB).toContain("hover:bg-accent");
    expect(gB).toContain("disabled:opacity-40");
  });

  it("gL extends _b with hover but no border-r", () => {
    expect(gL).toContain(_b);
    expect(gL).toContain("hover:bg-accent");
    expect(gL).not.toContain("border-r");
  });

  it("grp includes rounded and overflow-hidden", () => {
    expect(grp).toContain("rounded");
    expect(grp).toContain("overflow-hidden");
    expect(grp).toContain("inline-flex");
  });

  it("pill includes rounded, gap, and transition-colors", () => {
    expect(pill).toContain("rounded");
    expect(pill).toContain("gap-1.5");
    expect(pill).toContain("transition-colors");
  });

  it("ic is the standard icon size class", () => {
    expect(ic).toBe("w-4 h-4");
  });

  it("ics is the small icon size class", () => {
    expect(ics).toBe("w-3.5 h-3.5");
  });
});

// ---------------------------------------------------------------------------
// MODES
// ---------------------------------------------------------------------------

describe("MODES", () => {
  it("contains exactly three viewer modes", () => {
    expect(MODES).toHaveLength(3);
  });

  it("includes edit, preview, and present", () => {
    expect(MODES).toContain("edit");
    expect(MODES).toContain("preview");
    expect(MODES).toContain("present");
  });

  it("has edit as the first mode", () => {
    expect(MODES[0]).toBe("edit");
  });
});

// ---------------------------------------------------------------------------
// ALIGN_BTNS
// ---------------------------------------------------------------------------

describe("ALIGN_BTNS", () => {
  it("contains six alignment buttons", () => {
    expect(ALIGN_BTNS).toHaveLength(6);
  });

  it("each button has a k and el property", () => {
    for (const btn of ALIGN_BTNS) {
      expect(btn).toHaveProperty("k");
      expect(btn).toHaveProperty("el");
      expect(typeof btn.k).toBe("string");
    }
  });

  it("includes horizontal and vertical alignment keys", () => {
    const keys = ALIGN_BTNS.map((b) => b.k);
    expect(keys).toContain("left");
    expect(keys).toContain("center");
    expect(keys).toContain("right");
    expect(keys).toContain("top");
    expect(keys).toContain("middle");
    expect(keys).toContain("bottom");
  });
});

// ---------------------------------------------------------------------------
// DRAW_TOOLS
// ---------------------------------------------------------------------------

describe("DRAW_TOOLS", () => {
  it("contains five drawing tools", () => {
    expect(DRAW_TOOLS).toHaveLength(5);
  });

  it("each tool has id, icon, and t properties", () => {
    for (const tool of DRAW_TOOLS) {
      expect(typeof tool.id).toBe("string");
      expect(tool.icon).toBeDefined();
      expect(typeof tool.t).toBe("string");
    }
  });

  it("includes select, pen, highlighter, eraser, and freeform", () => {
    const ids = DRAW_TOOLS.map((d) => d.id);
    expect(ids).toContain("select");
    expect(ids).toContain("pen");
    expect(ids).toContain("highlighter");
    expect(ids).toContain("eraser");
    expect(ids).toContain("freeform");
  });

  it("highlighter has a custom active class", () => {
    const highlighter = DRAW_TOOLS.find((d) => d.id === "highlighter");
    expect(highlighter?.ac).toContain("bg-yellow-600");
  });

  it("select tool does not have a custom active class", () => {
    const select = DRAW_TOOLS.find((d) => d.id === "select");
    expect(select?.ac).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// OV (overflow menu items)
// ---------------------------------------------------------------------------

describe("OV", () => {
  it("is a non-empty array", () => {
    expect(OV.length).toBeGreaterThan(0);
  });

  it("each item has l, i, and k properties", () => {
    for (const item of OV) {
      expect(item).toHaveProperty("l");
      expect(item).toHaveProperty("i");
      expect(item).toHaveProperty("k");
    }
  });

  it("contains export options for png, pdf, video, gif", () => {
    const keys = OV.map((o) => o.k);
    expect(keys).toContain("png");
    expect(keys).toContain("pdf");
    expect(keys).toContain("video");
    expect(keys).toContain("gif");
  });

  it("contains separators with empty labels", () => {
    const seps = OV.filter((o) => o.k.startsWith("---"));
    expect(seps.length).toBeGreaterThan(0);
    for (const sep of seps) {
      expect(sep.l).toBe("");
      expect(sep.i).toBeNull();
    }
  });

  it("contains utility items like print, a11y, shortcuts", () => {
    const keys = OV.map((o) => o.k);
    expect(keys).toContain("print");
    expect(keys).toContain("a11y");
    expect(keys).toContain("shortcuts");
  });

  it("contains document management items", () => {
    const keys = OV.map((o) => o.k);
    expect(keys).toContain("documentProperties");
    expect(keys).toContain("passwordProtection");
    expect(keys).toContain("fontEmbedding");
    expect(keys).toContain("digitalSignatures");
    expect(keys).toContain("versionHistory");
  });
});

// ---------------------------------------------------------------------------
// FMT (formatting buttons)
// ---------------------------------------------------------------------------

describe("FMT", () => {
  it("contains four formatting buttons", () => {
    expect(FMT).toHaveLength(4);
  });

  it("each button has i and t properties", () => {
    for (const btn of FMT) {
      expect(btn.i).toBeDefined();
      expect(typeof btn.t).toBe("string");
    }
  });

  it("includes Bold, Italic, Underline, and Strikethrough", () => {
    const labels = FMT.map((f) => f.t);
    expect(labels).toEqual(["Bold", "Italic", "Underline", "Strikethrough"]);
  });
});

// ---------------------------------------------------------------------------
// ATXT (text alignment buttons)
// ---------------------------------------------------------------------------

describe("ATXT", () => {
  it("contains four alignment buttons", () => {
    expect(ATXT).toHaveLength(4);
  });

  it("each button has i and t properties", () => {
    for (const btn of ATXT) {
      expect(btn.i).toBeDefined();
      expect(typeof btn.t).toBe("string");
    }
  });

  it("includes left, center, right, and justify", () => {
    const labels = ATXT.map((a) => a.t);
    expect(labels).toEqual([
      "Align left",
      "Align center",
      "Align right",
      "Justify",
    ]);
  });
});
