import type { PptxTagCollection } from 'pptx-viewer-core';
import {
	addTagToCollections,
	deleteTagFromCollections,
	flattenTagCollections,
	updateTagInCollections,
} from 'pptx-viewer-shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronRight, LuTrash2 } from 'react-icons/lu';

import { cn } from '../../utils';
import { HEADING, CARD, INPUT, BTN } from './inspector-pane-constants';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TagsSectionProps {
	tagCollections: PptxTagCollection[];
	onUpdateTagCollections: (next: PptxTagCollection[]) => void;
	canEdit: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TagsSection({
	tagCollections,
	onUpdateTagCollections,
	canEdit,
}: TagsSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const [collapsed, setCollapsed] = useState(true);

	// Flattening + the immutable edits live in `pptx-viewer-shared` so every
	// binding's Tags section addresses the nested collection model identically.
	const allTags = flattenTagCollections(tagCollections);

	const updateTag = (colIdx: number, tagIdx: number, field: 'name' | 'value', newValue: string) => {
		onUpdateTagCollections(updateTagInCollections(tagCollections, colIdx, tagIdx, field, newValue));
	};

	const deleteTag = (colIdx: number, tagIdx: number) => {
		onUpdateTagCollections(deleteTagFromCollections(tagCollections, colIdx, tagIdx));
	};

	const addTag = () => {
		onUpdateTagCollections(addTagToCollections(tagCollections));
	};

	return (
		<div className={CARD}>
			<button
				type='button'
				className='flex items-center gap-1 w-full'
				onClick={() => setCollapsed(!collapsed)}
			>
				{collapsed ? (
					<LuChevronRight className='w-3 h-3 text-muted-foreground' />
				) : (
					<LuChevronDown className='w-3 h-3 text-muted-foreground' />
				)}
				<span className={HEADING}>{t('pptx.tags.title')}</span>
				<span className='ml-auto text-[10px] text-muted-foreground'>{allTags.length}</span>
			</button>
			{!collapsed && (
				<div className='space-y-1.5'>
					{allTags.length === 0 ? (
						<div className='text-[10px] text-muted-foreground'>{t('pptx.tags.noTags')}</div>
					) : (
						allTags.map((tag, idx) => (
							<div
								key={`${tag.colIdx}-${tag.tagIdx}-${idx}`}
								className='grid grid-cols-[1fr,1fr,auto] gap-1 text-[11px]'
							>
								<input
									type='text'
									className={INPUT}
									disabled={!canEdit}
									placeholder={t('pptx.tags.name')}
									value={tag.name}
									onChange={(e) => updateTag(tag.colIdx, tag.tagIdx, 'name', e.target.value)}
								/>
								<input
									type='text'
									className={INPUT}
									disabled={!canEdit}
									placeholder={t('pptx.tags.value')}
									value={tag.value}
									onChange={(e) => updateTag(tag.colIdx, tag.tagIdx, 'value', e.target.value)}
								/>
								{canEdit && (
									<button
										type='button'
										className={cn(BTN, 'px-1.5 text-red-400 hover:text-red-300')}
										title={t('pptx.tags.deleteTag')}
										onClick={() => deleteTag(tag.colIdx, tag.tagIdx)}
									>
										<LuTrash2 className='w-3 h-3' />
									</button>
								)}
							</div>
						))
					)}
					{canEdit && (
						<button type='button' className={BTN} onClick={addTag}>
							{t('pptx.tags.addTag')}
						</button>
					)}
				</div>
			)}
		</div>
	);
}
