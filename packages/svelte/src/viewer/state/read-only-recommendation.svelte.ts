import type { PptxCustomProperty, PptxModifyVerifier } from 'pptx-viewer-core';
import type { ReadOnlyRecommendation } from 'pptx-viewer-shared';
import { readOnlyRecommendation } from 'pptx-viewer-shared';

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

	/** "Edit anyway": lifts the lock and hides the banner for this document. */
	editAnyway(): void {
		this.#editAnywayGranted = true;
		this.#dismissed = true;
	}

	/** "Dismiss": hides the banner but leaves the lock (if any) in place. */
	dismiss(): void {
		this.#dismissed = true;
	}

	/** Re-arm the recommendation for a newly loaded document. */
	reset(): void {
		this.#dismissed = false;
		this.#editAnywayGranted = false;
	}
}
