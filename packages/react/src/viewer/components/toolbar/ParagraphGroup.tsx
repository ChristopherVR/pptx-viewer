import type { TextStyle } from 'pptx-viewer-core';
import type { ElementBulletKind, RibbonGalleryPlacement } from 'pptx-viewer-shared';
import {
	FIXED_TAB_GALLERIES,
	paragraphHomeAction,
	paragraphHomeAlign,
	paragraphHomeControls,
} from 'pptx-viewer-shared';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuList, LuListOrdered } from 'react-icons/lu';

import { ColumnsDropdown, LineSpacingDropdown, TextDirectionDropdown } from './ParagraphDropdowns';
import { controlAttr, groupAttr } from './PowerPointRibbonControls';
import { RibbonGallery } from './RibbonGallery';
import { gB, gL, grp, ic } from './toolbar-constants';
import { WebHomeControls } from './WebHomeControls';

/** Pressed look for a toggle whose state is on. */
const ON = 'bg-primary/20 ring-1 ring-primary';

function fixedGallery(control: string): RibbonGalleryPlacement | undefined {
	return FIXED_TAB_GALLERIES.find((placement) => placement.control === control);
}
const BULLETS_GALLERY = fixedGallery('home.paragraph.bullets');
const NUMBERING_GALLERY = fixedGallery('home.paragraph.numbering');

export interface ParagraphGroupProps {
	canMut: boolean;
	canFormat: boolean;
	bulletKind: ElementBulletKind;
	effectiveTs?: Partial<TextStyle>;
	onToggleBullets: (kind: 'bullet' | 'numbered') => void;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
}

/**
 * Home > Paragraph: the Bullets / Numbering toggles (each followed by its
 * shared library gallery), the shared indent and alignment strip, line
 * spacing, text direction and columns.
 */
export function ParagraphGroup(p: ParagraphGroupProps): React.ReactElement {
	const { t } = useTranslation();
	const { canMut, canFormat, effectiveTs, onUpdateTextStyle } = p;
	const align = paragraphHomeAlign(effectiveTs?.align);
	const paragraphControls = useMemo(
		() => paragraphHomeControls({ enabled: canMut && canFormat, align }),
		[canMut, canFormat, align],
	);
	const requestParagraph = useCallback(
		(id: string) => {
			const action = paragraphHomeAction(id);
			if (!canFormat || !action) {
				return;
			}
			if (action.kind === 'indent') {
				const current = effectiveTs?.paragraphMarginLeft ?? 0;
				onUpdateTextStyle({ paragraphMarginLeft: Math.max(0, current + action.delta) });
			} else {
				onUpdateTextStyle({ align: action.align });
			}
		},
		[canFormat, effectiveTs, onUpdateTextStyle],
	);
	const listToggle = (
		kind: 'bullet' | 'numbered',
		placement: RibbonGalleryPlacement | undefined,
		title: string,
		icon: React.ReactNode,
	) => (
		<div className={grp} {...controlAttr(placement?.control)}>
			<button
				type='button'
				disabled={!canMut}
				aria-pressed={p.bulletKind === kind}
				onMouseDown={(e) => e.preventDefault()}
				onClick={() => p.onToggleBullets(kind)}
				className={`${placement ? gB : gL}${p.bulletKind === kind ? ` ${ON}` : ''}`}
				title={title}
			>
				{icon}
			</button>
			{placement && <RibbonGallery placement={placement} chevronOnly tagControl={false} />}
		</div>
	);

	return (
		<div className='flex flex-col items-center gap-0.5' {...groupAttr('home.paragraph')}>
			<div className='flex items-center gap-1'>
				{listToggle(
					'bullet',
					BULLETS_GALLERY,
					t('pptx.text.bulletList'),
					<LuList className={ic} />,
				)}
				{listToggle(
					'numbered',
					NUMBERING_GALLERY,
					t('pptx.text.numberedList'),
					<LuListOrdered className={ic} />,
				)}

				<WebHomeControls
					family='paragraph'
					controls={paragraphControls}
					onRequest={requestParagraph}
				/>

				<LineSpacingDropdown
					canMut={canMut}
					canFormat={canFormat}
					effectiveTs={p.effectiveTs}
					onUpdateTextStyle={p.onUpdateTextStyle}
				/>
				<TextDirectionDropdown
					canMut={canMut}
					canFormat={canFormat}
					onUpdateTextStyle={p.onUpdateTextStyle}
				/>
				<ColumnsDropdown
					canMut={canMut}
					canFormat={canFormat}
					onUpdateTextStyle={p.onUpdateTextStyle}
				/>
			</div>
			<span className='text-[9px] text-muted-foreground leading-none'>
				{t('pptx.ribbon.paragraph')}
			</span>
		</div>
	);
}
