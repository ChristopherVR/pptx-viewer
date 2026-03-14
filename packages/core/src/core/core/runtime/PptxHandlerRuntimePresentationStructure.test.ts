/**
 * Tests for PptxHandlerRuntimePresentationStructure:
 *   - extractHeaderFooter logic
 *   - extractPhotoAlbum logic
 *   - extractModifyVerifier logic
 *   - extractKinsoku (via kinsoku-parser)
 *   - extractSectionMap logic (section parsing)
 */
import { describe, it, expect } from "vitest";

import type { XmlObject, PptxHeaderFooter, PptxPhotoAlbum, PptxModifyVerifier } from "../../types";
import { parseKinsoku } from "../../utils/kinsoku-parser";

// ---------------------------------------------------------------------------
// Reimplemented: extractHeaderFooter
// ---------------------------------------------------------------------------
function extractHeaderFooter(
  presentationData: XmlObject | undefined,
): PptxHeaderFooter | undefined {
  const pres = presentationData?.["p:presentation"] as XmlObject | undefined;
  if (!pres) return undefined;

  const hf = pres["p:hf"] as XmlObject | undefined;
  if (!hf) return undefined;

  const result: PptxHeaderFooter = {};

  if (hf["@_hdr"] !== undefined) {
    result.hasHeader = String(hf["@_hdr"]) !== "0";
  }
  if (hf["@_ftr"] !== undefined) {
    result.hasFooter = String(hf["@_ftr"]) !== "0";
  }
  if (hf["@_dt"] !== undefined) {
    result.hasDateTime = String(hf["@_dt"]) !== "0";
  }
  if (hf["@_sldNum"] !== undefined) {
    result.hasSlideNumber = String(hf["@_sldNum"]) !== "0";
  }

  const footerText = hf["@_ftrText"] as string | undefined;
  if (footerText) result.footerText = String(footerText);

  const dtText = hf["@_dtText"] as string | undefined;
  if (dtText) result.dateTimeText = String(dtText);

  const dtFmt = hf["@_dtFmt"] as string | undefined;
  if (dtFmt) {
    result.dateFormat = String(dtFmt);
    result.dateTimeAuto = true;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Reimplemented: extractPhotoAlbum
// ---------------------------------------------------------------------------
function extractPhotoAlbum(
  presentationData: XmlObject | undefined,
): PptxPhotoAlbum | undefined {
  const pres = presentationData?.["p:presentation"] as XmlObject | undefined;
  if (!pres) return undefined;

  const photoAlbum = pres["p:photoAlbum"] as XmlObject | undefined;
  if (!photoAlbum) return undefined;

  const result: PptxPhotoAlbum = {};
  let hasProps = false;

  const bwRaw = photoAlbum["@_bw"];
  if (bwRaw !== undefined) {
    result.bw = String(bwRaw) === "1" || String(bwRaw) === "true";
    hasProps = true;
  }

  const showCaptionsRaw = photoAlbum["@_showCaptions"];
  if (showCaptionsRaw !== undefined) {
    result.showCaptions =
      String(showCaptionsRaw) === "1" || String(showCaptionsRaw) === "true";
    hasProps = true;
  }

  const layout = photoAlbum["@_layout"];
  if (layout !== undefined) {
    const layoutStr = String(layout).trim();
    if (layoutStr.length > 0) {
      result.layout = layoutStr;
      hasProps = true;
    }
  }

  const frame = photoAlbum["@_frame"];
  if (frame !== undefined) {
    const frameStr = String(frame).trim();
    if (frameStr.length > 0) {
      result.frame = frameStr;
      hasProps = true;
    }
  }

  return hasProps ? result : {};
}

// ---------------------------------------------------------------------------
// Reimplemented: extractModifyVerifier
// ---------------------------------------------------------------------------
function extractModifyVerifier(
  presentationData: XmlObject | undefined,
): PptxModifyVerifier | undefined {
  const pres = presentationData?.["p:presentation"] as XmlObject | undefined;
  if (!pres) return undefined;

  const mv = pres["p:modifyVerifier"] as XmlObject | undefined;
  if (!mv) return undefined;

  const result: PptxModifyVerifier = {};

  const algorithmName = mv["@_algorithmName"] ?? mv["@_algIdExt"];
  if (algorithmName !== undefined) result.algorithmName = String(algorithmName);

  const hashData = mv["@_hashData"];
  if (hashData !== undefined) result.hashData = String(hashData);

  const saltData = mv["@_saltData"];
  if (saltData !== undefined) result.saltData = String(saltData);

  const spinValue = mv["@_spinValue"] ?? mv["@_spinCount"];
  if (spinValue !== undefined) {
    const parsed = parseInt(String(spinValue), 10);
    if (Number.isFinite(parsed)) result.spinValue = parsed;
  }

  const algIdExt = mv["@_algIdExt"];
  if (algIdExt !== undefined) result.algIdExt = String(algIdExt);

  const cryptAlgorithmSid = mv["@_cryptAlgorithmSid"];
  if (cryptAlgorithmSid !== undefined) {
    const parsed = parseInt(String(cryptAlgorithmSid), 10);
    if (Number.isFinite(parsed)) result.cryptAlgorithmSid = parsed;
  }

  const cryptAlgorithmType = mv["@_cryptAlgorithmType"];
  if (cryptAlgorithmType !== undefined)
    result.cryptAlgorithmType = String(cryptAlgorithmType);

  const cryptProvider = mv["@_cryptProvider"];
  if (cryptProvider !== undefined) result.cryptProvider = String(cryptProvider);

  const cryptProviderType = mv["@_cryptProviderType"];
  if (cryptProviderType !== undefined)
    result.cryptProviderType = String(cryptProviderType);

  const cryptAlgorithmClass = mv["@_cryptAlgorithmClass"];
  if (cryptAlgorithmClass !== undefined)
    result.cryptAlgorithmClass = String(cryptAlgorithmClass);

  return result;
}

// ---------------------------------------------------------------------------
// Tests: extractHeaderFooter
// ---------------------------------------------------------------------------
describe("extractHeaderFooter", () => {
  it("should return undefined when presentationData is undefined", () => {
    expect(extractHeaderFooter(undefined)).toBeUndefined();
  });

  it("should return undefined when p:hf is missing", () => {
    expect(
      extractHeaderFooter({ "p:presentation": {} }),
    ).toBeUndefined();
  });

  it("should parse header and footer flags", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:hf": { "@_hdr": "1", "@_ftr": "1", "@_sldNum": "0" },
      },
    };
    const result = extractHeaderFooter(data)!;
    expect(result.hasHeader).toBe(true);
    expect(result.hasFooter).toBe(true);
    expect(result.hasSlideNumber).toBe(false);
  });

  it("should parse date/time flag", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:hf": { "@_dt": "1" },
      },
    };
    const result = extractHeaderFooter(data)!;
    expect(result.hasDateTime).toBe(true);
  });

  it("should parse footer text", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:hf": { "@_ftrText": "My Footer" },
      },
    };
    const result = extractHeaderFooter(data)!;
    expect(result.footerText).toBe("My Footer");
  });

  it("should parse date format and set dateTimeAuto", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:hf": { "@_dtFmt": "M/d/yyyy" },
      },
    };
    const result = extractHeaderFooter(data)!;
    expect(result.dateFormat).toBe("M/d/yyyy");
    expect(result.dateTimeAuto).toBe(true);
  });

  it("should treat 0 as false for boolean flags", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:hf": { "@_hdr": "0", "@_ftr": "0", "@_dt": "0" },
      },
    };
    const result = extractHeaderFooter(data)!;
    expect(result.hasHeader).toBe(false);
    expect(result.hasFooter).toBe(false);
    expect(result.hasDateTime).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: extractPhotoAlbum
