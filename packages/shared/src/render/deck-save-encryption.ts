/**
 * deck-save-encryption: the single place that decides whether a deck save
 * produces a plain OOXML ZIP or an encrypted OLE/CFB container.
 *
 * "Encrypt with Password" (File > Info > Protect Presentation) captures a
 * secret in every binding. Whether that secret reaches the serialiser used to
 * be re-decided per binding, and four of the five never decided it at all:
 * they stored the password, showed a "protected" badge, and wrote a plaintext
 * `.pptx`. That is a security-facing lie, so the decision now lives here as a
 * pure function and every binding routes its save through
 * {@link saveDeckWithPassword}.
 *
 * The rule is deliberately trivial: a non-empty password means
 * `PptxHandler.saveEncrypted` (ECMA-376 agile encryption inside an OLE2
 * compound file with `EncryptionInfo` + `EncryptedPackage` streams), anything
 * else means `PptxHandler.save` (a `PK\x03\x04` ZIP). What matters is that it
 * is decided ONCE.
 *
 * The one exception is the save PURPOSE (see {@link DeckSavePurpose}): bytes the
 * viewer writes only so it can read them back itself - the crash-recovery
 * autosave snapshot, and the re-serialise-then-reload cycle behind "apply
 * theme" - are never encrypted, because nothing on the way back in has a
 * password to offer.
 */

import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { detectFileFormat } from 'pptx-viewer-core';

/**
 * The slice of `PptxHandler` a deck save needs. Bindings pass the live handler;
 * tests pass a stub with the same two methods.
 */
export type DeckSaveSerializer = Pick<PptxHandler, 'save' | 'saveEncrypted'>;

/** The save options `PptxHandler.save` accepts (format, docProps, masters, ...). */
export type DeckSaveOptions = NonNullable<Parameters<PptxHandler['save']>[1]>;

/**
 * Why the deck is being serialised, which is a separate question from whether
 * the user protected it.
 *
 * - `user-file` (the default): the bytes leave the viewer as a file. Save,
 *   Save As, Export, the host-facing `getContent()`. Protection applies.
 * - `recovery-snapshot`: the bytes exist only so the viewer can read them back.
 *   The autosave crash-recovery snapshot in IndexedDB, and the internal
 *   re-serialise-then-reload cycle behind "apply theme". Protection does NOT
 *   apply: these are always written in the clear.
 *
 * ## Why a recovery snapshot must stay plaintext
 *
 * Nothing that reads a snapshot back has a password to give it.
 * `readBackstageRecentFile`, `restoreSessionDeck` and the Version History
 * panel's Restore all hand `record.data` straight to `PptxHandler.load()` with
 * no `password` option, and an encrypted package refuses to open without one
 * (`EncryptedFileError`). So an encrypted snapshot is not an inconvenience, it
 * is unreadable: the moment the user turns on protection their crash-recovery
 * data is silently destroyed, which is the exact opposite of what autosave is
 * for.
 *
 * Encrypting it "properly" is not available either. Decrypting on recovery
 * means the key has to outlive the crash the snapshot exists for, so it would
 * have to sit in the same IndexedDB / localStorage as the snapshot itself,
 * next to the ciphertext it unlocks. That is not a security boundary, it is
 * theatre. Prompting the user instead only works if they remember the password
 * of a deck they lost, which is precisely the moment they will not.
 *
 * ## The tradeoff this accepts (deliberately, not by omission)
 *
 * A password-protected deck DOES leave its content in cleartext at rest in the
 * origin's IndexedDB. Anyone with the browser profile, or any script running on
 * the origin, can read it. What limits the exposure: snapshots are scoped to
 * the origin and profile, aged out by the store, and clearable from
 * File > Account > Storage & Privacy (`clearLocalStorageData`). A user who
 * cannot accept plaintext at rest should switch AutoSave off, which stops the
 * snapshot being written at all.
 *
 * The rejected alternative was "skip autosave entirely while a password is
 * set". It removes the plaintext, but it also removes crash recovery without
 * telling anyone, so a crash loses the whole editing session. Losing data
 * quietly is the failure mode we are fixing, not a fix for it.
 */
export type DeckSavePurpose = 'user-file' | 'recovery-snapshot';

/**
 * What the Protect-Presentation UI knows at save time. `password` is the secret
 * the dialog captured; `passwordProtected` is the separate "is protected" flag
 * some bindings track for the badge. When the flag is explicitly `false` the
 * deck saves in the clear even if a stale secret is still around, so removing
 * a password can never leave the next save encrypted.
 *
 * `purpose` defaults to `'user-file'`; see {@link DeckSavePurpose} for why
 * `'recovery-snapshot'` overrides the password.
 */
export interface DeckSaveIntent {
	password?: string | null;
	passwordProtected?: boolean;
	purpose?: DeckSavePurpose;
}

/**
 * Framework-neutral descriptor: which serialiser to call, and with what.
 * A discriminated union so `plan.password` only exists on the encrypted branch.
 */
