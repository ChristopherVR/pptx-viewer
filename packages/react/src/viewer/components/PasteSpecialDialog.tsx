/**
 * PasteSpecialDialog: Ctrl/Cmd+Alt+V. Offers the four Paste Special formats
 * PowerPoint's own dialog offers (Keep Source Formatting, Use Destination
 * Theme, Picture, Keep Text Only), sourced from `pptx-viewer-shared` so the
 * option set and its labels cannot drift from the post-paste "Paste Options"
 * toolbar or the other four bindings.
 */
import type { PasteSpecialFormat } from 'pptx-viewer-shared';
import { PASTE_SPECIAL_OPTIONS } from 'pptx-viewer-shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface PasteSpecialDialogProps {
	isOpen: boolean;
	onCancel: () => void;
	onConfirm: (format: PasteSpecialFormat) => void;
}

export function PasteSpecialDialog({
	isOpen,
	onCancel,
	onConfirm,
}: PasteSpecialDialogProps): React.ReactElement | null {
	const { t } = useTranslation();
	const [selected, setSelected] = useState<PasteSpecialFormat>('keep-source-formatting');

	if (!isOpen) {
		return null;
	}

	return (
		<div
			style={{ zIndex: 1200 }}
			className='fixed inset-0 flex items-center justify-center bg-black/50'
			role='presentation'
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) {
					onCancel();
				}
			}}
		>
			<div
				role='dialog'
				aria-modal='true'
				aria-label={t('pptx.pasteSpecial.dialogTitle')}
				className='bg-background border border-border rounded-lg shadow-xl w-[360px] max-w-[90vw] p-5'
			>
				<h2 className='text-base font-semibold text-foreground mb-3'>
					{t('pptx.pasteSpecial.dialogTitle')}
				</h2>
				<ul className='flex flex-col gap-1 mb-5'>
					{PASTE_SPECIAL_OPTIONS.map((option) => (
						<li key={option.id}>
							<label className='flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent text-sm text-foreground'>
								<input
									type='radio'
									name='paste-special-format'
									value={option.id}
									checked={selected === option.id}
									onChange={() => setSelected(option.id)}
								/>
								{t(option.labelKey)}
							</label>
						</li>
					))}
				</ul>
				<div className='flex justify-end gap-2'>
					<button
						type='button'
						className='px-4 py-2 text-sm font-medium rounded-md border border-border bg-background text-foreground hover:bg-accent transition-colors'
						onClick={onCancel}
					>
						{t('pptx.common.cancel')}
					</button>
					<button
						type='button'
						className='px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors'
						onClick={() => onConfirm(selected)}
					>
						{t('pptx.common.ok')}
					</button>
				</div>
			</div>
		</div>
	);
}
