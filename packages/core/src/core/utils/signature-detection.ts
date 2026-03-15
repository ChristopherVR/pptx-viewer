/**
 * Detect, parse, and validate digital signatures in OOXML packages.
 *
 * Digital signatures live in `_xmlsignatures/` parts:
 * - `_xmlsignatures/origin.sigs` — relationship origin
 * - `_xmlsignatures/sig1.xml`, `sig2.xml`, etc. — individual signatures
 *
 * Each signature XML follows the W3C XML-DSig spec and contains:
 * - `ds:SignedInfo` with `ds:Reference` digests
 * - `ds:SignatureValue` (base64-encoded signature)
 * - `ds:KeyInfo > ds:X509Data > ds:X509Certificate` (base64-encoded DER cert)
 */

/** Result of signature detection. */
export interface SignatureDetectionResult {
  hasSignatures: boolean;
  signatureCount: number;
  signaturePaths: string[];
}

/** X.509 certificate information extracted from a signature. */
export interface SignatureCertificateInfo {
  /** Base64-encoded DER certificate data. */
  certificateBase64: string;
  /** Issuer distinguished name (CN, O, etc.) if parseable. */
  issuer?: string;
  /** Subject distinguished name (CN, O, etc.) if parseable. */
  subject?: string;
  /** Certificate serial number as hex string. */
  serialNumber?: string;
  /** Not-before validity date (ISO string). */
  validFrom?: string;
  /** Not-after validity date (ISO string). */
  validTo?: string;
}

/** Status of a digital signature. */
export type SignatureStatus = "valid" | "invalid" | "expired" | "unknownCA" | "unverified";

/** Parsed digital signature with certificate info and validation status. */
export interface ParsedSignature {
  /** Path to the signature XML in the ZIP. */
  signaturePath: string;
  /** The canonicalized signing method algorithm URI. */
  signatureMethod?: string;
  /** The digest method algorithm URI from the first reference. */
  digestMethod?: string;
  /** Base64-encoded signature value. */
  signatureValue?: string;
  /** Certificate information, if X.509 data was found. */
  certificate?: SignatureCertificateInfo;
  /** Signature validation status. */
  status: SignatureStatus;
  /** Reference URIs and their digest values. */
  references: SignatureReference[];
}

/** A single ds:Reference in the SignedInfo. */
export interface SignatureReference {
  /** The URI identifying the signed part. */
  uri: string;
  /** The digest method algorithm. */
  digestMethod?: string;
  /** Base64-encoded digest value. */
  digestValue?: string;
}

/** The path prefix for all digital signature parts in an OOXML package. */
const SIGNATURE_PREFIX = "_xmlsignatures/";

/**
 * Detect digital signatures by checking for `_xmlsignatures/` paths in the ZIP entries.
 */
export function detectDigitalSignatures(
  zipEntryPaths: string[],
): SignatureDetectionResult {
  const sigPaths = zipEntryPaths.filter(
    (p) => p.startsWith(SIGNATURE_PREFIX) && p.endsWith(".xml"),
  );

  return {
    hasSignatures: sigPaths.length > 0,
    signatureCount: sigPaths.length,
    signaturePaths: sigPaths,
  };
}

/**
 * Get the list of ZIP entry paths that should be removed to strip signatures.
 * Includes all `_xmlsignatures/` entries (XML, .sigs, .rels, etc.).
 */
export function getSignaturePathsToStrip(zipEntryPaths: string[]): string[] {
  return zipEntryPaths.filter((p) => p.startsWith(SIGNATURE_PREFIX));
}

/**
 * The OOXML relationship type used for digital signature origin.
 * This relationship appears in `_rels/.rels` pointing to `_xmlsignatures/origin.sigs`.
 */
export const DIGITAL_SIGNATURE_ORIGIN_REL_TYPE =
  "http://schemas.openxmlformats.org/package/2006/relationships/digital-signature/origin";

// ── XML Signature Parsing ─────────────────────────────────────────────────

/**
 * Find a child element by local name in an XML object, ignoring namespace prefixes.
 */
function findByLocalName(
  parent: Record<string, unknown> | undefined,
  localName: string,
): Record<string, unknown> | undefined {
  if (!parent) return undefined;
  if (parent[localName] !== undefined && typeof parent[localName] === "object") {
    return parent[localName] as Record<string, unknown>;
  }
  for (const key of Object.keys(parent)) {
    const parts = key.split(":");
    if (parts[parts.length - 1] === localName && typeof parent[key] === "object") {
      return parent[key] as Record<string, unknown>;
    }
  }
  return undefined;
}

/**
 * Find a scalar child value by local name.
 */
function findScalarByLocalName(
  parent: Record<string, unknown> | undefined,
  localName: string,
): string | undefined {
  if (!parent) return undefined;
  if (parent[localName] !== undefined) {
    const v = parent[localName];
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "object" && v !== null && "#text" in (v as Record<string, unknown>)) {
      return String((v as Record<string, unknown>)["#text"]);
    }
  }
  for (const key of Object.keys(parent)) {
    const parts = key.split(":");
    if (parts[parts.length - 1] === localName) {
      const v = parent[key];
      if (typeof v === "string") return v;
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      if (typeof v === "object" && v !== null && "#text" in (v as Record<string, unknown>)) {
        return String((v as Record<string, unknown>)["#text"]);
      }
    }
  }
  return undefined;
}

