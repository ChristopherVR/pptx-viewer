import type { ReadOnlyRecommendation } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createIcon } from './icons';

/** Why the last password attempt failed; see `checkModifyPassword` (`pptx-viewer-shared`). */
export type ModifyPasswordErrorReason = 'wrong-password' | 'unsupported-algorithm';

/**
 * The `p:modifyVerifier` / "Mark as Final" read-only recommendation banner:
 * a strip below the ribbon telling the user WHY the deck opened locked and
 * offering "Edit anyway" (lifts the lock, hides the banner) or a plain close
 * (hides the banner, keeps the lock). See `readOnlyRecommendation` in
 * `pptx-viewer-shared` and `ViewerState.readOnlyRecommendation`.
 *
 * When the recommendation's `requiresPassword` is set (a `modifyVerifier`
 * with a hash this viewer can check), "Edit anyway" is replaced by an inline
 * password form instead: PowerPoint's own "read-only recommended" prompt
 * keeps the deck locked until the correct password is entered, and a wrong
 * one leaves it locked.
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
	const el = createEl(doc, 'div', 'pptxv-readonly-banner');
	el.dataset.testid = 'pptx-readonly-banner';
	el.hidden = true;
	el.setAttribute('role', 'alert');
	el.appendChild(createIcon(doc, 'lock'));
	const text = createEl(doc, 'span', 'pptxv-readonly-banner-text');

	const editAnyway = createEl(doc, 'button', 'pptxv-readonly-banner-edit');
	editAnyway.type = 'button';
	editAnyway.dataset.testid = 'pptx-readonly-edit-anyway';
	editAnyway.textContent = t('pptx.readOnly.editAnyway');
	editAnyway.addEventListener('click', onEditAnyway);
	const dismiss = createEl(doc, 'button', 'pptxv-readonly-banner-dismiss');
	dismiss.type = 'button';
	dismiss.dataset.testid = 'pptx-readonly-dismiss';
	dismiss.setAttribute('aria-label', t('pptx.readOnly.dismiss'));
	dismiss.appendChild(createIcon(doc, 'close'));
	dismiss.addEventListener('click', onDismiss);

	const passwordForm = createEl(doc, 'form', 'pptxv-readonly-banner-password-form');
	passwordForm.dataset.testid = 'pptx-readonly-password-form';
	passwordForm.hidden = true;
	const passwordLabel = createEl(doc, 'label', 'pptxv-sr-only');
	passwordLabel.textContent = t('pptx.readOnly.passwordLabel');
	passwordLabel.setAttribute('for', 'pptxv-readonly-password-input');
	const passwordInput = createEl(doc, 'input', 'pptxv-readonly-banner-password-input');
	passwordInput.id = 'pptxv-readonly-password-input';
	passwordInput.type = 'password';
	passwordInput.dataset.testid = 'pptx-readonly-password-input';
	passwordInput.placeholder = t('pptx.readOnly.passwordPlaceholder');
	const unlockButton = createEl(doc, 'button', 'pptxv-readonly-banner-unlock');
	unlockButton.type = 'submit';
	unlockButton.dataset.testid = 'pptx-readonly-unlock';
	unlockButton.textContent = t('pptx.readOnly.unlock');
	const cancelButton = createEl(doc, 'button', 'pptxv-readonly-banner-password-cancel');
	cancelButton.type = 'button';
	cancelButton.dataset.testid = 'pptx-readonly-password-cancel';
	cancelButton.textContent = t('pptx.common.cancel');
	cancelButton.addEventListener('click', onCancelPassword);
	const passwordError = createEl(doc, 'span', 'pptxv-readonly-banner-password-error');
	passwordError.dataset.testid = 'pptx-readonly-password-error';
	passwordError.setAttribute('role', 'alert');
	passwordError.id = 'pptxv-readonly-password-error';
	passwordError.hidden = true;
	passwordForm.addEventListener('submit', (event) => {
		event.preventDefault();
		onSubmitPassword(passwordInput.value);
	});
	passwordForm.append(passwordLabel, passwordInput, unlockButton, cancelButton, passwordError);

	el.append(text, editAnyway, dismiss, passwordForm);

	return {
		el,
		update(recommendation, dismissed, passwordState) {
			const visible = recommendation !== null && !dismissed;
			el.hidden = !visible;
			if (!visible || !recommendation) {
				return;
			}
			el.dataset.kind = recommendation.kind ?? '';
			text.textContent = t(recommendation.messageKey);

			const promptOpen = passwordState.promptOpen;
			editAnyway.hidden = promptOpen;
			dismiss.hidden = promptOpen;
			passwordForm.hidden = !promptOpen;
			if (!promptOpen) {
				return;
			}
			passwordInput.disabled = passwordState.checking;
			unlockButton.disabled = passwordState.checking;
			const hasError = passwordState.error !== null;
			passwordInput.setAttribute('aria-invalid', String(hasError));
			passwordInput.setAttribute('aria-describedby', hasError ? passwordError.id : '');
			if (!hasError) {
				passwordInput.removeAttribute('aria-describedby');
			}
			passwordError.hidden = !hasError;
			if (hasError) {
				passwordError.textContent = t(
					passwordState.error === 'wrong-password'
						? 'pptx.readOnly.wrongPassword'
						: 'pptx.readOnly.unsupportedAlgorithm',
				);
			}
		},
	};
}
