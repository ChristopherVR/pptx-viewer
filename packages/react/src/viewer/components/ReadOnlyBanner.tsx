import type { ReadOnlyRecommendation } from 'pptx-viewer-shared';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

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

export function ReadOnlyBanner({
	recommendation,
	onEditAnyway,
	onDismiss,
	passwordPromptOpen = false,
	passwordError = null,
	checkingPassword = false,
	onSubmitPassword,
	onCancelPassword,
}: ReadOnlyBannerProps) {
	const { t } = useTranslation();
	const [password, setPassword] = useState('');
	const inputId = useId();
	const errorId = useId();

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		onSubmitPassword?.(password);
	};

	return (
		<div
			data-testid='pptx-readonly-banner'
			data-kind={recommendation.kind ?? undefined}
			className='flex items-center gap-3 px-3 py-1.5 bg-amber-600/10 border-b border-amber-600/30 text-[12px] text-amber-900 dark:text-amber-200'
		>
			<span className='flex-1 min-w-0'>{t(recommendation.messageKey)}</span>
			{passwordPromptOpen ? (
				<form
					data-testid='pptx-readonly-password-form'
					onSubmit={handleSubmit}
					className='flex shrink-0 items-center gap-2'
				>
					<label htmlFor={inputId} className='sr-only'>
						{t('pptx.readOnly.passwordLabel')}
					</label>
					<input
						id={inputId}
						data-testid='pptx-readonly-password-input'
						type='password'
						autoFocus
						value={password}
						disabled={checkingPassword}
						onChange={(event) => setPassword(event.target.value)}
						placeholder={t('pptx.readOnly.passwordPlaceholder')}
						aria-invalid={passwordError !== null}
						aria-describedby={passwordError !== null ? errorId : undefined}
						className='rounded-sm border border-amber-600/40 bg-white/80 px-1.5 py-0.5 text-[11px] text-amber-950 dark:bg-black/20 dark:text-amber-100'
					/>
					<button
						type='submit'
						data-testid='pptx-readonly-unlock'
						disabled={checkingPassword}
						className='shrink-0 rounded-sm bg-amber-600/90 px-2 py-0.5 text-[11px] text-amber-50 transition-colors hover:bg-amber-600 disabled:opacity-60'
					>
						{t('pptx.readOnly.unlock')}
					</button>
					<button
						type='button'
						data-testid='pptx-readonly-password-cancel'
						onClick={onCancelPassword}
						className='shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] text-amber-900/80 transition-colors hover:bg-amber-600/20 dark:text-amber-200/80'
					>
						{t('pptx.common.cancel')}
					</button>
					{passwordError !== null && (
						<span
							id={errorId}
							role='alert'
							data-testid='pptx-readonly-password-error'
							className='shrink-0 text-[11px] text-red-700 dark:text-red-300'
						>
							{t(
								passwordError === 'wrong-password'
									? 'pptx.readOnly.wrongPassword'
									: 'pptx.readOnly.unsupportedAlgorithm',
							)}
						</span>
					)}
				</form>
			) : (
				<>
					<button
						type='button'
						data-testid='pptx-readonly-edit-anyway'
						onClick={onEditAnyway}
						className='shrink-0 rounded-sm bg-amber-600/90 px-2 py-0.5 text-[11px] text-amber-50 transition-colors hover:bg-amber-600'
					>
						{t('pptx.readOnly.editAnyway')}
					</button>
					<button
						type='button'
						data-testid='pptx-readonly-dismiss'
						onClick={onDismiss}
						aria-label={t('pptx.readOnly.dismiss')}
						className='shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] text-amber-900/80 transition-colors hover:bg-amber-600/20 dark:text-amber-200/80'
					>
						{t('pptx.readOnly.dismiss')}
					</button>
				</>
			)}
		</div>
	);
}
