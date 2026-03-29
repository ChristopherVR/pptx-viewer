import { describe, it, expect } from 'vitest';

import {
	pemCertificateToBase64,
	certificateInfoFromBase64,
	loadSigningMaterialFromBuffer,
} from './certificate-utils';

// ---------------------------------------------------------------------------
// pemCertificateToBase64
// ---------------------------------------------------------------------------

describe('pemCertificateToBase64', () => {
	it('strips PEM armour and whitespace correctly', () => {
		const pem = [
			'-----BEGIN CERTIFICATE-----',
			'AAAA',
			'BBBB',
			'CCCC',
			'-----END CERTIFICATE-----',
		].join('\n');
		expect(pemCertificateToBase64(pem)).toBe('AAAABBBBCCCC');
	});

	it('handles PEM with extra whitespace and carriage returns', () => {
		const pem = '-----BEGIN CERTIFICATE-----\r\n  AA  \r\n  BB  \r\n-----END CERTIFICATE-----';
		expect(pemCertificateToBase64(pem)).toBe('AABB');
	});

	it('returns empty string for empty PEM armour', () => {
		const pem = '-----BEGIN CERTIFICATE----------END CERTIFICATE-----';
		expect(pemCertificateToBase64(pem)).toBe('');
	});
});

// ---------------------------------------------------------------------------
// certificateInfoFromBase64
// ---------------------------------------------------------------------------

describe('certificateInfoFromBase64', () => {
	it('returns undefined for invalid base64 (not a DER certificate)', () => {
		const result = certificateInfoFromBase64('not-a-real-cert!!!');
		expect(result).toBeUndefined();
	});

	it('returns undefined for empty string', () => {
		const result = certificateInfoFromBase64('');
		expect(result).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// loadSigningMaterialFromBuffer
// ---------------------------------------------------------------------------

describe('loadSigningMaterialFromBuffer', () => {
	it('throws for PEM without both private key and certificate', () => {
		const pemOnlyCert = Buffer.from('-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----');
		expect(() => loadSigningMaterialFromBuffer(new Uint8Array(pemOnlyCert), 'test.pem')).toThrow(
			'PEM certificate must contain both private key and certificate.',
		);
	});

	it('throws for PEM with only a private key', () => {
		const pemOnlyKey = Buffer.from('-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----');
		expect(() => loadSigningMaterialFromBuffer(new Uint8Array(pemOnlyKey), 'test.pem')).toThrow(
			'PEM certificate must contain both private key and certificate.',
		);
	});

	it('throws for empty PEM content', () => {
		const emptyPem = Buffer.from('');
		expect(() => loadSigningMaterialFromBuffer(new Uint8Array(emptyPem), 'test.pem')).toThrow(
			'PEM certificate must contain both private key and certificate.',
		);
	});

	it('throws for invalid PKCS#12 data', () => {
		const invalidP12 = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
		expect(() => loadSigningMaterialFromBuffer(invalidP12, 'test.pfx')).toThrow();
	});
});
