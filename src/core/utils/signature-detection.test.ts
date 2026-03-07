import { describe, it, expect } from "vitest";
import {
  detectDigitalSignatures,
  getSignaturePathsToStrip,
  DIGITAL_SIGNATURE_ORIGIN_REL_TYPE,
} from "./signature-detection";

describe("detectDigitalSignatures", () => {
  it("should detect no signatures when there are no _xmlsignatures entries", () => {
    const paths = [
      "ppt/presentation.xml",
      "ppt/slides/slide1.xml",
      "[Content_Types].xml",
    ];
    const result = detectDigitalSignatures(paths);
    expect(result).toEqual({
      hasSignatures: false,
      signatureCount: 0,
      signaturePaths: [],
    });
  });

  it("should detect signatures from _xmlsignatures/*.xml entries", () => {
    const paths = [
      "ppt/presentation.xml",
      "_xmlsignatures/origin.sigs",
      "_xmlsignatures/sig1.xml",
      "_xmlsignatures/sig2.xml",
      "[Content_Types].xml",
    ];
    const result = detectDigitalSignatures(paths);
    expect(result).toEqual({
      hasSignatures: true,
      signatureCount: 2,
      signaturePaths: ["_xmlsignatures/sig1.xml", "_xmlsignatures/sig2.xml"],
    });
  });

  it("should only count .xml files as signatures", () => {
    const paths = [
      "_xmlsignatures/origin.sigs",
      "_xmlsignatures/_rels/origin.sigs.rels",
      "_xmlsignatures/sig1.xml",
    ];
    const result = detectDigitalSignatures(paths);
    expect(result).toEqual({
      hasSignatures: true,
      signatureCount: 1,
      signaturePaths: ["_xmlsignatures/sig1.xml"],
    });
  });

  it("should handle an empty path list", () => {
    const result = detectDigitalSignatures([]);
    expect(result).toEqual({
      hasSignatures: false,
      signatureCount: 0,
      signaturePaths: [],
    });
  });

  it("should not match paths that contain _xmlsignatures elsewhere", () => {
    const paths = [
      "ppt/_xmlsignatures/sig1.xml",
      "some/other/_xmlsignatures/sig2.xml",
    ];
    const result = detectDigitalSignatures(paths);
    expect(result).toEqual({
      hasSignatures: false,
      signatureCount: 0,
      signaturePaths: [],
    });
  });
});

describe("getSignaturePathsToStrip", () => {
  it("should return all _xmlsignatures entries regardless of extension", () => {
    const paths = [
      "ppt/presentation.xml",
      "_xmlsignatures/origin.sigs",
      "_xmlsignatures/sig1.xml",
      "_xmlsignatures/_rels/origin.sigs.rels",
      "[Content_Types].xml",
    ];
    const result = getSignaturePathsToStrip(paths);
    expect(result).toEqual([
      "_xmlsignatures/origin.sigs",
      "_xmlsignatures/sig1.xml",
      "_xmlsignatures/_rels/origin.sigs.rels",
    ]);
  });

  it("should return an empty array when no signature paths exist", () => {
    const paths = ["ppt/presentation.xml", "[Content_Types].xml"];
    const result = getSignaturePathsToStrip(paths);
    expect(result).toEqual([]);
  });

  it("should return an empty array for an empty input", () => {
    const result = getSignaturePathsToStrip([]);
    expect(result).toEqual([]);
  });
});

describe("DIGITAL_SIGNATURE_ORIGIN_REL_TYPE", () => {
  it("should be the correct OOXML relationship type URI", () => {
    expect(DIGITAL_SIGNATURE_ORIGIN_REL_TYPE).toBe(
      "http://schemas.openxmlformats.org/package/2006/relationships/digital-signature/origin",
    );
  });
});
