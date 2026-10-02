import type { TextStyle } from 'pptx-viewer-core';
import type { ElementBulletKind, RibbonHomeIntent } from 'pptx-viewer-shared';
import {
	homeGalleryApply,
	homeGalleryControls,
	paragraphHomeAction,
	paragraphHomeAlign,
	paragraphHomeControls,
	withHomeGalleries,
} from 'pptx-viewer-shared';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useRibbonGalleryCommands } from '../ribbon-gallery-context';
import { groupAttr } from './PowerPointRibbonControls';
import { WebHomeControls } from './WebHomeControls';

export interface ParagraphGroupProps {
	canMut: boolean;
	canFormat: boolean;
	bulletKind: ElementBulletKind;
	effectiveTs?: Partial<TextStyle>;
	onToggleBullets: (kind: 'bullet' | 'numbered') => void;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
}

/**
 * Home > Paragraph: the shared strip renders the Bullets / Numbering toggles
 * with their library galleries, the indent and alignment buttons, line spacing,
 * text direction and columns. Each intent runs this binding's undoable edit.
 */
export function ParagraphGroup(p: ParagraphGroupProps): React.ReactElement {
	const { t } = useTranslation();
	const { canMut, canFormat, effectiveTs, onUpdateTextStyle, onToggleBullets } = p;
	const commands = useRibbonGalleryCommands();
	const align = paragraphHomeAlign(effectiveTs?.align);
	const enabled = canMut && canFormat;
	const controls = useMemo(
		() =>
			withHomeGalleries(
				paragraphHomeControls({
					enabled,
					align,
					list: p.bulletKind === 'mixed' ? 'none' : p.bulletKind,
					lineSpacing: effectiveTs?.lineSpacing,
					columns: effectiveTs?.columnCount,
					textDirection: effectiveTs?.textDirection,
				}),
				homeGalleryControls('paragraph', commands?.context ?? { element: null }, enabled),
				Boolean(commands?.editable) && enabled,
			),
		[
			enabled,
			align,
			p.bulletKind,
			effectiveTs?.lineSpacing,
			effectiveTs?.columnCount,
			effectiveTs?.textDirection,
			commands?.context,
			commands?.editable,
		],
	);
	const request = useCallback(
		(id: string, _part?: string, intent?: RibbonHomeIntent) => {
			if (!canFormat) {
				return;
			}
			const value = intent?.value;
			switch (id) {
				case 'home.paragraph.bullets':
				case 'home.paragraph.numbering':
					if (value === undefined) {
						onToggleBullets(id === 'home.paragraph.bullets' ? 'bullet' : 'numbered');
					} else if (commands?.editable) {
						const result = homeGalleryApply('paragraph', id, String(value), commands.context);
						if (result) {
							commands.dispatch(result);
						}
					}
					return;
				case 'home.paragraph.lineSpacing':
					onUpdateTextStyle({ lineSpacing: Number(value) });
					return;
				case 'home.paragraph.textDirection':
					onUpdateTextStyle({ textDirection: value as TextStyle['textDirection'] });
					return;
				case 'home.paragraph.columns':
					onUpdateTextStyle({ columnCount: Number(value) });
					return;
			}
			const action = paragraphHomeAction(id);
			if (action?.kind === 'indent') {
				const current = effectiveTs?.paragraphMarginLeft ?? 0;
				onUpdateTextStyle({ paragraphMarginLeft: Math.max(0, current + action.delta) });
			} else if (action) {
				onUpdateTextStyle({ align: action.align });
			}
		},
		[canFormat, effectiveTs, onUpdateTextStyle, onToggleBullets, commands],
	);

	return (
		<div className='flex flex-col items-center gap-0.5' {...groupAttr('home.paragraph')}>
			<div className='flex items-center gap-1' data-pptx-chrome='paragraph-controls'>
				<WebHomeControls family='paragraph' controls={controls} onRequest={request} />
			</div>
			<span data-pptx-chrome='ribbon-group-label'>
				{t('pptx.ribbon.paragraph')}
			</span>
		</div>
	);
}
