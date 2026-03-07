/**
 * Detect and manage digital signatures in OOXML packages.
 *
 * Digital signatures live in `_xmlsignatures/` parts:
 * - `_xmlsignatures/origin.sigs` — relationship origin
 * - `_xmlsignatures/sig1.xml`, `sig2.xml`, etc. — individual signatures
 */

/** Result of signature detection. */
export interface SignatureDetectionResult {
  hasSignatures: boolean;
  signatureCount: number;
  signaturePaths: string[];
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
