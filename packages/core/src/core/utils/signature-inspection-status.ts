/**
 * Pure status-computation logic for digital signature inspection.
 *
 * These functions are platform-agnostic — they accept data and policy
 * as parameters instead of reading from the environment.
 */

import type {
	DigitalSignatureReport,
	SignatureDetail,
	SignatureDetailStatus,
	SignatureValidationPolicy,
} from './signature-types';

/**
 * Compute the overall status for an individual signature detail
 * based on its reference checks, trust, revocation, and timestamp statuses.
 *
 * @param detail - A partial `SignatureDetail` with the fields needed for status computation.
 * @param policy - The validation policy controlling revocation/timestamp strictness.
 * @returns The computed status for this signature detail.
 */
export function computeDetailStatus(
	detail: Pick<
		SignatureDetail,
		| 'signatureValueStatus'
		| 'missingPartReferences'
		| 'referenceChecks'
		| 'certificateTrustStatus'
		| 'certificateRevocationStatus'
		| 'timestampAuthorityStatus'
	>,
	policy: SignatureValidationPolicy,
): SignatureDetailStatus {
	const hasDigestMismatch = detail.referenceChecks.some(
		(check) => check.digestStatus === 'mismatch',
	);
	const hasMissingPart = detail.missingPartReferences.length > 0;
	const hasVerifiedDigest = detail.referenceChecks.some(
		(check) => check.digestStatus === 'verified',
	);
	const revocationUnknown =
		detail.certificateRevocationStatus === 'unknown' ||
		detail.certificateRevocationStatus === 'not-checked' ||
		detail.certificateRevocationStatus === 'error';
	const timestampMissingOrUntrusted =
		detail.timestampAuthorityStatus === 'not-present' ||
		detail.timestampAuthorityStatus === 'not-checked' ||
		detail.timestampAuthorityStatus === 'error' ||
		detail.timestampAuthorityStatus === 'untrusted';

	if (detail.signatureValueStatus === 'invalid') {
		return 'signature-invalid';
	}
	if (hasMissingPart) {
		return 'reference-missing';
	}
	if (hasDigestMismatch) {
		return 'digest-mismatch';
	}
	if (detail.certificateRevocationStatus === 'revoked') {
		return 'certificate-revoked';
	}
	if (
		policy.requireRevocationCheck &&
		(policy.failOnRevocationUnknown
			? revocationUnknown
			: detail.certificateRevocationStatus !== 'good')
	) {
		return 'certificate-untrusted';
	}
	if (detail.timestampAuthorityStatus === 'invalid') {
		return 'timestamp-invalid';
	}
	if (policy.requireTimestamp && timestampMissingOrUntrusted) {
		return 'timestamp-untrusted';
	}
	if (detail.timestampAuthorityStatus === 'untrusted') {
		return 'timestamp-untrusted';
	}
	if (detail.certificateTrustStatus === 'untrusted' && detail.signatureValueStatus === 'verified') {
		return 'certificate-untrusted';
	}
	if (hasVerifiedDigest && detail.signatureValueStatus === 'verified') {
		return 'verified';
	}
	return 'structural-only';
}

/**
 * Compute the overall verification status from all signature details.
 *
 * @param details - Array of signature details from all signatures in the package.
 * @returns The overall verification status for the report.
 */
export function computeVerificationStatus(
	details: SignatureDetail[],
): DigitalSignatureReport['verificationStatus'] {
	const hasInvalidSignature = details.some((detail) => detail.status === 'signature-invalid');
	const hasMissing = details.some((detail) => detail.status === 'reference-missing');
	const hasMismatch = details.some((detail) => detail.status === 'digest-mismatch');
	const hasUntrusted = details.some((detail) => detail.status === 'certificate-untrusted');
	const hasRevoked = details.some((detail) => detail.status === 'certificate-revoked');
	const hasTimestampInvalid = details.some((detail) => detail.status === 'timestamp-invalid');
	const hasTimestampUntrusted = details.some((detail) => detail.status === 'timestamp-untrusted');
	const allVerified = details.every((detail) => detail.status === 'verified');

	return hasInvalidSignature
		? 'signature-invalid'
		: hasRevoked
			? 'certificate-revoked'
			: hasTimestampInvalid
				? 'timestamp-invalid'
				: hasTimestampUntrusted
					? 'timestamp-untrusted'
					: hasMissing
						? 'reference-missing'
						: hasMismatch
							? 'digest-mismatch'
							: allVerified
								? 'verified-trusted'
								: hasUntrusted
									? 'verified-untrusted'
									: 'present-not-verified';
}
