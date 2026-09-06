import { createModifyVerifier } from 'pptx-viewer-core';
import type { PptxModifyVerifier } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { checkModifyPassword } from './modify-password-check';

describe('checkModifyPassword', () => {
	it('resolves ok:true for the correct password', async () => {
		const verifier = await createModifyVerifier('correct-password', {
			spinCount: 10,
			algorithmName: 'SHA-256',
		});
		await expect(checkModifyPassword(verifier, 'correct-password')).resolves.toStrictEqual({
			ok: true,
		});
	});

	it("resolves ok:false reason:'wrong-password' for an incorrect password", async () => {
		const verifier = await createModifyVerifier('correct-password', {
			spinCount: 10,
			algorithmName: 'SHA-256',
		});
		await expect(checkModifyPassword(verifier, 'nope')).resolves.toStrictEqual({
			ok: false,
			reason: 'wrong-password',
		});
	});

	it("resolves ok:false reason:'unsupported-algorithm' when the hash is unverifiable (missing salt)", async () => {
		const verifier: PptxModifyVerifier = { hashData: 'abc==', algorithmName: 'SHA-512' };
		await expect(checkModifyPassword(verifier, 'anything')).resolves.toStrictEqual({
			ok: false,
			reason: 'unsupported-algorithm',
		});
	});

	it("resolves ok:false reason:'unsupported-algorithm' when the verifier is undefined", async () => {
		await expect(checkModifyPassword(undefined, 'anything')).resolves.toStrictEqual({
			ok: false,
			reason: 'unsupported-algorithm',
		});
	});

	it("resolves ok:false reason:'unsupported-algorithm' when core's digest rejects for an unrecognised algorithm", async () => {
		const verifier: PptxModifyVerifier = {
			hashData: 'YWJj',
			saltData: 'c2FsdA==',
			algorithmName: 'RC4',
		};
		await expect(checkModifyPassword(verifier, 'anything')).resolves.toStrictEqual({
			ok: false,
			reason: 'unsupported-algorithm',
		});
	});

	it('verifies a real PowerPoint-shaped verifier identified only by cryptAlgorithmSid', async () => {
		// PowerPoint's own "Set Password to Modify" writes ONLY
		// `cryptAlgorithmSid` (no `algorithmName`); this must resolve to the same
		// algorithm `createModifyVerifier` names explicitly.
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
		await expect(checkModifyPassword(powerPointShaped, 'powerpoint-style')).resolves.toStrictEqual({
			ok: true,
		});
		await expect(checkModifyPassword(powerPointShaped, 'wrong')).resolves.toStrictEqual({
			ok: false,
			reason: 'wrong-password',
		});
	});

	// The "Unrecognised verifier algorithms are not checked" limitation: MD2,
	// MD4, MD5, RIPEMD-128, RIPEMD-160 and WHIRLPOOL are legal
	// `p:modifyVerifier` algorithms (ECMA-376 19.2.1.22) that Web Crypto never
	// implemented; core now falls back to pure-TypeScript implementations for
	// all of them (`pptx-viewer-core/digests`), so every one of them must
	// resolve `ok: true` here, not `unsupported-algorithm`.
	it.each(['MD2', 'MD4', 'MD5', 'RIPEMD-128', 'RIPEMD-160', 'WHIRLPOOL'] as const)(
		'checks a %s verifier correctly (algorithm Web Crypto never implemented)',
		async (algorithmName) => {
			const verifier = await createModifyVerifier('correct-password', {
				spinCount: 10,
				algorithmName,
			});
			await expect(checkModifyPassword(verifier, 'correct-password')).resolves.toStrictEqual({
				ok: true,
			});
			await expect(checkModifyPassword(verifier, 'wrong')).resolves.toStrictEqual({
				ok: false,
				reason: 'wrong-password',
			});
		},
	);
});
