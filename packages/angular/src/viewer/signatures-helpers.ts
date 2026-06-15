/**
 * signatures-helpers.ts — Pure functions for digital-signature status
 * derivation and presentation.
 *
 * Angular port of the logic in the Vue `useSignatures` composable and
 * `SignaturesPanel.vue`. These functions are framework-agnostic and fully
 * unit-testable: they never sign, strip, or mutate anything — they only
 * inspect a supplied list of already-parsed signatures and derive display
 * state.
 *
 * Overall status precedence (worst-wins), mirroring how a signature panel
 * should warn the user:
 *   invalid  >  expired  >  unknownCA  >  unverified  >  valid
 */

import type { ParsedSignature, SignatureStatus } from 'pptx-viewer-core';

/** Coarse-grained "Signed / Invalid / Not signed" classification. */
export type OverallSignatureStatus = 'signed' | 'invalid' | 'unsigned';

/** Coarse validity bucket for per-signature styling. */
export type SignatureStatusKind = 'valid' | 'invalid' | 'unknown';

/** Per-status severity for worst-wins aggregation (higher = worse). */
const STATUS_SEVERITY: Record<SignatureStatus, number> = {
	valid: 0,
	unverified: 1,
	unknownCA: 2,
	expired: 3,
	invalid: 4,
};

/** True when the package carries at least one signature part. */
export function isSigned(signatures: readonly ParsedSignature[]): boolean {
	return signatures.length > 0;
}

/**
 * The single worst per-signature status across the package, or `undefined`
 * when the package is unsigned. Useful for badge colouring.
 */
export function worstStatus(signatures: readonly ParsedSignature[]): SignatureStatus | undefined {
	if (signatures.length === 0) {
		return undefined;
	}
	let worst: SignatureStatus = 'valid';
	for (const sig of signatures) {
		if (STATUS_SEVERITY[sig.status] > STATUS_SEVERITY[worst]) {
			worst = sig.status;
		}
	}
	return worst;
}

/** Coarse-grained "Signed / Invalid / Not signed" classification. */
export function overallStatus(signatures: readonly ParsedSignature[]): OverallSignatureStatus {
	if (!isSigned(signatures)) {
		return 'unsigned';
	}
	return worstStatus(signatures) === 'invalid' ? 'invalid' : 'signed';
}

/** Header label for the panel given the overall package status. */
export function headerLabel(overall: OverallSignatureStatus): string {
	switch (overall) {
		case 'invalid':
			return 'Invalid signature';
		case 'signed':
			return 'Signed';
		default:
			return 'Not signed';
	}
}

/** Human-readable label for a per-signature status. */
export function statusLabel(status: SignatureStatus): string {
	switch (status) {
		case 'valid':
			return 'Valid';
		case 'invalid':
			return 'Invalid';
		case 'expired':
			return 'Expired';
		case 'unknownCA':
			return 'Unknown certificate authority';
		default:
			return 'Unverified';
	}
}

/** Coarse validity bucket for styling: valid / invalid / unknown. */
export function statusKind(status: SignatureStatus): SignatureStatusKind {
	if (status === 'valid') {
		return 'valid';
	}
	if (status === 'invalid' || status === 'expired') {
		return 'invalid';
	}
	return 'unknown';
}

/** Best-effort signer name: certificate subject, else issuer, else path. */
export function signerName(sig: ParsedSignature): string {
	return sig.certificate?.subject ?? sig.certificate?.issuer ?? sig.signaturePath;
}

/**
 * Best-effort signing timestamp. The parsed signature does not carry a
 * dedicated signing-time field in the public shape, so we fall back to the
 * certificate's validity window when present. Returns `undefined` when no
 * timestamp can be derived.
 */
export function signatureTimestamp(sig: ParsedSignature): string | undefined {
	const raw = sig.certificate?.validFrom;
	if (!raw) {
		return undefined;
	}
	const date = new Date(raw);
	return Number.isNaN(date.getTime()) ? raw : date.toLocaleString();
}

/** Stable list key for a signature row. */
export function signatureKey(sig: ParsedSignature, index: number): string {
	return `${sig.signaturePath}-${index}`;
}

/** Human-readable "N signature(s)" count label. */
export function signatureCountLabel(count: number): string {
	return `${count} signature${count === 1 ? '' : 's'}`;
}
