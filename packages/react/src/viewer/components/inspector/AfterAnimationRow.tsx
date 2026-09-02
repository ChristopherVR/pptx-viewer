import type { PptxAfterAnimationAction } from 'pptx-viewer-core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { AFTER_ANIMATION_OPTIONS, SELECT_CLS } from './animation-panel-constants';
import { useRecentColors } from './RecentColorsContext';

export interface AfterAnimationRowProps {
	action: PptxAfterAnimationAction;
	color: string | undefined;
	canEdit: boolean;
	onActionChange: (action: PptxAfterAnimationAction) => void;
	onColorChange: (color: string) => void;
}

/**
 * The animation panel's "after animation" row: dim to colour, hide after
 * animation, hide on next click, or don't dim. Mirrors PowerPoint's Effect
 * Options "After animation" dropdown; the colour swatch only appears for
 * "Dim after animation".
 */
export function AfterAnimationRow({
	action,
	color,
	canEdit,
	onActionChange,
	onColorChange,
}: AfterAnimationRowProps): React.ReactElement {
	const { t } = useTranslation();
	const { pushColor } = useRecentColors();

	return (
		<div className='flex flex-col gap-1'>
			<label className='flex flex-col gap-1'>
				<span className='text-muted-foreground text-[11px]'>
					{t('pptx.animation.afterAnimation')}
				</span>
				<select
					aria-label={t('pptx.animation.afterAnimation')}
					value={action}
					onChange={(event) => onActionChange(event.target.value as PptxAfterAnimationAction)}
					disabled={!canEdit}
					className={SELECT_CLS}
				>
					{AFTER_ANIMATION_OPTIONS.map((option) => (
						<option key={option.value} value={option.value}>
							{t(option.labelKey)}
						</option>
					))}
				</select>
			</label>
			{action === 'dimToColor' && (
				<label className='flex items-center gap-2'>
					<span className='text-muted-foreground text-[11px]'>
						{t('pptx.animation.afterAnimation.color')}
					</span>
					<input
						type='color'
						aria-label={t('pptx.animation.afterAnimation.color')}
						value={color ?? '#808080'}
						onChange={(event) => {
							onColorChange(event.target.value);
							pushColor(event.target.value);
						}}
						disabled={!canEdit}
						className='h-6 w-10 rounded border border-border bg-transparent p-0'
					/>
				</label>
			)}
		</div>
	);
}
