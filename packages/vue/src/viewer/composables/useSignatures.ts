import type { ParsedSignature, SignatureStatus } from 'pptx-viewer-core';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { computed, toValue } from 'vue';

/**
 * Read-only digital-signature inspection composable for the Vue viewer.
 *
 * Digital signatures in OOXML packages live under `_xmlsignatures/`. The core
 * `PptxHandler` detects their presence at load time (it stores a
 * {@link import('pptx-viewer-core').SignatureDetectionResult} internally and
 * surfaces `hasDigitalSignatures` / `digitalSignatureCount` on `PptxData`), but
 * it does NOT expose the fully-parsed signatures. The host obtains the parsed
 * `ParsedSignature[]` itself — by reading each `_xmlsignatures/sig*.xml` part
 * and running the core `parseSignatureXml(...)` helper — then feeds the result
 * in here. This composable is purely presentational state derivation: it never
 * signs, strips, or mutates anything.
 *
 * Overall status precedence (worst-wins), mirroring how a signature panel
 * should warn the user:
 *   invalid  >  expired / unknownCA  >  unverified  >  valid
 */

/** Overall package signature status derived from all individual signatures. */
export type OverallSignatureStatus = 'signed' | 'invalid' | 'unsigned';

export interface UseSignaturesResult {
	/** The signatures currently being inspected (reactive passthrough). */
	signatures: ComputedRef<ParsedSignature[]>;
	/** True when the package carries at least one signature part. */
	isSigned: ComputedRef<boolean>;
	/**
	 * The single worst per-signature status across the package, or `undefined`
	 * when the package is unsigned. Useful for badge colouring.
	 */
	status: ComputedRef<SignatureStatus | undefined>;
	/** Coarse-grained "Signed / Invalid / Not signed" classification. */
	overall: ComputedRef<OverallSignatureStatus>;
}

/** Per-status severity for worst-wins aggregation (higher = worse). */
const STATUS_SEVERITY: Record<SignatureStatus, number> = {
	valid: 0,
	unverified: 1,
	unknownCA: 2,
	expired: 3,
	invalid: 4,
};

/**
 * Derive reactive signature status from a (possibly reactive) list of parsed
 * signatures. The host runs detection/parsing and supplies the array.
 */
export function useSignatures(
	signaturesInput: MaybeRefOrGetter<ParsedSignature[]>,
): UseSignaturesResult {
	const signatures = computed<ParsedSignature[]>(() => toValue(signaturesInput) ?? []);

	const isSigned = computed<boolean>(() => signatures.value.length > 0);

	const status = computed<SignatureStatus | undefined>(() => {
		if (signatures.value.length === 0) {
			return undefined;
		}
		let worst: SignatureStatus = 'valid';
		for (const sig of signatures.value) {
			if (STATUS_SEVERITY[sig.status] > STATUS_SEVERITY[worst]) {
				worst = sig.status;
			}
		}
		return worst;
	});

	const overall = computed<OverallSignatureStatus>(() => {
		if (!isSigned.value) {
			return 'unsigned';
		}
		return status.value === 'invalid' ? 'invalid' : 'signed';
	});

	return { signatures, isSigned, status, overall };
}
