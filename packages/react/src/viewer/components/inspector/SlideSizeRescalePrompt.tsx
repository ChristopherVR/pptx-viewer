import type { SlideSizeRescaleMode } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * SlideSizeRescalePrompt: PowerPoint's Maximize/Ensure Fit choice, shown by
 * `SlideSizeCard` when a picked preset/orientation size differs from the
 * current one and the deck has content to rescale. Confirming either applies
 * the shared `scaleSlidesForSizeChange` transform (via the caller) together
 * with the size change.
 */
export interface SlideSizeRescalePromptProps {
	onChoose: (mode: SlideSizeRescaleMode) => void;
}

export function SlideSizeRescalePrompt({
	onChoose,
}: SlideSizeRescalePromptProps): React.ReactElement {
	const { t } = useTranslation();

	return (
		<div className='space-y-1.5 rounded border border-border bg-muted/40 p-2 text-[11px]'>
			<div className='font-medium'>{t('pptx.slideSize.rescaleTitle')}</div>
			<div className='text-muted-foreground'>{t('pptx.slideSize.rescaleDescription')}</div>
			<div className='grid grid-cols-2 gap-1.5 pt-1'>
				<button
					type='button'
					data-testid='pptx-slide-size-rescale-maximize'
					title={t('pptx.slideSize.rescaleMaximizeHint')}
					className='rounded bg-primary px-2 py-1 text-primary-foreground transition-colors hover:opacity-90'
					onClick={() => onChoose('maximize')}
				>
					{t('pptx.slideSize.rescaleMaximize')}
				</button>
				<button
					type='button'
					data-testid='pptx-slide-size-rescale-ensure-fit'
					title={t('pptx.slideSize.rescaleEnsureFitHint')}
					className='rounded bg-muted px-2 py-1 transition-colors hover:bg-accent'
					onClick={() => onChoose('ensureFit')}
				>
					{t('pptx.slideSize.rescaleEnsureFit')}
				</button>
			</div>
		</div>
	);
}