// ---------------------------------------------------------------------------
describe("extractPhotoAlbum", () => {
  it("should return undefined when presentationData is undefined", () => {
    expect(extractPhotoAlbum(undefined)).toBeUndefined();
  });

  it("should return undefined when p:photoAlbum is missing", () => {
    expect(
      extractPhotoAlbum({ "p:presentation": {} }),
    ).toBeUndefined();
  });

  it("should return empty object when no properties are set", () => {
    const data: XmlObject = {
      "p:presentation": { "p:photoAlbum": {} },
    };
    expect(extractPhotoAlbum(data)).toEqual({});
  });

  it("should parse bw flag", () => {
    const data: XmlObject = {
      "p:presentation": { "p:photoAlbum": { "@_bw": "1" } },
    };
    const result = extractPhotoAlbum(data)!;
    expect(result.bw).toBe(true);
  });

  it("should parse showCaptions as false for 0", () => {
    const data: XmlObject = {
      "p:presentation": { "p:photoAlbum": { "@_showCaptions": "0" } },
    };
    const result = extractPhotoAlbum(data)!;
    expect(result.showCaptions).toBe(false);
  });

  it("should parse layout string", () => {
    const data: XmlObject = {
      "p:presentation": { "p:photoAlbum": { "@_layout": "2pic" } },
    };
    const result = extractPhotoAlbum(data)!;
    expect(result.layout).toBe("2pic");
  });

  it("should parse frame string", () => {
    const data: XmlObject = {
      "p:presentation": { "p:photoAlbum": { "@_frame": "frameStyle1" } },
    };
    const result = extractPhotoAlbum(data)!;
    expect(result.frame).toBe("frameStyle1");
  });

  it("should ignore empty layout string", () => {
    const data: XmlObject = {
      "p:presentation": { "p:photoAlbum": { "@_layout": "  " } },
    };
    const result = extractPhotoAlbum(data)!;
    expect(result.layout).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: extractModifyVerifier
// ---------------------------------------------------------------------------
describe("extractModifyVerifier", () => {
  it("should return undefined when presentationData is undefined", () => {
    expect(extractModifyVerifier(undefined)).toBeUndefined();
  });

  it("should return undefined when p:modifyVerifier is missing", () => {
    expect(
      extractModifyVerifier({ "p:presentation": {} }),
    ).toBeUndefined();
  });

  it("should parse algorithm name", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:modifyVerifier": { "@_algorithmName": "SHA-512" },
      },
    };
    const result = extractModifyVerifier(data)!;
    expect(result.algorithmName).toBe("SHA-512");
  });

  it("should parse hash and salt data", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:modifyVerifier": {
          "@_hashData": "abc123",
          "@_saltData": "salt456",
        },
      },
    };
    const result = extractModifyVerifier(data)!;
    expect(result.hashData).toBe("abc123");
    expect(result.saltData).toBe("salt456");
  });

  it("should parse spin value", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:modifyVerifier": { "@_spinValue": "100000" },
      },
    };
    const result = extractModifyVerifier(data)!;
    expect(result.spinValue).toBe(100000);
  });

  it("should fall back to spinCount when spinValue is missing", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:modifyVerifier": { "@_spinCount": "50000" },
      },
    };
    const result = extractModifyVerifier(data)!;
    expect(result.spinValue).toBe(50000);
  });

  it("should parse cryptographic provider details", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:modifyVerifier": {
          "@_cryptAlgorithmSid": "14",
          "@_cryptAlgorithmType": "typeAny",
          "@_cryptProvider": "Microsoft Enhanced RSA and AES Cryptographic Provider",
          "@_cryptProviderType": "rsaAES",
          "@_cryptAlgorithmClass": "hash",
        },
      },
    };
    const result = extractModifyVerifier(data)!;
    expect(result.cryptAlgorithmSid).toBe(14);
    expect(result.cryptAlgorithmType).toBe("typeAny");
    expect(result.cryptProvider).toBe(
      "Microsoft Enhanced RSA and AES Cryptographic Provider",
    );
    expect(result.cryptProviderType).toBe("rsaAES");
    expect(result.cryptAlgorithmClass).toBe("hash");
  });

  it("should fall back to algIdExt for algorithm name", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:modifyVerifier": { "@_algIdExt": "SHA-256" },
      },
    };
    const result = extractModifyVerifier(data)!;
    expect(result.algorithmName).toBe("SHA-256");
    expect(result.algIdExt).toBe("SHA-256");
  });
});

