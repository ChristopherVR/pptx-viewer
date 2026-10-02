import { registerPptxWebControls } from 'pptx-viewer-shared';
import type {
	PptxUiReadOnlyBannerElement,
	ReadOnlyBannerRequestEvent,
	ReadOnlyRecommendation,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';

/** Why the last password attempt failed; see `checkModifyPassword` (`pptx-viewer-shared`). */
export type ModifyPasswordErrorReason = 'wrong-password' | 'unsupported-algorithm';

/**
 * The `p:modifyVerifier` / "Mark as Final" read-only recommendation banner:
 * a strip below the ribbon telling the user WHY the deck opened locked and
 * offering "Edit anyway" (lifts the lock, hides the banner) or a plain close
 * (hides the banner, keeps the lock). See `readOnlyRecommendation` in
 * `pptx-viewer-shared` and `ViewerState.readOnlyRecommendation`.
 *
 * A thin adapter over the shared `pptx-ui-read-only-banner`, which owns the
 * markup and the inline password form. When the recommendation's
 * `requiresPassword` is set (a `modifyVerifier` with a hash this viewer can
 * check), "Edit anyway" is replaced by that form instead: PowerPoint's own
 * "read-only recommended" prompt keeps the deck locked until the correct
 * password is entered, and a wrong one leaves it locked.
 */
export interface ReadOnlyBanner {
	el: HTMLElement;
	update(
		recommendation: ReadOnlyRecommendation | null,
		dismissed: boolean,
		passwordState: {
			promptOpen: boolean;
			error: ModifyPasswordErrorReason | null;
			checking: boolean;
		},
	): void;
}

export function createReadOnlyBanner(
	doc: Document,
	t: Translator,
	onEditAnyway: () => void,
	onDismiss: () => void,
	onSubmitPassword: (password: string) => void,
	onCancelPassword: () => void,
): ReadOnlyBanner {
	registerPptxWebControls();
	const el = doc.createElement('pptx-ui-read-only-banner') as PptxUiReadOnlyBannerElement;
	el.hidden = true;
	el.addEventListener('read-only-request', (event) => {
		const intent = (event as ReadOnlyBannerRequestEvent).detail;
		switch (intent.id) {
			case 'editAnyway':
				onEditAnyway();
				break;
			case 'dismiss':
				onDismiss();
				break;
			case 'cancelPassword':
				onCancelPassword();
				break;
			case 'submitPassword':
				onSubmitPassword(intent.password);
		}
	});
	return {
		el,
		update(recommendation, dismissed, passwordState) {
			const visible = recommendation !== null && !dismissed;
			el.hidden = !visible;
			if (!visible || !recommendation) {
				return;
			}
			el.state = {
				kind: recommendation.kind ?? null,
				messageKey: recommendation.messageKey,
				passwordPromptOpen: passwordState.promptOpen,
				passwordError: passwordState.error,
				checkingPassword: passwordState.checking,
				translate: t,
			};
		},
	};
}
