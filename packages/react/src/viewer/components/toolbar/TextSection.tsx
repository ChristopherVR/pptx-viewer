import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxThemeColorRef, TextStyle } from 'pptx-viewer-core';
import { textFontSizePtToPx } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { TableCellEditorState } from '../../types';
import type { ChangeCaseMode } from '../../utils/text-case-transform';
import { extractFontInfo } from './font-info';
import { FontFormatGroup } from './FontFormatGroup';
import { FontPickerGroup } from './FontPickerGroup';
import { ParagraphGroup } from './ParagraphGroup';
import { groupAttr } from './PowerPointRibbonControls';
import { getEffectiveTextStyle, textSectionBulletKind } from './text-section-state';
import { sep } from './toolbar-constants';
import { useParagraphListKind } from './useParagraphListKind';

export interface TextSectionProps {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	tableEditorState?: TableCellEditorState | null;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
	/** Bullets / Numbering for a text element: the shared paragraph bullet toggle. */
	onToggleBullets: (kind: 'bullet' | 'numbered') => void;
	/** Rewrite the selected text's characters (PowerPoint's Aa "Change Case" dropdown). */
	onTransformTextCase: (mode: ChangeCaseMode) => void;
	/** Theme major/minor latin faces, leading the font dropdown. */
	themeFonts?: { heading?: string; body?: string };
	/** Families the deck embeds, offered as their own dropdown group. */
	embeddedFontFamilies?: readonly string[];
	/** Families registered this session via File > Options > Fonts. */
	customFontFamilies?: readonly string[];
}

export function TextSection(p: TextSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const hasSel = Boolean(p.selectedElement);
	const canMut = hasSel && p.canEdit;
	const { fontFamily, fontSize } = extractFontInfo(p.selectedElement, p.themeFonts);
	const isTextEl = hasSel && p.selectedElement !== null && hasTextProperties(p.selectedElement);
	const isTable = hasSel && p.selectedElement?.type === 'table';
	const canFormat = isTextEl || isTable;
	const effectiveTs = getEffectiveTextStyle(p.selectedElement, p.tableEditorState);
	const selectedListKind = useParagraphListKind(p.selectedElement);
	const bulletKind = isTextEl
		? selectedListKind
		: textSectionBulletKind(p.selectedElement, p.tableEditorState);
	const toggleBullets = (kind: 'bullet' | 'numbered'): void => {
		if (!p.canEdit || !canFormat || !p.selectedElement) {
			return;
		}
		if (hasTextProperties(p.selectedElement)) {
			p.onToggleBullets(kind);
			return;
		}
		// Table cells keep their cell-style path.
		p.onUpdateTextStyle({ listType: effectiveTs?.listType === kind ? 'none' : kind });
	};

	const currentColor =
		isTextEl && p.selectedElement && hasTextProperties(p.selectedElement)
			? (p.selectedElement.textSegments?.[0]?.style?.color ??
				p.selectedElement.textStyle?.color ??
				'#000000')
			: (effectiveTs?.color ?? '#000000');

	const currentColorThemeRef: PptxThemeColorRef | undefined =
		isTextEl && p.selectedElement && hasTextProperties(p.selectedElement)
			? (p.selectedElement.textSegments?.[0]?.style?.colorRef ??
				p.selectedElement.textStyle?.colorRef)
			: undefined;

	const currentHighlight =
		isTextEl && p.selectedElement && hasTextProperties(p.selectedElement)
			? (p.selectedElement.textSegments?.[0]?.style?.highlightColor ??
				p.selectedElement.textStyle?.highlightColor ??
				'#ffff00')
			: '#ffff00';

	return (
		<>
			<div className='flex flex-col items-center gap-0.5' {...groupAttr('home.font')}>
				<div className='flex items-center gap-1' data-pptx-chrome='font-controls'>
					<FontPickerGroup
						// A table needs a selected cell for the family and size boxes to mean anything.
						enabled={p.canEdit && (isTextEl || (isTable && Boolean(p.tableEditorState)))}
						fontFamily={fontFamily}
						fontSize={fontSize}
						themeFonts={p.themeFonts}
						embeddedFonts={p.embeddedFontFamilies}
						customFonts={p.customFontFamilies}
						onFamily={(family) => p.onUpdateTextStyle({ fontFamily: family })}
						onSize={(size) =>
							p.onUpdateTextStyle({
								fontSize:
									p.selectedElement && hasTextProperties(p.selectedElement)
										? textFontSizePtToPx(size)
										: size,
							})
						}
					/>
					<FontFormatGroup
						canMut={canMut}
						canFormat={canFormat}
						isTextEl={isTextEl}
						selectedElement={p.selectedElement}
						tableEditorState={p.tableEditorState}
						effectiveTs={effectiveTs}
						isTable={isTable}
						currentColor={currentColor}
						currentColorRef={currentColorThemeRef}
						currentHighlight={currentHighlight}
						onUpdateTextStyle={p.onUpdateTextStyle}
						onTransformTextCase={p.onTransformTextCase}
					/>
				</div>
				<span data-pptx-chrome='ribbon-group-label'>{t('pptx.ribbon.font')}</span>
			</div>

			{sep}

			<ParagraphGroup
				canMut={canMut}
				canFormat={canFormat}
				bulletKind={bulletKind}
				effectiveTs={effectiveTs}
				onToggleBullets={toggleBullets}
				onUpdateTextStyle={p.onUpdateTextStyle}
			/>
		</>
	);
}
