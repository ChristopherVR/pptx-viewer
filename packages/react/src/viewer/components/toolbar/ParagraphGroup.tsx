import type { TextStyle } from 'pptx-viewer-core';
import type { ElementBulletKind, RibbonGalleryPlacement } from 'pptx-viewer-shared';
import { FIXED_TAB_GALLERIES } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuIndentDecrease, LuIndentIncrease, LuList, LuListOrdered } from 'react-icons/lu';

import { ColumnsDropdown, LineSpacingDropdown, TextDirectionDropdown } from './ParagraphDropdowns';
import { controlAttr, groupAttr } from './PowerPointRibbonControls';
import { RibbonGallery } from './RibbonGallery';
import { ATXT, gB, gL, grp, ic } from './toolbar-constants';

/** Pressed look for a toggle whose state is on. */
const ON = 'bg-primary/20 ring-1 ring-primary';

const ALIGN_CONTROL = {
	left: 'home.paragraph.alignLeft',
	center: 'home.paragraph.alignCenter',
	right: 'home.paragraph.alignRight',
	justify: 'home.paragraph.justify',
} as const;

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
 * shared library gallery), list level, alignment, line spacing, text
 * direction and columns.
 */
export function ParagraphGroup(p: ParagraphGroupProps): React.ReactElement {
	const { t } = useTranslation();
	const { canMut, canFormat } = p;
	const indent = (delta: number) => {
		if (!canFormat) {
			return;
		}
		const current = p.effectiveTs?.paragraphMarginLeft ?? 0;
		p.onUpdateTextStyle({ paragraphMarginLeft: Math.max(0, current + delta) });
	};
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

				{/* Indent decrease / increase */}
				<div className={grp}>
					<button
						type='button'
						disabled={!canMut}
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => indent(-24)}
						className={gB}
						title={t('pptx.text.decreaseIndent')}
						{...controlAttr('home.paragraph.decreaseIndent')}
					>
						<LuIndentDecrease className={ic} />
					</button>
					<button
						type='button'
						disabled={!canMut}
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => indent(24)}
						className={gL}
						title={t('pptx.text.increaseIndent')}
						{...controlAttr('home.paragraph.increaseIndent')}
					>
						<LuIndentIncrease className={ic} />
					</button>
				</div>

				{/* Alignment */}
				<div className={grp}>
					{ATXT.map((b, i, a) => (
						<button
							key={b.id}
							type='button'
							disabled={!canMut}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => {
								if (canFormat) {
									p.onUpdateTextStyle({ align: b.id as 'left' | 'center' | 'right' | 'justify' });
								}
							}}
							className={i < a.length - 1 ? gB : gL}
							title={t(b.labelKey)}
							{...controlAttr(ALIGN_CONTROL[b.id as keyof typeof ALIGN_CONTROL])}
						>
							{b.i}
						</button>
					))}
				</div>

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