/**
 * Find all children matching a local name.
 */
function findAllByLocalName(
  parent: Record<string, unknown> | undefined,
  localName: string,
): Array<Record<string, unknown>> {
  if (!parent) return [];
  for (const key of Object.keys(parent)) {
    const parts = key.split(":");
    if (parts[parts.length - 1] === localName) {
      const v = parent[key];
      if (Array.isArray(v)) return v as Array<Record<string, unknown>>;
      if (typeof v === "object" && v !== null) return [v as Record<string, unknown>];
    }
  }
  return [];
}

/**
 * Parse a single ds:Signature XML document into structured signature info.
 *
 * @param signatureXml - The parsed XML object (from fast-xml-parser).
 * @param signaturePath - Path to the sig*.xml file in the ZIP.
 * @returns Parsed signature info with certificate data and unverified status.
 */
export function parseSignatureXml(
  signatureXml: Record<string, unknown>,
  signaturePath: string,
): ParsedSignature {
  const signature = findByLocalName(signatureXml, "Signature");
  const signedInfo = findByLocalName(signature, "SignedInfo");

  // Extract signature method
  const sigMethodNode = findByLocalName(signedInfo, "SignatureMethod");
  const signatureMethod = sigMethodNode?.["@_Algorithm"] as string | undefined;

  // Extract signature value
  const signatureValue = findScalarByLocalName(signature, "SignatureValue")
    ?.replace(/\s+/g, "");

  // Extract references
  const references: SignatureReference[] = [];
  const refNodes = findAllByLocalName(signedInfo, "Reference");
  for (const ref of refNodes) {
    const uri = String(ref["@_URI"] || "");
    const dmNode = findByLocalName(ref, "DigestMethod");
    const digestMethod = dmNode?.["@_Algorithm"] as string | undefined;
    const digestValue = findScalarByLocalName(ref, "DigestValue")?.replace(/\s+/g, "");
    references.push({ uri, digestMethod, digestValue });
  }

  // Extract digest method from first reference
  const digestMethod = references[0]?.digestMethod;

  // Extract X.509 certificate info
  const keyInfo = findByLocalName(signature, "KeyInfo");
  const x509Data = findByLocalName(keyInfo, "X509Data");
  let certificate: SignatureCertificateInfo | undefined;

  if (x509Data) {
    const certBase64 = findScalarByLocalName(x509Data, "X509Certificate")?.replace(/\s+/g, "");
    if (certBase64) {
      // Extract issuer and subject from X509IssuerSerial if available
      const issuerSerial = findByLocalName(x509Data, "X509IssuerSerial");
      const issuer = findScalarByLocalName(issuerSerial, "X509IssuerName");
      const serialNumber = findScalarByLocalName(issuerSerial, "X509SerialNumber");
      const subject = findScalarByLocalName(x509Data, "X509SubjectName");

      certificate = {
        certificateBase64: certBase64,
        ...(issuer ? { issuer } : {}),
        ...(subject ? { subject } : {}),
        ...(serialNumber ? { serialNumber } : {}),
      };
    }
  }

  // Determine initial status — certificate expired check
  let status: SignatureStatus = "unverified";
  if (certificate?.validTo) {
    const expiry = new Date(certificate.validTo);
    if (expiry < new Date()) {
      status = "expired";
    }
  }

  return {
    signaturePath,
    signatureMethod,
    digestMethod,
    signatureValue,
    certificate,
    status,
    references,
  };
}

/**
 * Verify a signature's digest references against actual document content.
 *
 * Uses the Web Crypto API (SubtleCrypto) to compute SHA-256/SHA-1 digests
 * of referenced parts and compare against the signed digest values.
 *
 * @param signature - The parsed signature to verify.
 * @param getPartContent - Function that retrieves part content by URI.
 * @returns The updated signature status after digest verification.
 */
export async function verifySignatureDigests(
  signature: ParsedSignature,
  getPartContent: (uri: string) => Promise<ArrayBuffer | undefined>,
): Promise<SignatureStatus> {
  if (!signature.references.length) return "unverified";
  if (typeof globalThis.crypto?.subtle === "undefined") return "unverified";

  for (const ref of signature.references) {
    if (!ref.digestValue || !ref.uri) continue;

    // Determine hash algorithm from digest method URI
    const algo = ref.digestMethod?.toLowerCase() || "";
    let hashAlgo: AlgorithmIdentifier;
    if (algo.includes("sha256") || algo.includes("sha-256")) {
      hashAlgo = "SHA-256";
    } else if (algo.includes("sha512") || algo.includes("sha-512")) {
      hashAlgo = "SHA-512";
    } else if (algo.includes("sha1") || algo.includes("sha-1")) {
      hashAlgo = "SHA-1";
    } else {
      // Unknown digest algorithm — can't verify
      continue;
    }

    const content = await getPartContent(ref.uri);
    if (!content) continue;

    try {
      const digest = await crypto.subtle.digest(hashAlgo, content);
      const digestBase64 = arrayBufferToBase64(digest);

      if (digestBase64 !== ref.digestValue) {
        return "invalid";
      }
    } catch {
      return "unverified";
    }
  }

  return signature.certificate ? "valid" : "unknownCA";
}

/**
 * Convert an ArrayBuffer to a base64 string.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
