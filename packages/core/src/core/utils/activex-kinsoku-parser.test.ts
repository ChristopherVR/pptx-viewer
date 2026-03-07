import { describe, it, expect } from "vitest";
import { parseActiveXControlsFromSlide } from "./activex-parser";
import { parseKinsoku, applyKinsokuToXml } from "./kinsoku-parser";
import type { XmlObject } from "../types";

// ---------------------------------------------------------------------------
// GAP-9: ActiveX Controls
// ---------------------------------------------------------------------------
describe("parseActiveXControlsFromSlide", () => {
  it("returns empty array for missing p:sld", () => {
    const xml: XmlObject = {};
    expect(parseActiveXControlsFromSlide(xml)).toEqual([]);
  });

  it("returns empty array for missing p:cSld", () => {
    const xml: XmlObject = { "p:sld": {} };
    expect(parseActiveXControlsFromSlide(xml)).toEqual([]);
  });

  it("returns empty array for missing p:controls", () => {
    const xml: XmlObject = {
      "p:sld": { "p:cSld": {} },
    };
    expect(parseActiveXControlsFromSlide(xml)).toEqual([]);
  });

  it("returns empty array for empty p:controls", () => {
    const xml: XmlObject = {
      "p:sld": { "p:cSld": { "p:controls": {} } },
    };
    expect(parseActiveXControlsFromSlide(xml)).toEqual([]);
  });

  it("parses single control with r:id, name, spid", () => {
    const control: XmlObject = {
      "@_r:id": "rId3",
      "@_name": "TextBox1",
      "@_spid": "_x0000_s1025",
    };
    const xml: XmlObject = {
      "p:sld": {
        "p:cSld": {
          "p:controls": { "p:control": control },
        },
      },
    };
    const result = parseActiveXControlsFromSlide(xml);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      relId: "rId3",
      name: "TextBox1",
      shapeId: "_x0000_s1025",
      rawXml: control,
    });
  });

  it("parses multiple controls", () => {
    const c1: XmlObject = { "@_r:id": "rId1", "@_name": "Button1" };
    const c2: XmlObject = { "@_r:id": "rId2", "@_name": "CheckBox1" };
    const xml: XmlObject = {
      "p:sld": {
        "p:cSld": {
          "p:controls": { "p:control": [c1, c2] },
        },
      },
    };
    const result = parseActiveXControlsFromSlide(xml);
    expect(result).toHaveLength(2);
    expect(result[0].relId).toBe("rId1");
    expect(result[0].name).toBe("Button1");
    expect(result[1].relId).toBe("rId2");
    expect(result[1].name).toBe("CheckBox1");
  });

  it("skips controls without r:id", () => {
    const c1: XmlObject = { "@_name": "NoId" };
    const c2: XmlObject = { "@_r:id": "rId5", "@_name": "HasId" };
    const xml: XmlObject = {
      "p:sld": {
        "p:cSld": {
          "p:controls": { "p:control": [c1, c2] },
        },
      },
    };
    const result = parseActiveXControlsFromSlide(xml);
    expect(result).toHaveLength(1);
    expect(result[0].relId).toBe("rId5");
  });

  it("handles controls where name/spid are optional (undefined)", () => {
    const control: XmlObject = { "@_r:id": "rId7" };
    const xml: XmlObject = {
      "p:sld": {
        "p:cSld": {
          "p:controls": { "p:control": control },
        },
      },
    };
    const result = parseActiveXControlsFromSlide(xml);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBeUndefined();
    expect(result[0].shapeId).toBeUndefined();
  });

  it("preserves rawXml reference", () => {
    const control: XmlObject = {
      "@_r:id": "rId10",
      "@_name": "ComboBox1",
      "p:extLst": { "p:ext": { "@_uri": "someUri" } },
    };
    const xml: XmlObject = {
      "p:sld": {
        "p:cSld": {
          "p:controls": { "p:control": control },
        },
      },
    };
    const result = parseActiveXControlsFromSlide(xml);
    expect(result[0].rawXml).toBe(control);
  });
});

