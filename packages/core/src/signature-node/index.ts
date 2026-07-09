/**
 * Node-only digital signature subpath export.
 *
 * Usage: `import { ... } from 'pptx-viewer-core/signature-node'`
 *
 * Re-exports platform-agnostic types + Node-only implementations.
 */

// ── Platform-agnostic re-exports (types, constants, pure utils) ─────────

export type {
	CertificateRevocationStatus,
	TimestampAuthorityStatus,
	SignatureReferenceCheck,
	SignatureCertificateInfo,
	SignatureDetailStatus,
	SignatureDetail,
	DigitalSignatureVerificationStatus,
	DigitalSignatureReport,
	SignOptions,
	SignResult,
	LoadedSigningMaterial,
	ParsedReferenceTransform,
	ReferenceTransformResult,
	SignatureValidationPolicy,
	OfficeSignatureReference,
} from '../core/utils/signature-types';

export {
	DIGITAL_SIGNATURE_ORIGIN_REL_TYPE,
	DIGITAL_SIGNATURE_REL_TYPE,
	PPTX_VIEWER_MANIFEST_NS,
	XMLDSIG_NS,
	OPC_RELATIONSHIP_TRANSFORM,
	XML_TRANSFORM_ENVELOPED_SIGNATURE,
	SUPPORTED_XML_CANON_TRANSFORMS,
	ENTERPRISE_TRUST_ROOTS_FILE_ENV,
	ENTERPRISE_TRUST_ROOTS_PEM_ENV,
	ENTERPRISE_REQUIRE_REVOCATION_ENV,
	ENTERPRISE_FAIL_ON_REVOCATION_UNKNOWN_ENV,
	ENTERPRISE_REQUIRE_TIMESTAMP_ENV,
	DIGEST_ALGORITHM_TO_HASH,
	DIGEST_ALGORITHM_TO_WEB_CRYPTO,
} from '../core/utils/signature-constants';

export {
	escapeXmlAttr,
	escapeXmlText,
	isValidBase64,
	extractTagAttribute,
	extractFirstTagText,
	extractAllTagText,
} from '../core/utils/signature-xml-utils';

export {
	normalizePartPath,
	resolveReferenceUriToPart,
} from '../core/utils/signature-reference-utils';

export { computeDigestBase64 as computeDigestBase64WebCrypto } from '../core/utils/signature-digest';

export {
	computeDetailStatus,
	computeVerificationStatus,
} from '../core/utils/signature-inspection-status';

// ── Node-only exports ───────────────────────────────────────────────────

export {
	getNodeLocalName,
	getFirstDescendantElementByLocalName,
	canonicalizeNode,
	canonicalizeSignedInfoXml,
} from './xml-canonicalization';

export {
	certificateInfoFromBase64,
	validateCertificateChain,
	verifySignatureValue,
	loadSigningMaterialFromBuffer,
	pemCertificateToBase64,
} from './certificate-utils';

export {
	certPemFromBase64,
	certFingerprintSha256,
	evaluateTimestampAuthority,
} from './pki-validation';

export {
	extractOcspUrls,
	buildOcspRequestDer,
	parseOcspResponseStatus,
	evaluateCertificateRevocation,
} from './ocsp';

export {
	extractPemCertificatesFromText,
	loadEnterpriseTrustRoots,
	getSignatureValidationPolicy,
} from './environment';

export { extractReferenceTransforms, applyReferenceTransforms } from './reference-transforms';

export {
	computeDigestBase64,
	buildReferenceChecksFromSignatureXml,
	buildReferenceChecksFromPptxViewerManifest,
} from './reference-checks';

export { signPptxWithCertificate } from './signing';

export { inspectPptxDigitalSignatures } from './inspection';
