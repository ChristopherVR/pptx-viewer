import type { PptxCustomProperty, PptxModifyVerifier } from 'pptx-viewer-core';
import type { ModifyPasswordCheckResult, ReadOnlyRecommendation } from 'pptx-viewer-shared';
import { checkModifyPassword, readOnlyRecommendation } from 'pptx-viewer-shared';

/** Why the last password attempt failed; see `checkModifyPassword` (`pptx-viewer-shared`). */
export type ModifyPasswordErrorReason = Extract<ModifyPasswordCheckResult, { ok: false }>['reason'];

/**
 * ReadOnlyRecommendationState: the Trust-Center-style banner shown when a
 * loaded deck asks to be opened read-only (`p:modifyVerifier`, or `docProps/
 * custom.xml`'s "Mark as Final"), and the lock that goes with it. Svelte port
 * of Vue's `useReadOnlyRecommendation` composable.
 *
 * `locked` is meant to be ANDed into the SAME `getEditable` gate the viewer
 * already reads (Protected View, collaboration read-only), not a second
 * editability mechanism. `reset()` is called from the load-commit hook
 * (`onContentApplied`) so a newly opened document is evaluated fresh even if
 * a previous one was unlocked.
 */
export class ReadOnlyRecommendationState {
	#dismissed = $state(false);
	#editAnywayGranted = $state(false);
	#passwordPromptOpen = $state(false);
	#passwordError = $state<ModifyPasswordErrorReason | null>(null);
	#checkingPassword = $state(false);
	#getModifyVerifier: () => PptxModifyVerifier | undefined;
	#getCustomProperties: () => PptxCustomProperty[];

	constructor(deps: {
		getModifyVerifier(): PptxModifyVerifier | undefined;
		getCustomProperties(): PptxCustomProperty[];
	}) {
		this.#getModifyVerifier = deps.getModifyVerifier;
		this.#getCustomProperties = deps.getCustomProperties;
	}

	/** The current recommendation (`kind: null` when the deck asks for nothing). */
	get recommendation(): ReadOnlyRecommendation {
		return readOnlyRecommendation({
			modifyVerifier: this.#getModifyVerifier(),
			customProperties: this.#getCustomProperties(),
		});
	}

	/** Whether the banner should render. */
	get showBanner(): boolean {
		return this.recommendation.kind !== null && !this.#dismissed;
	}

	/** Whether editing should currently be blocked because of this recommendation. */
	get locked(): boolean {
		const rec = this.recommendation;
		return rec.kind !== null && rec.defaultReadOnly && !this.#editAnywayGranted;
	}

	/** Whether the inline password prompt should render instead of the two buttons. */
	get passwordPromptOpen(): boolean {
		return this.#passwordPromptOpen;
	}

	/** Reason the last password attempt failed, or null before any attempt / after success. */
	get passwordError(): ModifyPasswordErrorReason | null {
		return this.#passwordError;
	}

	/** True while {@link submitPassword}'s check is in flight (disables the form). */
	get checkingPassword(): boolean {
		return this.#checkingPassword;
	}

	/**
	 * "Edit anyway": lifts the lock and hides the banner for this document, or
	 * (when `recommendation.requiresPassword` is set) opens the inline
	 * password prompt instead of unlocking immediately.
	 */
	editAnyway(): void {
		if (this.recommendation.requiresPassword) {
			this.#passwordPromptOpen = true;
			this.#passwordError = null;
			return;
		}
		this.#unlock();
	}

	/** "Dismiss": hides the banner but leaves the lock (if any) in place. */
	dismiss(): void {
		this.#dismissed = true;
	}

	/** Close the password prompt without unlocking. */
	cancelPasswordPrompt(): void {
		this.#passwordPromptOpen = false;
		this.#passwordError = null;
	}

	/** Check `password` against the deck's `modifyVerifier`; unlocks on a match. */
	async submitPassword(password: string): Promise<void> {
		this.#checkingPassword = true;
		try {
			const result = await checkModifyPassword(this.#getModifyVerifier(), password);
			if (result.ok) {
				this.#unlock();
			} else {
				this.#passwordError = result.reason;
			}
		} finally {
			this.#checkingPassword = false;
		}
	}

	#unlock(): void {
		this.#editAnywayGranted = true;
		this.#dismissed = true;
		this.#passwordPromptOpen = false;
		this.#passwordError = null;
	}

	/** Re-arm the recommendation for a newly loaded document. */
	reset(): void {
		this.#dismissed = false;
		this.#editAnywayGranted = false;
		this.#passwordPromptOpen = false;
		this.#passwordError = null;
		this.#checkingPassword = false;
	}
}
