import type { ReadOnlyRecommendation } from 'pptx-viewer-shared';
import { useTranslation } from 'react-i18next';

/**
 * ReadOnlyBanner: shown above the canvas (under the ribbon/toolbar) when a
 * loaded deck recommends opening read-only (`p:modifyVerifier` or "Mark as
 * Final", via the shared `readOnlyRecommendation`). "Edit anyway" lifts the
 * lock this banner represents; "Dismiss" only hides the banner, the deck
 * stays locked.
 */
export interface ReadOnlyBannerProps {
	recommendation: ReadOnlyRecommendation;
	onEditAnyway: () => void;
	onDismiss: () => void;
}

export function ReadOnlyBanner({ recommendation, onEditAnyway, onDismiss }: ReadOnlyBannerProps) {
	const { t } = useTranslation();

	return (
		<div
			data-testid='pptx-readonly-banner'
			data-kind={recommendation.kind ?? undefined}
			className='flex items-center gap-3 px-3 py-1.5 bg-amber-600/10 border-b border-amber-600/30 text-[12px] text-amber-900 dark:text-amber-200'
		>
			<span className='flex-1 min-w-0'>{t(recommendation.messageKey)}</span>
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
		</div>
	);
}