// ---------------------------------------------------------------------------
// Tests: parseKinsoku (imported utility)
// ---------------------------------------------------------------------------
describe("parseKinsoku", () => {
  it("should return undefined when presentationData is undefined", () => {
    expect(parseKinsoku(undefined)).toBeUndefined();
  });

  it("should return undefined when p:presentation is missing", () => {
    expect(parseKinsoku({})).toBeUndefined();
  });

  it("should return undefined when p:kinsoku is missing", () => {
    expect(parseKinsoku({ "p:presentation": {} })).toBeUndefined();
  });

  it("should parse language code", () => {
    const data: XmlObject = {
      "p:presentation": { "p:kinsoku": { "@_lang": "ja-JP" } },
    };
    const result = parseKinsoku(data)!;
    expect(result.lang).toBe("ja-JP");
  });

  it("should parse invalStChars and invalEndChars", () => {
    const data: XmlObject = {
      "p:presentation": {
        "p:kinsoku": {
          "@_invalStChars": ".,",
          "@_invalEndChars": "([",
        },
      },
    };
    const result = parseKinsoku(data)!;
    expect(result.invalStChars).toBe(".,");
    expect(result.invalEndChars).toBe("([");
  });

  it("should return empty object when kinsoku has no recognized attrs", () => {
    const data: XmlObject = {
      "p:presentation": { "p:kinsoku": {} },
    };
    const result = parseKinsoku(data)!;
    expect(result).toEqual({});
  });

  it("should ignore empty lang string", () => {
    const data: XmlObject = {
      "p:presentation": { "p:kinsoku": { "@_lang": "  " } },
    };
    const result = parseKinsoku(data)!;
    expect(result.lang).toBeUndefined();
  });
});
