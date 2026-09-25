import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { listMediaBookmarkOptions, selectedBookmarkOptionValue } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { WebSelect } from '../WebControls';
import { SELECT_CLS } from './animation-panel-constants';

export interface BookmarkTriggerRowProps {
	/** The slide's elements, searched for media bookmarks. */
	elements: readonly PptxElement[];
	/** The selected element's animation entry. */
	animation: PptxElementAnimation | undefined;
	canEdit: boolean;
	style?: React.CSSProperties;
	/** Receives the chosen option value (see `setTriggerBookmark`). */
	onChange: (optionValue: string) => void;
}

/**
 * The "On bookmark" trigger's bookmark picker: every (media element, bookmark)
 * pair on the slide, from shared's `listMediaBookmarkOptions`.
 */
export function BookmarkTriggerRow({
	elements,
	animation,
	canEdit,
	style,
	onChange,
}: BookmarkTriggerRowProps): React.ReactElement {
	const { t } = useTranslation();
	const options = listMediaBookmarkOptions(elements);
	return (
		<label className='flex flex-col gap-1'>
			<span className='text-muted-foreground text-[11px]'>
				{t('pptx.animation.trigger.bookmarkLabel')}
			</span>
			<WebSelect
				aria-label={t('pptx.animation.trigger.bookmarkLabel')}
				data-pptx-animation-bookmark-picker
				value={selectedBookmarkOptionValue(animation)}
				onChange={(event) => onChange(event.target.value)}
				disabled={!canEdit || options.length === 0}
				className={SELECT_CLS}
				style={style}
			>
				<option value=''>
					{t(
						options.length === 0
							? 'pptx.animation.trigger.noBookmarks'
							: 'pptx.animation.trigger.selectBookmark',
					)}
				</option>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</WebSelect>
		</label>
	);
}
