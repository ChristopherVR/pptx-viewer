/**
 * AutosaveRecoveryDialog: "we found unsaved changes for this deck, want them?"
 *
 * Pure presentation over the shared `AutosaveRecoveryPrompt` descriptor, so the
 * five bindings offer the same recovery with the same words. Every string is a
 * key chosen by `pptx-viewer-shared`; this component picks none of them.
 */
import type { AutosaveRecoveryPrompt } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuHistory, LuTrash2 } from 'react-icons/lu';

export interface AutosaveRecoveryDialogProps {
	/** The descriptor to render, or null to render nothing. */
	prompt: AutosaveRecoveryPrompt | null;
	onRestore: () => void;
	onDiscard: () => void;
}

export function AutosaveRecoveryDialog({
	prompt,
	onRestore,
	onDiscard,
}: AutosaveRecoveryDialogProps): React.ReactElement | null {
	const { t } = useTranslation();

	if (!prompt) {
		return null;
	}

	const title = t(prompt.titleKey);
	const when = t(prompt.ageKey, prompt.ageParams);

	return (
		<div
			style={{ zIndex: 1200 }}
			className='fixed inset-0 flex items-center justify-center bg-black/50'
			data-pptx-autosave-recovery='true'
		>
			<div
				role='dialog'
				aria-modal='true'
				aria-label={title}
				className='bg-background border border-border rounded-lg shadow-xl w-[440px] max-w-[90vw] p-6'
			>
				<div className='flex items-center gap-3 mb-3'>
					<div className='flex items-center justify-center w-10 h-10 rounded-full bg-primary/10'>
						<LuHistory className='w-5 h-5 text-primary' />
					</div>
					<h2 className='text-base font-semibold text-foreground'>{title}</h2>
				</div>
				<p className='text-sm text-muted-foreground'>
					{t(prompt.messageKey, prompt.messageParams)}
				</p>
				<p className='text-xs text-muted-foreground mt-2'>
					{t('pptx.autosave.recovery.savedLabel', { when })}
				</p>
				<div className='flex justify-end gap-2 mt-6'>
					<button
						type='button'
						className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-border bg-background text-foreground hover:bg-accent transition-colors'
						onClick={onDiscard}
					>
						<LuTrash2 className='w-4 h-4' />
						{t(prompt.discardKey)}
					</button>
					<button
						type='button'
						className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors'
						onClick={onRestore}
					>
						<LuHistory className='w-4 h-4' />
						{t(prompt.restoreKey)}
					</button>
				</div>
			</div>
		</div>
	);
}
