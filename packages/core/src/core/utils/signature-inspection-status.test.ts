import { describe, it, expect } from 'vitest';

import { computeDetailStatus, computeVerificationStatus } from './signature-inspection-status';
import type {
	SignatureDetail,
	SignatureValidationPolicy,
	SignatureReferenceCheck,
} from './signature-types';

const defaultPolicy: SignatureValidationPolicy = {
	requireRevocationCheck: false,
	failOnRevocationUnknown: false,
	requireTimestamp: false,
};

/** Create a mock reference check with defaults. */
function mockReferenceCheck(
	overrides: Partial<SignatureReferenceCheck> = {},
): SignatureReferenceCheck {
	return {
		uri: '/ppt/slides/slide1.xml',
		existsInPackage: true,
		digestStatus: 'verified',
		transformAlgorithms: [],
		...overrides,
	};
}

/**
 * Create a mock detail object suitable for `computeDetailStatus`.
 * All fields default to a "healthy" state that would produce 'verified'.
 */
function mockDetail(
	overrides: Partial<
		Pick<
			SignatureDetail,
			| 'signatureValueStatus'
			| 'missingPartReferences'
			| 'referenceChecks'
			| 'certificateTrustStatus'
			| 'certificateRevocationStatus'
			| 'timestampAuthorityStatus'
		>
	> = {},
): Pick<
	SignatureDetail,
	| 'signatureValueStatus'
	| 'missingPartReferences'
	| 'referenceChecks'
	| 'certificateTrustStatus'
	| 'certificateRevocationStatus'
	| 'timestampAuthorityStatus'
> {
	return {
		signatureValueStatus: 'verified',
		missingPartReferences: [],
		referenceChecks: [mockReferenceCheck()],
		certificateTrustStatus: 'trusted',
		certificateRevocationStatus: 'good',
		timestampAuthorityStatus: 'valid',
		...overrides,
	};
}

/** Create a full SignatureDetail suitable for `computeVerificationStatus`. */
function mockFullDetail(overrides: Partial<SignatureDetail> = {}): SignatureDetail {
	return {
		path: '_xmlsignatures/sig1.xml',
		referenceCount: 1,
		missingPartReferences: [],
		unsupportedTransforms: [],
		referenceChecks: [mockReferenceCheck()],
		signatureValueStatus: 'verified',
		certificateTrustStatus: 'trusted',
		certificateRevocationStatus: 'good',
		timestampAuthorityStatus: 'valid',
		status: 'verified',
		...overrides,
	};
}

describe('computeDetailStatus', () => {
	it('returns signature-invalid when signatureValueStatus is invalid', () => {
		const detail = mockDetail({ signatureValueStatus: 'invalid' });
		expect(computeDetailStatus(detail, defaultPolicy)).toBe('signature-invalid');
	});

	it('returns reference-missing when missingPartReferences is non-empty', () => {
		const detail = mockDetail({
			missingPartReferences: ['ppt/slides/slide2.xml'],
		});
		expect(computeDetailStatus(detail, defaultPolicy)).toBe('reference-missing');
	});

	it('returns digest-mismatch when a reference check has digestStatus mismatch', () => {
		const detail = mockDetail({
			referenceChecks: [mockReferenceCheck({ digestStatus: 'mismatch' })],
		});
		expect(computeDetailStatus(detail, defaultPolicy)).toBe('digest-mismatch');
	});

	it('returns certificate-revoked when certificateRevocationStatus is revoked', () => {
		const detail = mockDetail({ certificateRevocationStatus: 'revoked' });
		expect(computeDetailStatus(detail, defaultPolicy)).toBe('certificate-revoked');
	});

	it('returns verified when all checks pass', () => {
		const detail = mockDetail({
			signatureValueStatus: 'verified',
			referenceChecks: [mockReferenceCheck({ digestStatus: 'verified' })],
			certificateTrustStatus: 'trusted',
		});
		expect(computeDetailStatus(detail, defaultPolicy)).toBe('verified');
	});

	it('returns structural-only when no digests are verified and signature is not checked', () => {
		const detail = mockDetail({
			signatureValueStatus: 'not-checked',
			referenceChecks: [mockReferenceCheck({ digestStatus: 'insufficient-data' })],
			certificateTrustStatus: 'not-checked',
		});
		expect(computeDetailStatus(detail, defaultPolicy)).toBe('structural-only');
	});

	it('returns certificate-untrusted when trust is untrusted but signature is verified', () => {
		const detail = mockDetail({
			signatureValueStatus: 'verified',
			certificateTrustStatus: 'untrusted',
		});
		expect(computeDetailStatus(detail, defaultPolicy)).toBe('certificate-untrusted');
	});

	it('returns timestamp-untrusted when timestampAuthorityStatus is untrusted', () => {
		const detail = mockDetail({
			timestampAuthorityStatus: 'untrusted',
			// Set trust to trusted so we don't hit certificate-untrusted first
			certificateTrustStatus: 'trusted',
			// Set signature to not-checked so we don't hit verified first
			signatureValueStatus: 'not-checked',
			referenceChecks: [mockReferenceCheck({ digestStatus: 'insufficient-data' })],
		});
		expect(computeDetailStatus(detail, defaultPolicy)).toBe('timestamp-untrusted');
	});

	it('returns timestamp-invalid when timestampAuthorityStatus is invalid', () => {
		const detail = mockDetail({
			timestampAuthorityStatus: 'invalid',
		});
		expect(computeDetailStatus(detail, defaultPolicy)).toBe('timestamp-invalid');
	});

	it('prioritizes signature-invalid over reference-missing', () => {
		const detail = mockDetail({
			signatureValueStatus: 'invalid',
			missingPartReferences: ['missing.xml'],
		});
		expect(computeDetailStatus(detail, defaultPolicy)).toBe('signature-invalid');
	});

	it('prioritizes reference-missing over digest-mismatch', () => {
		const detail = mockDetail({
			missingPartReferences: ['missing.xml'],
			referenceChecks: [mockReferenceCheck({ digestStatus: 'mismatch' })],
		});
		expect(computeDetailStatus(detail, defaultPolicy)).toBe('reference-missing');
	});

	describe('with requireRevocationCheck policy', () => {
		const strictPolicy: SignatureValidationPolicy = {
			requireRevocationCheck: true,
			failOnRevocationUnknown: true,
			requireTimestamp: false,
		};

		it('returns certificate-untrusted when revocation is unknown and policy requires check', () => {
			const detail = mockDetail({
				certificateRevocationStatus: 'unknown',
			});
			expect(computeDetailStatus(detail, strictPolicy)).toBe('certificate-untrusted');
		});
	});

	describe('with requireTimestamp policy', () => {
		const timestampPolicy: SignatureValidationPolicy = {
			requireRevocationCheck: false,
			failOnRevocationUnknown: false,
			requireTimestamp: true,
		};

		it('returns timestamp-untrusted when timestamp is not-present and policy requires it', () => {
			const detail = mockDetail({
				timestampAuthorityStatus: 'not-present',
			});
			expect(computeDetailStatus(detail, timestampPolicy)).toBe('timestamp-untrusted');
		});
	});
});

