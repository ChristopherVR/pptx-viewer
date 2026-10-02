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

import { DialogFooter } from './DialogFooter';

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
				<DialogFooter
					actions={[
						{ id: 'cancel', label: t('pptx.common.cancel') },
						{ id: 'ok', label: t('pptx.common.ok'), variant: 'primary' },
					]}
					onAction={(id) => (id === 'ok' ? onConfirm(selected) : onCancel())}
				/>
			</div>
		</div>
	);
}
