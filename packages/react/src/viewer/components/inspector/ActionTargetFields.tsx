/**
 * ActionTargetFields: the extra input(s) an Action Settings trigger shows
 * once its type needs a target - a URL (`url`, `openFile`, `openPresentation`
 * all reuse this field, per `actionTypeNeedsTarget`/the OOXML `PptxAction.url`
 * shape), a slide number, or a custom show + "resume after" checkbox.
 *
 * Split out of `ActionSettingsPanel` purely for file size.
 */
import type { ElementActionType } from 'pptx-viewer-core';
import { toSlideIndex } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../utils';
import type { ActionTargetPatch } from './ActionSettingsPanel';
import { INPUT } from './inspector-pane-constants';

export interface ActionTargetFieldsProps {
	type: ElementActionType;
	canEdit: boolean;
	slideCount: number;
	customShows: Array<{ id: string; name: string }>;
	url: string | undefined;
	slideIndex: number | undefined;
	customShowId: string | undefined;
	returnAfter: boolean | undefined;
	onChange: (patch: ActionTargetPatch) => void;
}

const URL_LABEL_KEY: Partial<Record<ElementActionType, string>> = {
	url: 'pptx.action.gotoUrl',
	openFile: 'pptx.hyperlink.actionOpenFile',
	openPresentation: 'pptx.hyperlink.actionOpenPresentation',
};

export function ActionTargetFields({
	type,
	canEdit,
	slideCount,
	customShows,
	url,
	slideIndex,
	customShowId,
	returnAfter,
	onChange,
}: ActionTargetFieldsProps): React.ReactElement | null {
	const { t } = useTranslation();

	const urlLabelKey = URL_LABEL_KEY[type];
	if (urlLabelKey) {
		return (
			<input
				type='text'
				disabled={!canEdit}
				aria-label={t(urlLabelKey)}
				className={cn(INPUT, 'w-full')}
				placeholder='https://...'
				value={url ?? ''}
				onChange={(e) => onChange({ url: e.target.value })}
			/>
		);
	}

	if (type === 'slide') {
		return (
			<input
				type='number'
				disabled={!canEdit}
				aria-label={t('pptx.action.gotoSlide')}
				className={cn(INPUT, 'w-full')}
				placeholder={t('pptx.action.slideNumberPlaceholder')}
				min={1}
				max={slideCount}
				value={(slideIndex ?? 0) + 1}
				onChange={(e) => {
					const idx = toSlideIndex(Number(e.target.value), slideCount);
					if (idx !== undefined) {
						onChange({ slideIndex: idx });
					}
				}}
			/>
		);
	}

	if (type === 'customShow') {
		return (
			<div className='space-y-1'>
				<select
					data-testid='pptx-action-custom-show'
					disabled={!canEdit}
					aria-label={t('pptx.hyperlink.customShowLabel')}
					className={cn(INPUT, 'w-full')}
					value={customShowId ?? ''}
					onChange={(e) => onChange({ customShowId: e.target.value, returnAfter })}
				>
					<option value=''>{t('pptx.hyperlink.customShowLabel')}</option>
					{customShows.map((show) => (
						<option key={show.id} value={show.id}>
							{show.name}
						</option>
					))}
				</select>
				<label className='flex items-center gap-1.5 text-muted-foreground'>
					<input
						type='checkbox'
						data-testid='pptx-action-custom-show-return'
						disabled={!canEdit}
						checked={returnAfter ?? false}
						onChange={(e) => onChange({ customShowId, returnAfter: e.target.checked })}
					/>
					{t('pptx.hyperlink.customShowReturn')}
				</label>
			</div>
		);
	}

	return null;
}
