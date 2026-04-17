import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
	extractPemCertificatesFromText,
	getSignatureValidationPolicy,
	loadEnterpriseTrustRoots,
} from './environment';

// ---------------------------------------------------------------------------
// extractPemCertificatesFromText
// ---------------------------------------------------------------------------

describe('extractPemCertificatesFromText', () => {
	it('extracts PEM certificates from text', () => {
		const text = [
			'Some header text',
			'-----BEGIN CERTIFICATE-----',
			'AAAA',
			'BBBB',
			'-----END CERTIFICATE-----',
			'middle text',
			'-----BEGIN CERTIFICATE-----',
			'CCCC',
			'-----END CERTIFICATE-----',
			'footer text',
		].join('\n');
		const result = extractPemCertificatesFromText(text);
		expect(result).toHaveLength(2);
		expect(result[0]).toContain('AAAA');
		expect(result[0]).toContain('BBBB');
		expect(result[1]).toContain('CCCC');
	});

	it('returns empty array when no certificates present', () => {
		const result = extractPemCertificatesFromText('no certificates here');
		expect(result).toStrictEqual([]);
	});

	it('returns empty array for empty string', () => {
		const result = extractPemCertificatesFromText('');
		expect(result).toStrictEqual([]);
	});

	it('extracts single certificate', () => {
		const text = '-----BEGIN CERTIFICATE-----\nDATA\n-----END CERTIFICATE-----';
		const result = extractPemCertificatesFromText(text);
		expect(result).toHaveLength(1);
		expect(result[0]).toContain('DATA');
	});
});

// ---------------------------------------------------------------------------
// getSignatureValidationPolicy
// ---------------------------------------------------------------------------

describe('getSignatureValidationPolicy', () => {
	const envKeys = [
		'PPTX_VIEWER_REQUIRE_REVOCATION_CHECK',
		'PPTX_VIEWER_FAIL_ON_REVOCATION_UNKNOWN',
		'PPTX_VIEWER_REQUIRE_TIMESTAMP',
	] as const;

	const savedEnv: Record<string, string | undefined> = {};

	beforeEach(() => {
		for (const key of envKeys) {
			savedEnv[key] = process.env[key];
			delete process.env[key];
		}
	});

	afterEach(() => {
		for (const key of envKeys) {
			if (savedEnv[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = savedEnv[key];
			}
		}
	});

	it('returns default false values when env vars not set', () => {
		const policy = getSignatureValidationPolicy();
		expect(policy.requireRevocationCheck).toBeFalsy();
		expect(policy.failOnRevocationUnknown).toBeFalsy();
		expect(policy.requireTimestamp).toBeFalsy();
	});

	it('returns true when env vars are set to "1"', () => {
		process.env['PPTX_VIEWER_REQUIRE_REVOCATION_CHECK'] = '1';
		process.env['PPTX_VIEWER_FAIL_ON_REVOCATION_UNKNOWN'] = 'true';
		process.env['PPTX_VIEWER_REQUIRE_TIMESTAMP'] = 'yes';
		const policy = getSignatureValidationPolicy();
		expect(policy.requireRevocationCheck).toBeTruthy();
		expect(policy.failOnRevocationUnknown).toBeTruthy();
		expect(policy.requireTimestamp).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// loadEnterpriseTrustRoots
// ---------------------------------------------------------------------------

describe('loadEnterpriseTrustRoots', () => {
	const envKeys = ['PPTX_VIEWER_TRUST_ROOTS_PEM', 'PPTX_VIEWER_TRUST_ROOTS_FILE'] as const;

	const savedEnv: Record<string, string | undefined> = {};

	beforeEach(() => {
		for (const key of envKeys) {
			savedEnv[key] = process.env[key];
			delete process.env[key];
		}
	});

	afterEach(() => {
		for (const key of envKeys) {
			if (savedEnv[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = savedEnv[key];
			}
		}
	});

	it('returns empty array when env vars not set', async () => {
		const roots = await loadEnterpriseTrustRoots();
		expect(roots).toStrictEqual([]);
	});

	it('returns empty array when file path points to non-existent file', async () => {
		process.env['PPTX_VIEWER_TRUST_ROOTS_FILE'] = '/nonexistent/path/to/roots.pem';
		const roots = await loadEnterpriseTrustRoots();
		expect(roots).toStrictEqual([]);
	});

	it('extracts certs from inline PEM env var', async () => {
		process.env['PPTX_VIEWER_TRUST_ROOTS_PEM'] = [
			'-----BEGIN CERTIFICATE-----',
			'INLINE_DATA',
			'-----END CERTIFICATE-----',
		].join('\n');
		const roots = await loadEnterpriseTrustRoots();
		expect(roots).toHaveLength(1);
		expect(roots[0]).toContain('INLINE_DATA');
	});
});