export type DeckSavePlan =
	| { readonly serializer: 'save'; readonly encrypted: false }
	| { readonly serializer: 'saveEncrypted'; readonly encrypted: true; readonly password: string };

const PLAIN_PLAN: DeckSavePlan = { serializer: 'save', encrypted: false };

/**
 * Decide how the next save must be serialised.
 *
 * @param intent - The captured password, the optional protected flag, and the
 *   optional {@link DeckSavePurpose}. A bare string (or `null`/`undefined`) is
 *   accepted for the common case where a binding only tracks the secret.
 * @returns The serialiser to call and, when encrypting, the password to use.
 *
 * @example
 * ```ts
 * planDeckSave({ password: 'hunter2' });
 * // => { serializer: 'saveEncrypted', encrypted: true, password: 'hunter2' }
 * planDeckSave({ password: 'hunter2', passwordProtected: false });
 * // => { serializer: 'save', encrypted: false }
 * planDeckSave({ password: 'hunter2', purpose: 'recovery-snapshot' });
 * // => { serializer: 'save', encrypted: false }   (recovery has no password)
 * ```
 */
export function planDeckSave(intent: DeckSaveIntent | string | null | undefined): DeckSavePlan {
	const resolved: DeckSaveIntent =
		typeof intent === 'string' || intent === null || intent === undefined
			? { password: intent }
			: intent;
	// A snapshot the viewer reads back itself outranks the password: recovery
	// never gets to supply one, so encrypting it would just destroy it.
	if (resolved.purpose === 'recovery-snapshot') {
		return PLAIN_PLAN;
	}
	if (resolved.passwordProtected === false) {
		return PLAIN_PLAN;
	}
	const password = resolved.password;
	if (typeof password !== 'string' || password.length === 0) {
		return PLAIN_PLAN;
	}
	return { serializer: 'saveEncrypted', encrypted: true, password };
}

/**
 * The save intent for bytes the viewer will read back itself: the autosave
 * crash-recovery snapshot, and the internal re-serialise-then-reload cycle.
 *
 * Call sites use this instead of "just pass no password", so the plaintext is a
 * stated decision rather than a forgotten argument. Angular already produced a
 * plaintext snapshot only because `serializeForAutosave` happened to omit the
 * password parameter; one refactor away, that silently becomes the React bug.
 *
 * @param intent - The live protection state, forwarded so a call site can pass
 *   what it has without stripping fields by hand. Its `purpose` is overridden.
 *
 * @example
 * ```ts
 * await saveDeckWithPassword(handler, slides, options, recoverySnapshotIntent(password));
 * ```
 */
export function recoverySnapshotIntent(
	intent?: DeckSaveIntent | string | null,
): DeckSaveIntent & { purpose: 'recovery-snapshot' } {
	const resolved: DeckSaveIntent =
		typeof intent === 'string' || intent === null || intent === undefined
			? { password: intent }
			: intent;
	return { ...resolved, purpose: 'recovery-snapshot' };
}

/**
 * Serialise `slides` through the serialiser {@link planDeckSave} selects.
 *
 * This is the one call every binding's save / save-as / getContent path makes,
 * so "encrypted or not" cannot drift between bindings again.
 *
 * @param serializer - The loaded `PptxHandler` (or a `save`/`saveEncrypted` pair).
 * @param slides     - The slides to write, templates already merged back in.
 * @param options    - Core save options (output format, docProps, masters, ...).
 * @param intent     - The Protect-Presentation state, plus the optional
 *   {@link DeckSavePurpose}. Wrap it in {@link recoverySnapshotIntent} for an
 *   autosave snapshot or an internal reload, which must stay readable.
 * @returns The `.pptx` bytes: an OLE2 container when protected, a ZIP otherwise
 *   (and always a ZIP for a `recovery-snapshot`).
 */
export async function saveDeckWithPassword(
	serializer: DeckSaveSerializer,
	slides: PptxSlide[],
	options: DeckSaveOptions | undefined,
	intent: DeckSaveIntent | string | null | undefined,
): Promise<Uint8Array> {
	const plan = planDeckSave(intent);
	if (plan.serializer === 'saveEncrypted') {
		return serializer.saveEncrypted(slides, plan.password, options);
	}
	return serializer.save(slides, options);
}

/**
 * True when `bytes` are an encrypted OOXML package (an OLE2 compound file
 * holding `EncryptionInfo` + `EncryptedPackage`) rather than a plain ZIP.
 *
 * Exposed so a regression test can assert the BYTES, not merely that
 * `saveEncrypted` was called: a spy-only assertion would have passed for the
 * whole time this bug shipped.
 */
export function isEncryptedDeckBytes(bytes: Uint8Array | ArrayBuffer): boolean {
	const buffer =
		bytes instanceof Uint8Array
			? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
			: bytes;
	return detectFileFormat(buffer as ArrayBuffer).encrypted;
}
