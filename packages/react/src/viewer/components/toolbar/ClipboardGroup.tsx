import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuClipboardPaste, LuCopy, LuPaintbrush, LuScissors } from 'react-icons/lu';

import { cn } from '../../utils';
import { controlAttr, groupAttr } from './PowerPointRibbonControls';
import { gB, gL, grp, ic } from './toolbar-constants';

export interface ClipboardGroupProps {
	canEdit: boolean;
	/** Cut and Copy act on the selection, so they need one. */
	hasSelection: boolean;
	canPaste: boolean;
	formatPainterActive?: boolean;
	canActivateFormatPainter?: boolean;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onToggleFormatPainter?: () => void;
}

/** Home > Clipboard: Paste, Cut, Copy and Format Painter. */
export function ClipboardGroup(p: ClipboardGroupProps): React.ReactElement {
	const { t } = useTranslation();
	const [copiedFeedback, setCopiedFeedback] = useState(false);
	const [cutFeedback, setCutFeedback] = useState(false);
	return (
		<div className='flex flex-col items-center gap-0.5' {...groupAttr('home.clipboard')}>
			<div className={grp}>
				<button
					type='button'
					onClick={p.onPaste}
					disabled={!p.canPaste || !p.canEdit}
					className={gB}
					title={t('pptx.arrange.paste')}
					{...controlAttr('home.clipboard.paste')}
				>
					<LuClipboardPaste className={ic} />
				</button>
				<button
					type='button'
					onClick={() => {
						p.onCut();
						setCutFeedback(true);
						setTimeout(() => setCutFeedback(false), 600);
					}}
					disabled={!p.canEdit || !p.hasSelection}
					className={cn(gB, cutFeedback && 'bg-green-600/20 text-green-400')}
					title={t('pptx.arrange.cut')}
					{...controlAttr('home.clipboard.cut')}
				>
					<LuScissors className={ic} />
				</button>
				<button
					type='button'
					onClick={() => {
						p.onCopy();
						setCopiedFeedback(true);
						setTimeout(() => setCopiedFeedback(false), 600);
					}}
					disabled={!p.hasSelection}
					className={cn(gB, copiedFeedback && 'bg-green-600/20 text-green-400')}
					title={t('pptx.arrange.copy')}
					{...controlAttr('home.clipboard.copy')}
				>
					<LuCopy className={ic} />
				</button>
				{p.onToggleFormatPainter && (
					<button
						type='button'
						onClick={p.onToggleFormatPainter}
						disabled={
							!p.canEdit || (p.canActivateFormatPainter === false && !p.formatPainterActive)
						}
						data-testid='format-painter-toggle'
						data-active={p.formatPainterActive ? 'true' : 'false'}
						className={cn(
							gL,
							p.formatPainterActive ? 'bg-amber-600 hover:bg-amber-500 text-amber-50' : '',
						)}
						title={t('pptx.arrange.formatPainter')}
						{...controlAttr('home.clipboard.formatPainter')}
					>
						<LuPaintbrush className={ic} />
					</button>
				)}
			</div>
			<span className='text-[9px] text-muted-foreground leading-none'>
				{t('pptx.ribbon.clipboard')}
			</span>
		</div>
	);
}