describe('computeVerificationStatus', () => {
	it('returns signature-invalid if any detail has that status', () => {
		const details = [
			mockFullDetail({ status: 'verified' }),
			mockFullDetail({ status: 'signature-invalid' }),
		];
		expect(computeVerificationStatus(details)).toBe('signature-invalid');
	});

	it('returns verified-trusted if all details are verified', () => {
		const details = [
			mockFullDetail({ status: 'verified' }),
			mockFullDetail({ status: 'verified' }),
		];
		expect(computeVerificationStatus(details)).toBe('verified-trusted');
	});

	it('returns verified-untrusted if some details are certificate-untrusted', () => {
		const details = [
			mockFullDetail({ status: 'verified' }),
			mockFullDetail({ status: 'certificate-untrusted' }),
		];
		expect(computeVerificationStatus(details)).toBe('verified-untrusted');
	});

	it('returns present-not-verified for structural-only details', () => {
		const details = [mockFullDetail({ status: 'structural-only' })];
		expect(computeVerificationStatus(details)).toBe('present-not-verified');
	});

	it('returns certificate-revoked if any detail is revoked', () => {
		const details = [
			mockFullDetail({ status: 'verified' }),
			mockFullDetail({ status: 'certificate-revoked' }),
		];
		expect(computeVerificationStatus(details)).toBe('certificate-revoked');
	});

	it('returns digest-mismatch if any detail has that status', () => {
		const details = [mockFullDetail({ status: 'digest-mismatch' })];
		expect(computeVerificationStatus(details)).toBe('digest-mismatch');
	});

	it('returns reference-missing if any detail has that status', () => {
		const details = [mockFullDetail({ status: 'reference-missing' })];
		expect(computeVerificationStatus(details)).toBe('reference-missing');
	});

	it('returns timestamp-invalid if any detail has that status', () => {
		const details = [mockFullDetail({ status: 'timestamp-invalid' })];
		expect(computeVerificationStatus(details)).toBe('timestamp-invalid');
	});

	it('returns timestamp-untrusted if any detail has that status', () => {
		const details = [mockFullDetail({ status: 'timestamp-untrusted' })];
		expect(computeVerificationStatus(details)).toBe('timestamp-untrusted');
	});

	it('prioritizes signature-invalid over certificate-revoked', () => {
		const details = [
			mockFullDetail({ status: 'signature-invalid' }),
			mockFullDetail({ status: 'certificate-revoked' }),
		];
		expect(computeVerificationStatus(details)).toBe('signature-invalid');
	});

	it('prioritizes certificate-revoked over timestamp-invalid', () => {
		const details = [
			mockFullDetail({ status: 'certificate-revoked' }),
			mockFullDetail({ status: 'timestamp-invalid' }),
		];
		expect(computeVerificationStatus(details)).toBe('certificate-revoked');
	});
});
