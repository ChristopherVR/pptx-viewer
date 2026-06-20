/**
 * signatures-helpers.test.ts: Unit tests for the pure signature helpers.
 *
 * Ports the coverage of the Vue `useSignatures.test.ts` (status aggregation)
 * and the presentation-formatting assertions from `SignaturesPanel.test.ts`.
 */

import type { ParsedSignature, SignatureStatus } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	headerLabel,
	isSigned,
	overallStatus,
	signatureCountLabel,
	signatureKey,
	signatureTimestamp,
	signerName,
	statusKind,
	statusLabel,
	worstStatus,
} from './signatures-helpers';

function sig(status: SignatureStatus, overrides: Partial<ParsedSignature> = {}): ParsedSignature {
	return {
		signaturePath: '_xmlsignatures/sig1.xml',
		status,
		references: [],
		...overrides,
	} satisfies ParsedSignature;
}

// ---------------------------------------------------------------------------
// isSigned
// ---------------------------------------------------------------------------

describe('isSigned', () => {
	it('is false for an empty list', () => {
		expect(isSigned([])).toBeFalsy();
	});

	it('is true when at least one signature exists', () => {
		expect(isSigned([sig('valid')])).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// worstStatus (worst-wins aggregation)
// ---------------------------------------------------------------------------

describe('worstStatus', () => {
	it('returns undefined for an empty list', () => {
		expect(worstStatus([])).toBeUndefined();
	});

	it('returns valid when all signatures are valid', () => {
		expect(worstStatus([sig('valid'), sig('valid')])).toBe('valid');
	});

	it('picks the worst status across signatures', () => {
		expect(worstStatus([sig('valid'), sig('expired'), sig('unverified')])).toBe('expired');
	});

	it('ranks invalid as the worst', () => {
		expect(worstStatus([sig('valid'), sig('invalid')])).toBe('invalid');
	});

	it('ranks unknownCA above unverified but below expired/invalid', () => {
		expect(worstStatus([sig('unverified'), sig('unknownCA')])).toBe('unknownCA');
		expect(worstStatus([sig('unknownCA'), sig('expired')])).toBe('expired');
		expect(worstStatus([sig('unknownCA'), sig('invalid')])).toBe('invalid');
	});
});

// ---------------------------------------------------------------------------
// overallStatus
// ---------------------------------------------------------------------------

describe('overallStatus', () => {
	it('reports unsigned for an empty list', () => {
		expect(overallStatus([])).toBe('unsigned');
	});

	it('reports signed when all signatures are valid', () => {
		expect(overallStatus([sig('valid'), sig('valid')])).toBe('signed');
	});

	it('still reports signed for a non-invalid worst status (expired)', () => {
		expect(overallStatus([sig('valid'), sig('expired')])).toBe('signed');
	});

	it('classifies an invalid signature as overall invalid', () => {
		expect(overallStatus([sig('valid'), sig('invalid')])).toBe('invalid');
	});
});

// ---------------------------------------------------------------------------
// headerLabel
// ---------------------------------------------------------------------------

describe('headerLabel', () => {
	it('maps overall status to a human label', () => {
		expect(headerLabel('signed')).toBe('Signed');
		expect(headerLabel('invalid')).toBe('Invalid signature');
		expect(headerLabel('unsigned')).toBe('Not signed');
	});
});

// ---------------------------------------------------------------------------
// statusLabel
// ---------------------------------------------------------------------------

describe('statusLabel', () => {
	it('labels each per-signature status', () => {
		expect(statusLabel('valid')).toBe('Valid');
		expect(statusLabel('invalid')).toBe('Invalid');
		expect(statusLabel('expired')).toBe('Expired');
		expect(statusLabel('unknownCA')).toBe('Unknown certificate authority');
		expect(statusLabel('unverified')).toBe('Unverified');
	});
});

// ---------------------------------------------------------------------------
// statusKind
// ---------------------------------------------------------------------------

describe('statusKind', () => {
	it('buckets valid as valid', () => {
		expect(statusKind('valid')).toBe('valid');
	});

	it('buckets invalid and expired as invalid', () => {
		expect(statusKind('invalid')).toBe('invalid');
		expect(statusKind('expired')).toBe('invalid');
	});

	it('buckets unknownCA and unverified as unknown', () => {
		expect(statusKind('unknownCA')).toBe('unknown');
		expect(statusKind('unverified')).toBe('unknown');
	});
});

// ---------------------------------------------------------------------------
// signerName
// ---------------------------------------------------------------------------

describe('signerName', () => {
	it('prefers the certificate subject', () => {
		const s = sig('valid', {
			certificate: { certificateBase64: 'x', subject: 'CN=Alice', issuer: 'CN=Acme CA' },
		});
		expect(signerName(s)).toBe('CN=Alice');
	});

	it('falls back to the issuer when no subject', () => {
		const s = sig('valid', {
			certificate: { certificateBase64: 'x', issuer: 'CN=Acme CA' },
		});
		expect(signerName(s)).toBe('CN=Acme CA');
	});

	it('falls back to the signature path when no certificate', () => {
		const s = sig('unverified', { signaturePath: '_xmlsignatures/sig9.xml' });
		expect(signerName(s)).toBe('_xmlsignatures/sig9.xml');
	});
});

// ---------------------------------------------------------------------------
// signatureTimestamp
// ---------------------------------------------------------------------------

describe('signatureTimestamp', () => {
	it('returns undefined when no certificate validity date is present', () => {
		expect(signatureTimestamp(sig('unverified'))).toBeUndefined();
	});

	it('formats a valid ISO date into a locale string', () => {
		const s = sig('valid', {
			certificate: { certificateBase64: 'x', validFrom: '2020-01-01T00:00:00Z' },
		});
		const ts = signatureTimestamp(s);
		expect(ts).toBeDefined();
		expect(ts).not.toBe('2020-01-01T00:00:00Z');
	});

	it('returns the raw value unchanged when unparseable', () => {
		const s = sig('valid', {
			certificate: { certificateBase64: 'x', validFrom: 'not-a-date' },
		});
		expect(signatureTimestamp(s)).toBe('not-a-date');
	});
});

// ---------------------------------------------------------------------------
// signatureKey / signatureCountLabel
// ---------------------------------------------------------------------------

describe('signatureKey', () => {
	it('combines the path and index into a stable key', () => {
		expect(signatureKey(sig('valid'), 2)).toBe('_xmlsignatures/sig1.xml-2');
	});
});

describe('signatureCountLabel', () => {
	it('uses the singular form for one signature', () => {
		expect(signatureCountLabel(1)).toBe('1 signature');
	});

	it('uses the plural form for zero or many', () => {
		expect(signatureCountLabel(0)).toBe('0 signatures');
		expect(signatureCountLabel(3)).toBe('3 signatures');
	});
});
