/**
 * AiAppliedThemeCard: inline confirmation for a theme edit that was applied
 * immediately (theme edits are not staged). Shows an "Applied: <summary>" badge
 * with an Undo control that restores the captured previous values.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuPalette, LuUndo2 } from 'react-icons/lu';

export interface AiAppliedThemeCardProps {
	summary: string;
	onUndo: () => void;
}

export function AiAppliedThemeCard({ summary, onUndo }: AiAppliedThemeCardProps) {
	const { t } = useTranslation();
	const [undone, setUndone] = useState(false);

	return (
		<div className='flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-[12px]'>
			<LuPalette className='w-3.5 h-3.5 shrink-0 text-primary' />
			<span className='min-w-0 flex-1 break-words text-foreground'>
				<span className='font-medium text-primary'>{t('pptx.ai.applied')}:</span> {summary}
			</span>
			{!undone && (
				<button
					type='button'
					onClick={() => {
						onUndo();
						setUndone(true);
					}}
					className='inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground'
				>
					<LuUndo2 className='w-3 h-3' />
					{t('pptx.ai.undo')}
				</button>
			)}
		</div>
	);
}
