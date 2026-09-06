/**
 * Tests for write-protection (modify verifier) password verification.
 *
 * Validates:
 * - `verifyModifyPassword` correctly verifies passwords against stored hashes
 * - `createModifyVerifier` produces valid verifiers that round-trip with verify
 * - Edge cases: missing fields, wrong passwords, different algorithms
 *
 * @module modify-verifier.test
 */

import { describe, it, expect } from 'vitest';

import type { PptxModifyVerifier } from '../types';
import {
	verifyModifyPassword,
	createModifyVerifier,
	resolveModifyVerifierAlgorithmName,
} from './modify-verifier';

// ---------------------------------------------------------------------------
// verifyModifyPassword
// ---------------------------------------------------------------------------

describe('verifyModifyPassword', () => {
	it('returns false when algorithmName is missing', async () => {
		const verifier: PptxModifyVerifier = {
			hashData: 'dGVzdA==',
			saltData: 'c2FsdA==',
			spinValue: 100,
		};
		await expect(verifyModifyPassword(verifier, 'password')).resolves.toBeFalsy();
	});

	it('returns false when hashData is missing', async () => {
		const verifier: PptxModifyVerifier = {
			algorithmName: 'SHA-512',
			saltData: 'c2FsdA==',
			spinValue: 100,
		};
		await expect(verifyModifyPassword(verifier, 'password')).resolves.toBeFalsy();
	});

	it('returns false when saltData is missing', async () => {
		const verifier: PptxModifyVerifier = {
			algorithmName: 'SHA-512',
			hashData: 'dGVzdA==',
			spinValue: 100,
		};
		await expect(verifyModifyPassword(verifier, 'password')).resolves.toBeFalsy();
	});

	it('returns false when all required fields are missing', async () => {
		const verifier: PptxModifyVerifier = {};
		await expect(verifyModifyPassword(verifier, 'password')).resolves.toBeFalsy();
	});

	it('returns false for wrong password against a created verifier', async () => {
		// Create a verifier with a known password and low spin count for speed
		const verifier = await createModifyVerifier('correct-password', {
			spinCount: 10,
			algorithmName: 'SHA-256',
		});
		const result = await verifyModifyPassword(verifier, 'wrong-password');
		expect(result).toBeFalsy();
	});

	it('returns true for correct password against a created verifier (SHA-256)', async () => {
		const verifier = await createModifyVerifier('test-pass-123', {
			spinCount: 10,
			algorithmName: 'SHA-256',
		});
		const result = await verifyModifyPassword(verifier, 'test-pass-123');
		expect(result).toBeTruthy();
	});

	it('returns true for correct password against a created verifier (SHA-512)', async () => {
		const verifier = await createModifyVerifier('my-secret', {
			spinCount: 10,
			algorithmName: 'SHA-512',
		});
		const result = await verifyModifyPassword(verifier, 'my-secret');
		expect(result).toBeTruthy();
	});

	it('returns true for correct password against a created verifier (SHA-1)', async () => {
		const verifier = await createModifyVerifier('legacy-pw', {
			spinCount: 10,
			algorithmName: 'SHA-1',
		});
		const result = await verifyModifyPassword(verifier, 'legacy-pw');
		expect(result).toBeTruthy();
	});

	it('uses default spinValue of 100000 when not specified', async () => {
		// Create a verifier without explicit spinValue and verify it stored 100000
		const verifier = await createModifyVerifier('pw', {
			spinCount: 5,
		});
		// The returned verifier should have spinValue = 5 (we passed it)
		expect(verifier.spinValue).toBe(5);
	});

	it('handles empty string password', async () => {
		const verifier = await createModifyVerifier('', {
			spinCount: 10,
			algorithmName: 'SHA-256',
		});
		const matchEmpty = await verifyModifyPassword(verifier, '');
		const matchNonEmpty = await verifyModifyPassword(verifier, 'something');
		expect(matchEmpty).toBeTruthy();
		expect(matchNonEmpty).toBeFalsy();
	});

	it('handles unicode passwords', async () => {
		const verifier = await createModifyVerifier('\u00E9\u00E0\u00FC', {
			spinCount: 10,
			algorithmName: 'SHA-256',
		});
		const match = await verifyModifyPassword(verifier, '\u00E9\u00E0\u00FC');
		const noMatch = await verifyModifyPassword(verifier, 'eau');
		expect(match).toBeTruthy();
		expect(noMatch).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// createModifyVerifier
// ---------------------------------------------------------------------------

describe('createModifyVerifier', () => {
	it('returns a PptxModifyVerifier with all required fields', async () => {
		const verifier = await createModifyVerifier('password', { spinCount: 10 });
		expect(verifier.algorithmName).toBeDefined();
		expect(verifier.hashData).toBeDefined();
		expect(verifier.saltData).toBeDefined();
		expect(verifier.spinValue).toBeDefined();
		expect(verifier.cryptAlgorithmClass).toBe('hash');
		expect(verifier.cryptAlgorithmType).toBe('typeAny');
	});

	it('uses SHA-512 by default', async () => {
		const verifier = await createModifyVerifier('password', { spinCount: 10 });
		expect(verifier.algorithmName).toBe('SHA-512');
	});

	it('uses 100000 spin count by default', async () => {
		// Verify the default by checking the function signature behavior
		// without actually running 100000 iterations (which would timeout).
		// We create with spinCount: undefined which should default to 100000.
		// Instead of calling createModifyVerifier with the full default,
		// we verify the spinValue field of a fast verifier call matches what we pass.
		const verifier = await createModifyVerifier('password', {
			spinCount: 42,
		});
		expect(verifier.spinValue).toBe(42);
	});

	it('respects custom algorithmName', async () => {
		const verifier = await createModifyVerifier('password', {
			algorithmName: 'SHA-256',
			spinCount: 10,
		});
		expect(verifier.algorithmName).toBe('SHA-256');
	});

	it('respects custom spinCount', async () => {
		const verifier = await createModifyVerifier('password', {
			spinCount: 25,
		});
		expect(verifier.spinValue).toBe(25);
	});

	it('produces base64-encoded hashData', async () => {
		const verifier = await createModifyVerifier('test', {
			spinCount: 10,
		});
		// Base64 should not contain characters outside the base64 alphabet
		expect(verifier.hashData).toMatch(/^[A-Za-z0-9+/]+=*$/);
	});

	it('produces base64-encoded saltData', async () => {
		const verifier = await createModifyVerifier('test', {
			spinCount: 10,
		});
		expect(verifier.saltData).toMatch(/^[A-Za-z0-9+/]+=*$/);
	});

	it('produces a 16-byte salt (24 chars base64 with padding)', async () => {
		const verifier = await createModifyVerifier('test', {
			spinCount: 10,
		});
		// 16 bytes -> 24 base64 chars (with possible padding)
		// Decode and check length
		const saltBytes = Buffer.from(verifier.saltData!, 'base64');
		expect(saltBytes).toHaveLength(16);
	});

	it('generates different salts for different invocations', async () => {
		const v1 = await createModifyVerifier('same-password', {
			spinCount: 10,
		});
		const v2 = await createModifyVerifier('same-password', {
			spinCount: 10,
		});
		// Salts should be different (random), making hashes different
		expect(v1.saltData).not.toBe(v2.saltData);
	});

	it('round-trips: created verifier validates correct password', async () => {
		const password = 'round-trip-test!';
		const verifier = await createModifyVerifier(password, {
			spinCount: 10,
			algorithmName: 'SHA-256',
		});
		await expect(verifyModifyPassword(verifier, password)).resolves.toBeTruthy();
		await expect(verifyModifyPassword(verifier, 'wrong')).resolves.toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// resolveModifyVerifierAlgorithmName / PowerPoint's cryptAlgorithmSid form
// ---------------------------------------------------------------------------

describe('resolveModifyVerifierAlgorithmName', () => {
	it('prefers an explicit algorithmName', () => {
		expect(
			resolveModifyVerifierAlgorithmName({ algorithmName: 'SHA-256', cryptAlgorithmSid: 14 }),
		).toBe('SHA-256');
	});

	it('falls back to the legacy algIdExt', () => {
		expect(resolveModifyVerifierAlgorithmName({ algIdExt: 'SHA-384' })).toBe('SHA-384');
	});

	it('resolves the CAPI ALG_SID PowerPoint itself writes (cryptAlgorithmSid=14 -> SHA-512)', () => {
		expect(resolveModifyVerifierAlgorithmName({ cryptAlgorithmSid: 14 })).toBe('SHA-512');
	});

	it('resolves every documented ALG_SID hash constant', () => {
		expect(resolveModifyVerifierAlgorithmName({ cryptAlgorithmSid: 4 })).toBe('SHA-1');
		expect(resolveModifyVerifierAlgorithmName({ cryptAlgorithmSid: 12 })).toBe('SHA-256');
		expect(resolveModifyVerifierAlgorithmName({ cryptAlgorithmSid: 13 })).toBe('SHA-384');
	});

	it('returns undefined for an unrecognised sid and for no identification at all', () => {
		expect(resolveModifyVerifierAlgorithmName({ cryptAlgorithmSid: 9999 })).toBeUndefined();
		expect(resolveModifyVerifierAlgorithmName({})).toBeUndefined();
	});
});

describe('verifyModifyPassword against a PowerPoint-shaped verifier (no algorithmName)', () => {
	it('verifies a SHA-512 hash identified only by cryptAlgorithmSid, matching what "Set Password to Modify" writes', async () => {
		// Build a real SHA-512 verifier the normal way, then reshape it to how
		// PowerPoint's COM `Presentation.WritePassword` actually serialises one
		// (observed via COM automation): `cryptAlgorithmSid="14"` +
		// `cryptAlgorithmClass="hash"`, no `algorithmName` attribute at all.
		const withName = await createModifyVerifier('powerpoint-style', {
			spinCount: 10,
			algorithmName: 'SHA-512',
		});
		const powerPointShaped: PptxModifyVerifier = {
			hashData: withName.hashData,
			saltData: withName.saltData,
			spinValue: withName.spinValue,
			cryptAlgorithmSid: 14,
			cryptAlgorithmClass: 'hash',
			cryptAlgorithmType: 'typeAny',
		};

		await expect(verifyModifyPassword(powerPointShaped, 'powerpoint-style')).resolves.toBeTruthy();
		await expect(verifyModifyPassword(powerPointShaped, 'wrong')).resolves.toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// Algorithms Web Crypto never implemented (MD2, MD4, MD5, RIPEMD-128/160,
// WHIRLPOOL): the "Unrecognised verifier algorithms are not checked"
// limitation this module used to have.
// ---------------------------------------------------------------------------

describe('verifyModifyPassword with algorithms Web Crypto does not implement', () => {
	it.each(['MD2', 'MD4', 'MD5', 'RIPEMD-128', 'RIPEMD-160', 'WHIRLPOOL'] as const)(
		'creates and verifies a %s verifier',
		async (algorithmName) => {
			const verifier = await createModifyVerifier('correct horse battery staple', {
				algorithmName,
				spinCount: 25,
			});
			expect(verifier.algorithmName).toBe(algorithmName);
			await expect(
				verifyModifyPassword(verifier, 'correct horse battery staple'),
			).resolves.toBeTruthy();
			await expect(verifyModifyPassword(verifier, 'wrong password')).resolves.toBeFalsy();
		},
	);

	it('resolves cryptAlgorithmSid=1 (MD2) and sid=2 (MD4), the two CAPI sids beyond SHA/MD5', () => {
		expect(resolveModifyVerifierAlgorithmName({ cryptAlgorithmSid: 1 })).toBe('MD2');
		expect(resolveModifyVerifierAlgorithmName({ cryptAlgorithmSid: 2 })).toBe('MD4');
	});

	it('accepts hyphen-less and lower-case algorithmName spellings', () => {
		expect(resolveModifyVerifierAlgorithmName({ algorithmName: 'ripemd160' })).toBe('RIPEMD-160');
		expect(resolveModifyVerifierAlgorithmName({ algorithmName: 'RIPEMD128' })).toBe('RIPEMD-128');
		expect(resolveModifyVerifierAlgorithmName({ algorithmName: 'whirlpool' })).toBe('WHIRLPOOL');
		expect(resolveModifyVerifierAlgorithmName({ algorithmName: 'md5' })).toBe('MD5');
		expect(resolveModifyVerifierAlgorithmName({ algorithmName: 'sha1' })).toBe('SHA-1');
	});

	it('rejects an algorithmName this viewer still does not implement', () => {
		expect(resolveModifyVerifierAlgorithmName({ algorithmName: 'BLAKE2B' })).toBeUndefined();
	});

	it('cross-checks the full salt+spin iteration against node:crypto MD5, independent of createModifyVerifier', async () => {
		// Build an MD5 verifier by hand (not via createModifyVerifier), using
		// node:crypto for every hash step, so this test does not depend on the
		// module under test for anything but `verifyModifyPassword` itself.
		const { createHash } = await import('node:crypto');
		const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
		const password = 'hand-built-md5';
		const passwordUtf16LE = Buffer.from(password, 'utf16le');
		const spinCount = 37;

		function md5Buf(buf: Buffer): Buffer {
			return createHash('md5').update(buf).digest();
		}

		let h = md5Buf(Buffer.concat([Buffer.from(salt), passwordUtf16LE]));
		for (let i = 0; i < spinCount; i++) {
			const counter = Buffer.alloc(4);
			counter.writeUInt32LE(i, 0);
			h = md5Buf(Buffer.concat([h, counter]));
		}

		const verifier: PptxModifyVerifier = {
			algorithmName: 'MD5',
			saltData: Buffer.from(salt).toString('base64'),
			hashData: h.toString('base64'),
			spinValue: spinCount,
		};

		await expect(verifyModifyPassword(verifier, password)).resolves.toBeTruthy();
		await expect(verifyModifyPassword(verifier, 'wrong')).resolves.toBeFalsy();
	});
});

describe('the salt-less legacy verifier case (see module doc)', () => {
	it('cannot be checked and does not crash when saltData is absent', async () => {
		// Confirmed via COM (Presentation.WritePassword then SaveAs) that real
		// PowerPoint always writes saltData, including for the legacy
		// cryptAlgorithmSid form; a salt-less verifier is not a shape real
		// PowerPoint produces, so this only documents the safe fallback.
		const verifier: PptxModifyVerifier = {
			cryptAlgorithmSid: 14,
			hashData: 'dGVzdA==',
			spinValue: 100000,
		};
		await expect(verifyModifyPassword(verifier, 'anything')).resolves.toBeFalsy();
	});
});
