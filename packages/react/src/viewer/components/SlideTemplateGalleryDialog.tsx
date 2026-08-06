/**
 * SlideTemplateGalleryDialog: the New Slide template gallery.
 *
 * Presents the shared slide-template catalogue as a grid of live-rendered
 * previews. Single click selects, double click or the Insert button inserts
 * the template after the current slide via the caller's history-integrated
 * insert path.
 */
import { SLIDE_TEMPLATES } from 'pptx-viewer-shared';
import type { SlideTemplateId } from 'pptx-viewer-shared';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';

import { useModalDismissDrag } from '../hooks';
import { useModalFocus } from '../hooks/useModalFocus';
import { cn } from '../utils';
import { SlideTemplatePreview } from './SlideTemplatePreview';

export interface SlideTemplateGalleryDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onInsert: (templateId: SlideTemplateId) => void;
	/** Optional deck scheme so previews show the deck's theme colours. */
	scheme?: Record<string, string>;
}

export function SlideTemplateGalleryDialog({
	isOpen,
	onClose,
	onInsert,
	scheme,
}: SlideTemplateGalleryDialogProps): React.ReactElement | null {
	const { t } = useTranslation();
	const { panelStyle, handlers: dragHandlers } = useModalDismissDrag(onClose);
	const [selected, setSelected] = useState<SlideTemplateId | null>(null);
	const dialogRef = useRef<HTMLDivElement>(null);
	useModalFocus(isOpen, dialogRef, onClose);

	const handleInsert = useCallback(() => {
		if (!selected) {
			return;
		}
		onInsert(selected);
		onClose();
	}, [selected, onInsert, onClose]);

	if (!isOpen) {
		return null;
	}

	return (
		<>
			<button
				type='button'
				style={{ zIndex: 1200 }}
				className='fixed inset-0 bg-black/50'
				onClick={onClose}
				aria-label={t('pptx.slideTemplates.close')}
			/>

			<div
				style={{ zIndex: 1201 }}
				className='fixed inset-0 flex items-center justify-center pointer-events-none'
			>
				<div
					ref={dialogRef}
					style={panelStyle}
					className='pointer-events-auto w-[640px] max-w-[92vw] max-h-[80vh] rounded-lg border border-border bg-background shadow-2xl flex flex-col max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:max-w-none max-md:max-h-[88dvh] max-md:rounded-t-2xl max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:pb-[max(env(safe-area-inset-bottom),0px)]'
					role='dialog'
					aria-modal='true'
					aria-label={t('pptx.slideTemplates.galleryTitle')}
					tabIndex={-1}
				>
					<div
						{...dragHandlers}
						className='flex items-center justify-between px-4 py-3 border-b border-border touch-none'
					>
						<div className='flex flex-col gap-0.5'>
							<h2 className='text-sm font-medium text-foreground'>
								{t('pptx.slideTemplates.galleryTitle')}
							</h2>
							<p className='text-[11px] text-muted-foreground'>
								{t('pptx.slideTemplates.galleryDescription')}
							</p>
						</div>
						<button
							type='button'
							onClick={onClose}
							className='p-1 rounded hover:bg-muted transition-colors'
							aria-label={t('pptx.slideTemplates.close')}
						>
							<LuX className='w-4 h-4' />
						</button>
					</div>

					<div className='flex-1 p-3 overflow-y-auto'>
						<div
							className='grid grid-cols-3 gap-2'
							role='listbox'
							aria-label={t('pptx.slideTemplates.gallery')}
						>
							{SLIDE_TEMPLATES.map((spec) => (
								<button
									key={spec.id}
									type='button'
									role='option'
									aria-selected={selected === spec.id}
									aria-label={t(spec.nameKey)}
									title={t(spec.descriptionKey)}
									onClick={() => setSelected(spec.id)}
									onDoubleClick={() => {
										onInsert(spec.id);
										onClose();
									}}
									className={cn(
										'flex flex-col items-center gap-1 p-2 rounded border transition-colors',
										selected === spec.id
											? 'border-primary bg-primary/20'
											: 'border-border hover:border-border hover:bg-muted/50',
									)}
								>
									<div className='flex items-center justify-center bg-muted rounded'>
										<SlideTemplatePreview templateId={spec.id} scheme={scheme} />
									</div>
									<span className='text-[10px] text-foreground text-center leading-tight'>
										{t(spec.nameKey)}
									</span>
								</button>
							))}
						</div>
					</div>

					<div className='flex items-center justify-end gap-2 px-4 py-3 border-t border-border'>
						<button
							type='button'
							onClick={onClose}
							className='px-3 py-1.5 text-xs rounded bg-muted hover:bg-accent text-foreground transition-colors'
						>
							{t('pptx.slideTemplates.cancel')}
						</button>
						<button
							type='button'
							onClick={handleInsert}
							disabled={!selected}
							className={cn(
								'px-3 py-1.5 text-xs rounded transition-colors',
								selected
									? 'bg-primary hover:bg-primary/80 text-white'
									: 'bg-muted text-muted-foreground cursor-not-allowed',
							)}
						>
							{t('pptx.slideTemplates.insert')}
						</button>
					</div>
				</div>
			</div>
		</>
	);
}