// ---------------------------------------------------------------------------
// GAP-10: Kinsoku – parse
// ---------------------------------------------------------------------------
describe("parseKinsoku", () => {
  it("returns undefined when no p:kinsoku element", () => {
    const xml: XmlObject = {
      "p:presentation": {},
    };
    expect(parseKinsoku(xml)).toBeUndefined();
  });

  it("returns undefined when presentation is undefined", () => {
    expect(parseKinsoku(undefined)).toBeUndefined();
  });

  it("parses lang attribute", () => {
    const xml: XmlObject = {
      "p:presentation": {
        "p:kinsoku": { "@_lang": "ja-JP" },
      },
    };
    const result = parseKinsoku(xml);
    expect(result).toBeDefined();
    expect(result!.lang).toBe("ja-JP");
  });

  it("parses invalStChars attribute", () => {
    const xml: XmlObject = {
      "p:presentation": {
        "p:kinsoku": { "@_invalStChars": "!%),.:;?]}" },
      },
    };
    const result = parseKinsoku(xml);
    expect(result!.invalStChars).toBe("!%),.:;?]}");
  });

  it("parses invalEndChars attribute", () => {
    const xml: XmlObject = {
      "p:presentation": {
        "p:kinsoku": { "@_invalEndChars": "$([{" },
      },
    };
    const result = parseKinsoku(xml);
    expect(result!.invalEndChars).toBe("$([{");
  });

  it("parses all attributes together", () => {
    const xml: XmlObject = {
      "p:presentation": {
        "p:kinsoku": {
          "@_lang": "zh-CN",
          "@_invalStChars": "!%),.:;?]}",
          "@_invalEndChars": "$([{",
        },
      },
    };
    const result = parseKinsoku(xml);
    expect(result).toEqual({
      lang: "zh-CN",
      invalStChars: "!%),.:;?]}",
      invalEndChars: "$([{",
    });
  });

  it("ignores empty lang strings", () => {
    const xml: XmlObject = {
      "p:presentation": {
        "p:kinsoku": {
          "@_lang": "  ",
          "@_invalStChars": "abc",
        },
      },
    };
    const result = parseKinsoku(xml);
    expect(result!.lang).toBeUndefined();
    expect(result!.invalStChars).toBe("abc");
  });

  it("returns empty object when kinsoku exists but has no attributes", () => {
    const xml: XmlObject = {
      "p:presentation": {
        "p:kinsoku": {},
      },
    };
    const result = parseKinsoku(xml);
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// GAP-10: Kinsoku – save / apply
// ---------------------------------------------------------------------------
describe("applyKinsokuToXml", () => {
  it("does nothing when kinsoku is undefined", () => {
    const pres: XmlObject = {};
    applyKinsokuToXml(pres, undefined);
    expect(pres["p:kinsoku"]).toBeUndefined();
  });

  it("creates p:kinsoku element with lang", () => {
    const pres: XmlObject = {};
    applyKinsokuToXml(pres, { lang: "ko-KR" });
    expect(pres["p:kinsoku"]).toEqual({ "@_lang": "ko-KR" });
  });

  it("creates p:kinsoku with all fields", () => {
    const pres: XmlObject = {};
    applyKinsokuToXml(pres, {
      lang: "ja-JP",
      invalStChars: "!%)",
      invalEndChars: "$(",
    });
    expect(pres["p:kinsoku"]).toEqual({
      "@_lang": "ja-JP",
      "@_invalStChars": "!%)",
      "@_invalEndChars": "$(",
    });
  });

  it("merges into existing p:kinsoku element", () => {
    const pres: XmlObject = {
      "p:kinsoku": { "@_lang": "ja-JP" },
    };
    applyKinsokuToXml(pres, { invalStChars: "xyz" });
    expect(pres["p:kinsoku"]).toEqual({
      "@_lang": "ja-JP",
      "@_invalStChars": "xyz",
    });
  });

  it("preserves existing p:kinsoku attributes not in the kinsoku object", () => {
    const pres: XmlObject = {
      "p:kinsoku": {
        "@_lang": "zh-TW",
        "@_invalStChars": "old",
        "@_invalEndChars": "keep",
      },
    };
    applyKinsokuToXml(pres, { lang: "zh-CN" });
    const k = pres["p:kinsoku"] as XmlObject;
    expect(k["@_lang"]).toBe("zh-CN");
    expect(k["@_invalStChars"]).toBe("old");
    expect(k["@_invalEndChars"]).toBe("keep");
  });
});
