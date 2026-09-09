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

	it("resolves ok:false reason:'wrong-password', not 'unsupported-algorithm', for a salt-less verifier with a garbage hash", async () => {
		// A missing saltData no longer means "cannot check" (see
		// `resolveModifyVerifierAlgorithmName`'s and `verifyModifyPassword`'s
		// module docs in `pptx-viewer-core`): 'abc==' just is not the real hash
		// of 'anything' under an empty salt, so this is a wrong password, not an
		// unverifiable verifier.
		const verifier: PptxModifyVerifier = { hashData: 'abc==', algorithmName: 'SHA-512' };
		await expect(checkModifyPassword(verifier, 'anything')).resolves.toStrictEqual({
			ok: false,
			reason: 'wrong-password',
		});
		// No spinCount on the verifier means PowerPoint's default 100000 PBKDF2
		// rounds run for real here (about 2s alone, longer under a parallel
		// suite), so this test gets more than vitest's 5s default.
	}, 30_000);

	it('checks a REAL salt-less verifier correctly (checkable, not unsupported)', async () => {
		const { createSaltlessModifyVerifierForTesting } = await import('pptx-viewer-core');
		const verifier = await createSaltlessModifyVerifierForTesting('salt-less-password', {
			algorithmName: 'SHA-512',
			spinCount: 10,
		});
		expect(verifier.saltData).toBeUndefined();
		await expect(checkModifyPassword(verifier, 'salt-less-password')).resolves.toStrictEqual({
			ok: true,
		});
		await expect(checkModifyPassword(verifier, 'wrong')).resolves.toStrictEqual({
			ok: false,
			reason: 'wrong-password',
		});
	});

	it("resolves ok:false reason:'unsupported-algorithm' when a verifier has no hash at all", async () => {
		const verifier: PptxModifyVerifier = { algorithmName: 'SHA-512' };
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
