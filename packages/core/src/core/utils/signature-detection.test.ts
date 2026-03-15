import { describe, it, expect } from "vitest";
import {
  detectDigitalSignatures,
  getSignaturePathsToStrip,
  parseSignatureXml,
  verifySignatureDigests,
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

describe("parseSignatureXml", () => {
  it("should extract basic signature method and value", () => {
    const xml = {
      "ds:Signature": {
        "ds:SignedInfo": {
          "ds:SignatureMethod": {
            "@_Algorithm": "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
          },
          "ds:Reference": {
            "@_URI": "/ppt/presentation.xml?ContentType=application/xml",
            "ds:DigestMethod": {
              "@_Algorithm": "http://www.w3.org/2001/04/xmlenc#sha256",
            },
            "ds:DigestValue": "abc123==",
          },
        },
        "ds:SignatureValue": "SIGVALUE==",
      },
    };

    const result = parseSignatureXml(xml, "_xmlsignatures/sig1.xml");
    expect(result.signaturePath).toBe("_xmlsignatures/sig1.xml");
    expect(result.signatureMethod).toBe(
      "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    );
    expect(result.signatureValue).toBe("SIGVALUE==");
    expect(result.status).toBe("unverified");
  });

  it("should extract X.509 certificate data", () => {
    const xml = {
      "ds:Signature": {
        "ds:SignedInfo": {},
        "ds:KeyInfo": {
          "ds:X509Data": {
            "ds:X509Certificate": "MIICERTDATA==",
          },
        },
      },
    };

    const result = parseSignatureXml(xml, "_xmlsignatures/sig1.xml");
    expect(result.certificate).toBeDefined();
    expect(result.certificate!.certificateBase64).toBe("MIICERTDATA==");
  });

  it("should extract X509IssuerSerial info", () => {
    const xml = {
      "ds:Signature": {
        "ds:SignedInfo": {},
        "ds:KeyInfo": {
          "ds:X509Data": {
            "ds:X509Certificate": "CERTBASE64==",
            "ds:X509IssuerSerial": {
              "ds:X509IssuerName": "CN=Test CA, O=TestOrg",
              "ds:X509SerialNumber": "12345678",
            },
            "ds:X509SubjectName": "CN=John Doe, O=MyCompany",
          },
        },
      },
    };

    const result = parseSignatureXml(xml, "_xmlsignatures/sig1.xml");
    expect(result.certificate!.issuer).toBe("CN=Test CA, O=TestOrg");
    expect(result.certificate!.subject).toBe("CN=John Doe, O=MyCompany");
    expect(result.certificate!.serialNumber).toBe("12345678");
  });

  it("should handle missing KeyInfo gracefully", () => {
    const xml = {
      "ds:Signature": {
        "ds:SignedInfo": {
          "ds:SignatureMethod": {
            "@_Algorithm": "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
          },
        },
        "ds:SignatureValue": "VALUE==",
      },
    };

    const result = parseSignatureXml(xml, "_xmlsignatures/sig1.xml");
    expect(result.certificate).toBeUndefined();
    expect(result.status).toBe("unverified");
  });

  it("should parse multiple references", () => {
    const xml = {
      "ds:Signature": {
        "ds:SignedInfo": {
          "ds:Reference": [
            {
              "@_URI": "/ppt/slides/slide1.xml",
              "ds:DigestMethod": {
                "@_Algorithm": "http://www.w3.org/2001/04/xmlenc#sha256",
              },
              "ds:DigestValue": "digest1==",
            },
            {
              "@_URI": "/ppt/slides/slide2.xml",
              "ds:DigestMethod": {
                "@_Algorithm": "http://www.w3.org/2001/04/xmlenc#sha256",
              },
              "ds:DigestValue": "digest2==",
            },
          ],
        },
      },
    };

    const result = parseSignatureXml(xml, "_xmlsignatures/sig1.xml");
    expect(result.references).toHaveLength(2);
    expect(result.references[0].uri).toContain("slide1.xml");
    expect(result.references[0].digestValue).toBe("digest1==");
    expect(result.references[1].uri).toContain("slide2.xml");
    expect(result.references[1].digestValue).toBe("digest2==");
  });

  it("should extract digest method from first reference", () => {
    const xml = {
      "ds:Signature": {
        "ds:SignedInfo": {
          "ds:Reference": {
            "@_URI": "/test.xml",
            "ds:DigestMethod": {
              "@_Algorithm": "http://www.w3.org/2001/04/xmlenc#sha256",
            },
            "ds:DigestValue": "xyz==",
          },
        },
      },
    };

    const result = parseSignatureXml(xml, "_xmlsignatures/sig1.xml");
    expect(result.digestMethod).toBe("http://www.w3.org/2001/04/xmlenc#sha256");
  });

  it("should handle completely empty XML", () => {
    const result = parseSignatureXml({}, "_xmlsignatures/sig1.xml");
    expect(result.status).toBe("unverified");
    expect(result.references).toEqual([]);
    expect(result.certificate).toBeUndefined();
    expect(result.signatureMethod).toBeUndefined();
    expect(result.signatureValue).toBeUndefined();
  });

  it("should strip whitespace from signature value and cert base64", () => {
    const xml = {
      "ds:Signature": {
        "ds:SignedInfo": {},
        "ds:SignatureValue": "SIG\n  VALUE\n  ==",
        "ds:KeyInfo": {
          "ds:X509Data": {
            "ds:X509Certificate": "MII\n  CERT\n  DATA==",
          },
        },
      },
    };

    const result = parseSignatureXml(xml, "_xmlsignatures/sig1.xml");
    expect(result.signatureValue).toBe("SIGVALUE==");
    expect(result.certificate!.certificateBase64).toBe("MIICERTDATA==");
  });
});

describe("verifySignatureDigests", () => {
  it("should return unverified when no references", async () => {
    const sig = parseSignatureXml({}, "_xmlsignatures/sig1.xml");
    const status = await verifySignatureDigests(sig, async () => undefined);
    expect(status).toBe("unverified");
  });

  it("should skip references with unknown digest algorithm", async () => {
    const sig = parseSignatureXml(
      {
        "ds:Signature": {
          "ds:SignedInfo": {
            "ds:Reference": {
              "@_URI": "/test.xml",
              "ds:DigestMethod": {
                "@_Algorithm": "http://unknown/algorithm",
              },
              "ds:DigestValue": "abc==",
            },
          },
        },
      },
      "_xmlsignatures/sig1.xml",
    );
    const status = await verifySignatureDigests(
      sig,
      async () => new ArrayBuffer(0),
    );
    expect(["unverified", "unknownCA"]).toContain(status);
  });
});
