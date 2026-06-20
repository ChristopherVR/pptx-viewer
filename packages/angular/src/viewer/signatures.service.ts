/**
 * signatures.service.ts: Read-only digital-signature inspection service.
 *
 * Angular port of the Vue `useSignatures` composable. Digital signatures in
 * OOXML packages live under `_xmlsignatures/`. The core `PptxHandler` detects
 * their presence at load time (surfacing `hasDigitalSignatures` /
 * `digitalSignatureCount` on `PptxData`), but it does NOT expose the
 * fully-parsed signatures. The host obtains the parsed `ParsedSignature[]`
 * itself, by reading each `_xmlsignatures/sig*.xml` part and running the core
 * `parseSignatureXml(...)` helper, then feeds the result in here via
 * {@link SignaturesService.setSignatures}.
 *
 * This service is purely presentational state derivation: it never signs,
 * strips, or mutates anything.
 *
 * Provide it at the component level so its lifetime tracks the host viewer:
 * `@Component({ providers: [SignaturesService] })`.
 */

import { Injectable, computed, signal } from '@angular/core';
import type { ParsedSignature, SignatureStatus } from 'pptx-viewer-core';

import {
	isSigned as isSignedHelper,
	overallStatus as overallStatusHelper,
	worstStatus,
} from './signatures-helpers';
import type { OverallSignatureStatus } from './signatures-helpers';

@Injectable()
export class SignaturesService {
	/** Backing source of parsed signatures. */
	private readonly _signatures = signal<ParsedSignature[]>([]);

	/** The signatures currently being inspected (read-only). */
	readonly signatures = this._signatures.asReadonly();

	/** True when the package carries at least one signature part. */
	readonly isSigned = computed<boolean>(() => isSignedHelper(this._signatures()));

	/**
	 * The single worst per-signature status across the package, or `undefined`
	 * when the package is unsigned. Useful for badge colouring.
	 */
	readonly status = computed<SignatureStatus | undefined>(() => worstStatus(this._signatures()));

	/** Coarse-grained "Signed / Invalid / Not signed" classification. */
	readonly overall = computed<OverallSignatureStatus>(() =>
		overallStatusHelper(this._signatures()),
	);

	/** Number of signatures currently loaded. */
	readonly signatureCount = computed<number>(() => this._signatures().length);

	/** Replace the inspected signature list (host parses and supplies it). */
	setSignatures(signatures: readonly ParsedSignature[] | null | undefined): void {
		this._signatures.set(signatures ? [...signatures] : []);
	}

	/** Clear all inspected signatures (e.g. when a new file loads). */
	clear(): void {
		this._signatures.set([]);
	}
}
