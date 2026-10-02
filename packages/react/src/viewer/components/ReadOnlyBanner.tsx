import type {
	PptxUiReadOnlyBannerElement,
	ReadOnlyBannerIntent,
	ReadOnlyRecommendation,
} from 'pptx-viewer-shared';
import { useTranslation } from 'react-i18next';

import { useWebControl } from '../hooks/useWebControl';

/** Why the last password attempt failed; see `checkModifyPassword` (`pptx-viewer-shared`). */
export type ModifyPasswordErrorReason = 'wrong-password' | 'unsupported-algorithm';

/**
 * ReadOnlyBanner: shown above the canvas (under the ribbon/toolbar) when a
 * loaded deck recommends opening read-only (`p:modifyVerifier` or "Mark as
 * Final", via the shared `readOnlyRecommendation`). "Edit anyway" lifts the
 * lock this banner represents; "Dismiss" only hides the banner, the deck
 * stays locked.
 *
 * When `recommendation.requiresPassword` is set, "Edit anyway" opens an
 * inline password prompt instead of unlocking immediately: PowerPoint's own
 * "read-only recommended" file keeps the deck locked until the correct
 * password is entered, and a wrong one leaves it locked.
 *
 * A thin adapter around the shared `pptx-ui-read-only-banner`: the markup, the
 * password form and its focus live in the element; this maps state and routes
 * its `read-only-request` intents to the callbacks.
 */
export interface ReadOnlyBannerProps {
	recommendation: ReadOnlyRecommendation;
	onEditAnyway: () => void;
	onDismiss: () => void;
	/** Whether the inline password prompt should render instead of the two buttons. */
	passwordPromptOpen?: boolean;
	/** Reason the last password attempt failed, or null/undefined otherwise. */
	passwordError?: ModifyPasswordErrorReason | null;
	/** True while a submitted password is being checked; disables the form. */
	checkingPassword?: boolean;
	onSubmitPassword?: (password: string) => void;
	onCancelPassword?: () => void;
}

export function ReadOnlyBanner(p: ReadOnlyBannerProps) {
	const { t } = useTranslation();
	const ref = useWebControl<PptxUiReadOnlyBannerElement>(
		{
			kind: p.recommendation.kind ?? null,
			messageKey: p.recommendation.messageKey,
			passwordPromptOpen: p.passwordPromptOpen ?? false,
			passwordError: p.passwordError ?? null,
			checkingPassword: p.checkingPassword ?? false,
			translate: t,
		},
		{
			'read-only-request': (event) => {
				const intent = event.detail as ReadOnlyBannerIntent;
				switch (intent.id) {
					case 'editAnyway':
						p.onEditAnyway();
						break;
					case 'dismiss':
						p.onDismiss();
						break;
					case 'cancelPassword':
						p.onCancelPassword?.();
						break;
					case 'submitPassword':
						p.onSubmitPassword?.(intent.password);
				}
			},
		},
	);
	return <pptx-ui-read-only-banner ref={ref} />;
}
