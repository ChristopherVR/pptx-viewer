/**
 * Constants for OOXML digital signature processing.
 *
 * OPC URIs, algorithm URIs, digest mappings, and enterprise
 * environment variable names used across both platform-agnostic
 * and Node-only signature modules.
 */

/** The OOXML relationship type for the digital signature origin part. */
export const DIGITAL_SIGNATURE_ORIGIN_REL_TYPE =
	'http://schemas.openxmlformats.org/package/2006/relationships/digital-signature/origin';

/** The OOXML relationship type for individual signature parts. */
export const DIGITAL_SIGNATURE_REL_TYPE =
	'http://schemas.openxmlformats.org/package/2006/relationships/digital-signature/signature';

/** Custom pptx-viewer manifest namespace for extended signature references. */
export const PPTX_VIEWER_MANIFEST_NS = 'urn:pptx-viewer:ooxml-signature:v1';

/** W3C XML Digital Signature namespace. */
export const XMLDSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';

/** OPC relationship transform algorithm URI. */
export const OPC_RELATIONSHIP_TRANSFORM =
	'http://schemas.openxmlformats.org/package/2006/RelationshipTransform';

/** Enveloped signature transform algorithm URI. */
export const XML_TRANSFORM_ENVELOPED_SIGNATURE =
	'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

/** Set of supported XML canonicalization transform algorithm URIs. */
export const SUPPORTED_XML_CANON_TRANSFORMS = new Set<string>([
	'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
	'http://www.w3.org/TR/2001/REC-xml-c14n-20010315#WithComments',
	'http://www.w3.org/2001/10/xml-exc-c14n#',
	'http://www.w3.org/2001/10/xml-exc-c14n#WithComments',
	XML_TRANSFORM_ENVELOPED_SIGNATURE,
]);

/** Environment variable: path to file containing enterprise trust root PEM certificates. */
export const ENTERPRISE_TRUST_ROOTS_FILE_ENV = 'PPTX_VIEWER_TRUST_ROOTS_FILE';

/** Environment variable: inline PEM trust roots. */
export const ENTERPRISE_TRUST_ROOTS_PEM_ENV = 'PPTX_VIEWER_TRUST_ROOTS_PEM';

/** Environment variable: require revocation check. */
export const ENTERPRISE_REQUIRE_REVOCATION_ENV = 'PPTX_VIEWER_REQUIRE_REVOCATION_CHECK';

/** Environment variable: fail on unknown revocation status. */
export const ENTERPRISE_FAIL_ON_REVOCATION_UNKNOWN_ENV = 'PPTX_VIEWER_FAIL_ON_REVOCATION_UNKNOWN';

/** Environment variable: require timestamp authority. */
export const ENTERPRISE_REQUIRE_TIMESTAMP_ENV = 'PPTX_VIEWER_REQUIRE_TIMESTAMP';

/**
 * Mapping from XML Digital Signature digest algorithm URIs to hash function names.
 * Used by Node-only code with `node:crypto` (lowercase names).
 */
export const DIGEST_ALGORITHM_TO_HASH: Record<string, string> = {
	'http://www.w3.org/2000/09/xmldsig#sha1': 'sha1',
	'http://www.w3.org/2001/04/xmlenc#sha256': 'sha256',
	'http://www.w3.org/2001/04/xmlenc#sha384': 'sha384',
	'http://www.w3.org/2001/04/xmlenc#sha512': 'sha512',
};

/**
 * Mapping from XML Digital Signature digest algorithm URIs to Web Crypto algorithm names.
 * Used by platform-agnostic code with `crypto.subtle.digest`.
 */
export const DIGEST_ALGORITHM_TO_WEB_CRYPTO: Record<string, string> = {
	'http://www.w3.org/2000/09/xmldsig#sha1': 'SHA-1',
	'http://www.w3.org/2001/04/xmlenc#sha256': 'SHA-256',
	'http://www.w3.org/2001/04/xmlenc#sha384': 'SHA-384',
	'http://www.w3.org/2001/04/xmlenc#sha512': 'SHA-512',
};
