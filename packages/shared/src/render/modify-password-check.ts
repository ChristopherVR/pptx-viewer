/**
 * modify-password-check.ts: verify a password entered against a deck's
 * `p:modifyVerifier` (see `read-only-recommendation.ts`), and describe the
 * outcome as a framework-neutral result a binding's password prompt can
 * render directly.
 *
 * The actual ECMA-376 19.2.1.22 / [MS-OFFCRYPTO] hash check lives in core's
 * `verifyModifyPassword` (`pptx-viewer-core`), which is async (Web Crypto's
 * `SubtleCrypto.digest` is promise-based) and rejects for a hash algorithm it
 * cannot map to a Web Crypto digest name. This module does nothing but call
 * that verifier and turn "it resolved false" / "it threw" into the two
 * reasons a binding needs to distinguish: a password that was simply wrong
 * (keep prompting) versus a file this viewer cannot check at all (there is no
 * password that will ever unlock it here).
 *
 * Framework-agnostic: no React, Vue, Angular, Svelte or DOM imports.
 */
import { resolveModifyVerifierAlgorithmName, verifyModifyPassword } from 'pptx-viewer-core';
import type { PptxModifyVerifier } from 'pptx-viewer-core';

export type ModifyPasswordCheckResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly reason: 'wrong-password' | 'unsupported-algorithm' };

/**
 * Check a candidate password against `verifier`.
 *
 * The algorithm check goes through `resolveModifyVerifierAlgorithmName`
 * (`pptx-viewer-core`), not a bare `verifier.algorithmName` read: PowerPoint's
 * own "Set Password to Modify" writes ONLY `cryptAlgorithmSid` (no
 * `algorithmName` attribute at all), so a bare read here would report every
 * real PowerPoint-authored modify password as unsupported, exactly the same
 * mistake `ReadOnlyRecommendation.requiresPassword` would make without the
 * same resolver, which is the whole reason this function exists to check the
 * password `requiresPassword` promised was checkable.
 *
 * Returns `{ ok: false, reason: 'unsupported-algorithm' }` both when the
 * verifier is missing the pieces needed to run the check at all (mirrors
 * `requiresPassword`, but this function stays defensive against being called
 * directly) and when core's verifier throws trying to compute the digest
 * (an algorithm this viewer's Web Crypto binding does not support).
 */
export async function checkModifyPassword(
	verifier: PptxModifyVerifier | undefined,
	password: string,
): Promise<ModifyPasswordCheckResult> {
	if (!verifier?.hashData || !verifier.saltData || !resolveModifyVerifierAlgorithmName(verifier)) {
		return { ok: false, reason: 'unsupported-algorithm' };
	}
	try {
		const matched = await verifyModifyPassword(verifier, password);
		return matched ? { ok: true } : { ok: false, reason: 'wrong-password' };
	} catch {
		return { ok: false, reason: 'unsupported-algorithm' };
	}
}
