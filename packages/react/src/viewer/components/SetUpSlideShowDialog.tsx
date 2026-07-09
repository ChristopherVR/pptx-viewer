import type { PptxPresentationProperties, PptxCustomShow } from 'pptx-viewer-core';
/**
 * SetUpSlideShowDialog
 *
 * Modal dialog for configuring slide show settings (show type, slides range,
 * advance mode, loop, narration, animation, subtitles).
 */
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { ShowOptionsFieldset } from './ShowOptionsFieldset';
import { ShowSlidesFieldset } from './ShowSlidesFieldset';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SetUpSlideShowDialogProps {
	open: boolean;
	onClose: () => void;
	properties: PptxPresentationProperties;
	onSave: (properties: PptxPresentationProperties) => void;
	customShows: PptxCustomShow[];
	slideCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SetUpSlideShowDialog({
	open,
	onClose,
	properties,
	onSave,
	customShows,
	slideCount,
}: SetUpSlideShowDialogProps): React.ReactElement | null {
	const { t } = useTranslation();

	const [draft, setDraft] = useState<PptxPresentationProperties>({
		...properties,
	});

	const update = useCallback((patch: Partial<PptxPresentationProperties>) => {
		setDraft((prev) => ({ ...prev, ...patch }));
	}, []);

	const handleSave = useCallback(() => {
		onSave(draft);
		onClose();
	}, [draft, onSave, onClose]);

	if (!open) {
		return null;
	}

	const showType = draft.showType ?? 'presented';
	const showSlidesMode = draft.showSlidesMode ?? 'all';

	return (
		<>
			{/* Backdrop */}
			<button
				type='button'
				style={{ zIndex: 1200 }}
				className='fixed inset-0 bg-black/50'
				aria-label={t('pptx.share.closeDialog')}
				onClick={onClose}
			/>

			{/* Dialog */}
			<div
				style={{ zIndex: 1201 }}
				className='fixed inset-0 flex items-center justify-center pointer-events-none'
			>
				<div className='pointer-events-auto flex flex-col w-[440px] max-h-[90vh] rounded-xl border border-border bg-background shadow-2xl max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:max-h-[88dvh] max-md:rounded-t-2xl max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:pb-[max(env(safe-area-inset-bottom),0px)]'>
					{/* Header */}
					<div className='flex items-center justify-between px-5 py-3 border-b border-border shrink-0'>
						<h2 className='text-sm font-semibold text-foreground'>
							{t('pptx.slideShow.setUpTitle')}
						</h2>
						<button
							type='button'
							onClick={onClose}
							className='text-muted-foreground hover:text-foreground text-lg leading-none'
							aria-label={t('pptx.common.close')}
						>
							&times;
						</button>
					</div>

					{/* Body */}
					<div className='flex-1 px-5 py-4 space-y-5 text-[12px] text-foreground overflow-y-auto'>
						{/* Show Type */}
						<fieldset className='space-y-1.5'>
							<legend className='text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1'>
								{t('pptx.slideShow.showType')}
							</legend>
							{(
								[
									['presented', t('pptx.slideShow.presentedBySpeaker')],
									['browsed', t('pptx.slideShow.browsedByIndividual')],
									['kiosk', t('pptx.slideShow.browsedAtKiosk')],
								] as const
							).map(([value, label]) => (
								<label key={value} className='flex items-center gap-2 cursor-pointer'>
									<input
										type='radio'
										name='showType'
										value={value}
										checked={showType === value}
										onChange={() =>
											update({
												showType: value,
												...(value === 'kiosk' ? { loopContinuously: true } : {}),
											})
										}
										className='accent-primary'
									/>
									<span>{label}</span>
								</label>
							))}
						</fieldset>

						<ShowSlidesFieldset
							draft={draft}
							update={update}
							showSlidesMode={showSlidesMode}
							slideCount={slideCount}
							customShows={customShows}
						/>

						{/* Advance Slides */}
						<fieldset className='space-y-1.5'>
							<legend className='text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1'>
								{t('pptx.slideShow.advanceSlides')}
							</legend>
							<label className='flex items-center gap-2 cursor-pointer'>
								<input
									type='radio'
									name='advanceMode'
									value='manual'
									checked={(draft.advanceMode ?? 'manual') === 'manual'}
									onChange={() => update({ advanceMode: 'manual' })}
									className='accent-primary'
								/>
								<span>{t('pptx.slideShow.manually')}</span>
							</label>
							<label className='flex items-center gap-2 cursor-pointer'>
								<input
									type='radio'
									name='advanceMode'
									value='useTimings'
									checked={draft.advanceMode === 'useTimings'}
									onChange={() => update({ advanceMode: 'useTimings' })}
									className='accent-primary'
								/>
								<span>{t('pptx.slideShow.useTimings')}</span>
							</label>
						</fieldset>

						<ShowOptionsFieldset draft={draft} update={update} />
					</div>

					{/* Footer */}
					<div className='flex justify-end gap-2 px-5 py-3 border-t border-border shrink-0'>
						<button
							type='button'
							onClick={onClose}
							className='px-3 py-1.5 rounded bg-muted hover:bg-accent text-[12px] text-foreground transition-colors'
						>
							{t('common.cancel')}
						</button>
						<button
							type='button'
							onClick={handleSave}
							className='px-3 py-1.5 rounded bg-primary hover:bg-primary/80 text-[12px] text-white transition-colors'
						>
							{t('common.ok')}
						</button>
					</div>
				</div>
			</div>
		</>
	);
}
