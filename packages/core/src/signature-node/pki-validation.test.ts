import { describe, it, expect } from 'vitest';

import { extractOcspUrls, parseOcspResponseStatus } from './ocsp';
import {
	certPemFromBase64,
	certFingerprintSha256,
	evaluateTimestampAuthority,
} from './pki-validation';

// ---------------------------------------------------------------------------
// certPemFromBase64
// ---------------------------------------------------------------------------

describe('certPemFromBase64', () => {
	it('returns PEM string for valid base64 DER data', () => {
		// A short synthetic base64 string — not a real cert, but enough to test wrapping
		const base64Input = Buffer.from('hello-world-certificate-data').toString('base64');
		const result = certPemFromBase64(base64Input);
		expect(result).toBeDefined();
		expect(result).toContain('-----BEGIN CERTIFICATE-----');
		expect(result).toContain('-----END CERTIFICATE-----');
		// The inner content should be the re-encoded base64 of the decoded bytes
		const inner = result!
			.replace('-----BEGIN CERTIFICATE-----\n', '')
			.replace('\n-----END CERTIFICATE-----', '')
			.replace(/\n/g, '');
		// Round-trip: decode input base64, re-encode — should match inner
		const roundTrip = Buffer.from(base64Input, 'base64').toString('base64');
		expect(inner).toBe(roundTrip);
	});

	it('returns undefined for empty string', () => {
		const result = certPemFromBase64('');
		expect(result).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// certFingerprintSha256
// ---------------------------------------------------------------------------

describe('certFingerprintSha256', () => {
	it('returns undefined for invalid PEM', () => {
		const result = certFingerprintSha256('not-a-valid-pem');
		expect(result).toBeUndefined();
	});

	it('returns undefined for malformed certificate PEM', () => {
		const badPem = '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----';
		const result = certFingerprintSha256(badPem);
		expect(result).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// extractOcspUrls
// ---------------------------------------------------------------------------

describe('extractOcspUrls', () => {
	it('returns empty array for invalid PEM', () => {
		const result = extractOcspUrls('not-a-valid-pem');
		expect(result).toStrictEqual([]);
	});

	it('returns empty array for empty string', () => {
		const result = extractOcspUrls('');
		expect(result).toStrictEqual([]);
	});
});

// ---------------------------------------------------------------------------
// parseOcspResponseStatus
// ---------------------------------------------------------------------------

describe('parseOcspResponseStatus', () => {
	it('returns "error" for empty buffer', () => {
		const result = parseOcspResponseStatus(Buffer.alloc(0));
		expect(result).toBe('error');
	});

	it('returns "error" for invalid ASN.1 data', () => {
		const result = parseOcspResponseStatus(Buffer.from([0xff, 0xfe, 0xfd]));
		expect(result).toBe('error');
	});

	it('returns "error" for a single zero byte', () => {
		const result = parseOcspResponseStatus(Buffer.from([0x00]));
		expect(result).toBe('error');
	});
});

// ---------------------------------------------------------------------------
// evaluateTimestampAuthority
// ---------------------------------------------------------------------------

describe('evaluateTimestampAuthority', () => {
	it('returns "not-present" for XML without timestamp tags', () => {
		const xml = '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo/></Signature>';
		return expect(evaluateTimestampAuthority(xml)).resolves.toStrictEqual({
			status: 'not-present',
		});
	});

	it('returns "not-present" for empty string', () => {
		return expect(evaluateTimestampAuthority('')).resolves.toStrictEqual({
			status: 'not-present',
		});
	});

	it('returns "not-present" for XML with unrelated elements', () => {
		const xml = '<Root><Child>data</Child></Root>';
		return expect(evaluateTimestampAuthority(xml)).resolves.toStrictEqual({
			status: 'not-present',
		});
	});
});
