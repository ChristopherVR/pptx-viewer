/**
 * Rich types for digital signature inspection, signing, and PKI validation.
 *
 * These are platform-agnostic — used by both browser-level detection
 * and Node-only full verification modules.
 */

// ── Certificate revocation & timestamp authority statuses ────────────────

export type CertificateRevocationStatus = 'good' | 'revoked' | 'unknown' | 'not-checked' | 'error';

export type TimestampAuthorityStatus =
	| 'valid'
	| 'invalid'
	| 'not-present'
	| 'not-checked'
	| 'error'
	| 'untrusted';

// ── Reference checking ──────────────────────────────────────────────────

export interface SignatureReferenceCheck {
	uri: string;
	resolvedPartPath?: string;
	existsInPackage: boolean;
	digestAlgorithm?: string;
	digestExpectedBase64?: string;
	digestActualBase64?: string;
	digestStatus:
		| 'verified'
		| 'mismatch'
		| 'missing-part'
		| 'unsupported-transform'
		| 'unsupported-algorithm'
		| 'insufficient-data';
	transformAlgorithms: string[];
}

// ── Certificate info ────────────────────────────────────────────────────

export interface SignatureCertificateInfo {
	subject?: string;
	issuer?: string;
	serialNumber?: string;
	validFrom?: string;
	validTo?: string;
}

// ── Signature detail ────────────────────────────────────────────────────

export type SignatureDetailStatus =
	| 'verified'
	| 'digest-mismatch'
	| 'reference-missing'
	| 'signature-invalid'
	| 'certificate-untrusted'
	| 'certificate-revoked'
	| 'timestamp-invalid'
	| 'timestamp-untrusted'
	| 'structural-only';

export interface SignatureDetail {
	path: string;
	signatureMethod?: string;
	canonicalizationMethod?: string;
	signingTime?: string;
	referenceCount: number;
	missingPartReferences: string[];
	unsupportedTransforms: string[];
	referenceChecks: SignatureReferenceCheck[];
	certificate?: SignatureCertificateInfo;
	signatureValueStatus: 'verified' | 'invalid' | 'not-checked';
	certificateTrustStatus: 'trusted' | 'untrusted' | 'not-checked';
	certificateTrustError?: string;
	certificateRevocationStatus: CertificateRevocationStatus;
	certificateRevocationError?: string;
	timestampAuthorityStatus: TimestampAuthorityStatus;
	timestampAuthorityError?: string;
	certificateFingerprintSha256?: string;
	status: SignatureDetailStatus;
}

// ── Report ──────────────────────────────────────────────────────────────

export type DigitalSignatureVerificationStatus =
	| 'unsigned'
	| 'verified-trusted'
	| 'verified-untrusted'
	| 'certificate-revoked'
	| 'digest-mismatch'
	| 'reference-missing'
	| 'signature-invalid'
	| 'timestamp-invalid'
	| 'timestamp-untrusted'
	| 'present-not-verified'
	| 'invalid-package'
	| 'error';

export interface DigitalSignatureReport {
	supported: boolean;
	hasSignature: boolean;
	signatureCount: number;
	signaturePaths: string[];
	verificationStatus: DigitalSignatureVerificationStatus;
	error?: string;
	details?: SignatureDetail[];
	hasOriginRelationship?: boolean;
}

// ── Signing ─────────────────────────────────────────────────────────────

export interface SignOptions {
	certificatePath: string;
	certificatePassword?: string;
}

export interface SignResult {
	success: boolean;
	signedData?: Uint8Array;
	report: DigitalSignatureReport;
	error?: string;
}

export interface LoadedSigningMaterial {
	privateKeyPem: string;
	certificatePem: string;
}

// ── Reference transforms ────────────────────────────────────────────────

export interface ParsedReferenceTransform {
	algorithm: string;
	relationshipReferenceIds: string[];
}

export interface ReferenceTransformResult {
	data: Uint8Array;
	unsupportedAlgorithms: string[];
}

// ── Validation policy ───────────────────────────────────────────────────

export interface SignatureValidationPolicy {
	requireRevocationCheck: boolean;
	failOnRevocationUnknown: boolean;
	requireTimestamp: boolean;
}

// ── Office signature reference ──────────────────────────────────────────

export interface OfficeSignatureReference {
	uri: string;
	digestMethod: string;
	digestValue: string;
}
