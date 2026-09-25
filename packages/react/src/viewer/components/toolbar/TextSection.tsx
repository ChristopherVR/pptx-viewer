import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxThemeColorRef, TextStyle } from 'pptx-viewer-core';
import { nextToggleValue, textFontSizePtToPx } from 'pptx-viewer-shared';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LuAArrowDown, LuAArrowUp, LuRemoveFormatting } from 'react-icons/lu';

import type { TableCellEditorState } from '../../types';
import type { ChangeCaseMode } from '../../utils/text-case-transform';
import { useRecentColors } from '../inspector/RecentColorsContext';
import { ParagraphGroup } from './ParagraphGroup';
import { controlAttr, groupAttr } from './PowerPointRibbonControls';
import {
	getEffectiveTextStyle,
	isTextDecorationFlag,
	textSectionBulletKind,
	textSectionFlags,
} from './text-section-state';
import { TextColorMenus } from './TextColorMenus';
import { TextSpacingCaseMenus } from './TextSpacingCaseMenus';
import { gB, gL, grp, FMT, pill, ic, sep } from './toolbar-constants';
import { useParagraphListKind } from './useParagraphListKind';

/** Pressed look for a toggle whose state is on. */
const ON = 'bg-primary/20 ring-1 ring-primary';

const FONT_TOGGLE_CONTROL = {
	bold: 'home.font.bold',
	italic: 'home.font.italic',
	underline: 'home.font.underline',
	strikethrough: 'home.font.strikethrough',
} as const;

export interface TextSectionProps {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	tableEditorState?: TableCellEditorState | null;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
	/** Bullets / Numbering for a text element: the shared paragraph bullet toggle. */
	onToggleBullets: (kind: 'bullet' | 'numbered') => void;
	/** Rewrite the selected text's characters (PowerPoint's Aa "Change Case" dropdown). */
	onTransformTextCase: (mode: ChangeCaseMode) => void;
}

export function TextSection(p: TextSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const hasSel = Boolean(p.selectedElement);
	const canMut = hasSel && p.canEdit;
	const isTextEl = hasSel && p.selectedElement !== null && hasTextProperties(p.selectedElement);
	const isTable = hasSel && p.selectedElement?.type === 'table';
	// Enable formatting for text elements AND table cells
	const canFormat = isTextEl || isTable;
	const effectiveTs = getEffectiveTextStyle(p.selectedElement, p.tableEditorState);
	// Pressed state over the whole element (the DOM selection is only read at
	// click time, since the ribbon does not re-render as the caret moves).
	const pressedFlags = textSectionFlags(p.selectedElement, p.tableEditorState, false);
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

	const { pushColor } = useRecentColors();
	const handleColorChange = useCallback(
		(color: string, ref?: PptxThemeColorRef) => {
			if (!canFormat) {
				return;
			}
			p.onUpdateTextStyle({ color, colorRef: ref });
			pushColor(color);
		},
		[canFormat, p, pushColor],
	);
	const handleHighlightChange = useCallback(
		(highlightColor: string) => {
			if (!canFormat) {
				return;
			}
			p.onUpdateTextStyle({ highlightColor });
			pushColor(highlightColor);
		},
		[canFormat, p, pushColor],
	);

	return (
		<>
			{/* ── Font group ── */}
			<div className='flex flex-col items-center gap-0.5' {...groupAttr('home.font')}>
				<div className='flex items-center gap-1'>
					<div className={grp}>
						{FMT.map((b, i, a) => {
							const flag = isTextDecorationFlag(b.id) ? b.id : undefined;
							const handleClick = () => {
								if (!canFormat || !p.selectedElement || !flag) {
									return;
								}
								// Decide from the runs the user selected (shared tri-state),
								// not from the body style: `!ts?.bold` could never un-bold a
								// run-level bold word.
								const flags = textSectionFlags(p.selectedElement, p.tableEditorState, true);
								p.onUpdateTextStyle({ [flag]: nextToggleValue(flags[flag]) });
							};
							const pressed = flag !== undefined && pressedFlags[flag] === 'on';
							return (
								<button
									key={b.id}
									type='button'
									disabled={!canMut}
									aria-pressed={pressed}
									onMouseDown={(e) => e.preventDefault()}
									onClick={handleClick}
									className={`${i < a.length - 1 ? gB : gL}${pressed ? ` ${ON}` : ''}`}
									title={t(b.labelKey)}
									{...controlAttr(FONT_TOGGLE_CONTROL[b.id as keyof typeof FONT_TOGGLE_CONTROL])}
								>
									{b.i}
								</button>
							);
						})}
					</div>

					{/* Text Shadow toggle */}
					<button
						type='button'
						disabled={!canMut}
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => {
							if (!canFormat) {
								return;
							}
							const hasShadow = Boolean(effectiveTs?.textShadowColor);
							p.onUpdateTextStyle(
								hasShadow
									? {
											textShadowColor: undefined,
											textShadowBlur: undefined,
											textShadowOffsetX: undefined,
											textShadowOffsetY: undefined,
										}
									: {
											textShadowColor: '#000000',
											textShadowBlur: 2,
											textShadowOffsetX: 1,
											textShadowOffsetY: 1,
											textShadowOpacity: 0.5,
										},
							);
						}}
						className={pill}
						title={t('pptx.textEffects.shadow')}
						aria-label={t('pptx.textEffects.shadow')}
						{...controlAttr('home.font.shadow')}
					>
						<svg
							className={ic}
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='2'
						>
							<text x='6' y='17' fontSize='16' fontWeight='bold' fill='currentColor' stroke='none'>
								S
							</text>
							<text
								x='7.5'
								y='18.5'
								fontSize='16'
								fontWeight='bold'
								fill='none'
								stroke='currentColor'
								strokeWidth='0.5'
								opacity='0.4'
							>
								S
							</text>
						</svg>
					</button>

					{/* Font size increase / decrease / clear formatting */}
					<div className={grp}>
						<button
							type='button'
							disabled={!canMut}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => {
								if (!canFormat || !p.selectedElement) {
									return;
								}
								const current = effectiveTs?.fontSize ?? (isTextEl ? textFontSizePtToPx(18) : 18);
								const delta = isTextEl ? textFontSizePtToPx(2) : 2;
								p.onUpdateTextStyle({ fontSize: current + delta });
							}}
							className={gB}
							title={t('pptx.text.increaseFontSize')}
							{...controlAttr('home.font.increaseFontSize')}
						>
							<LuAArrowUp className={ic} />
						</button>
						<button
							type='button'
							disabled={!canMut}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => {
								if (!canFormat || !p.selectedElement) {
									return;
								}
								const current = effectiveTs?.fontSize ?? (isTextEl ? textFontSizePtToPx(18) : 18);
								const delta = isTextEl ? textFontSizePtToPx(2) : 2;
								const minimum = isTextEl ? textFontSizePtToPx(1) : 1;
								p.onUpdateTextStyle({ fontSize: Math.max(minimum, current - delta) });
							}}
							className={gB}
							title={t('pptx.text.decreaseFontSize')}
							{...controlAttr('home.font.decreaseFontSize')}
						>
							<LuAArrowDown className={ic} />
						</button>
						<button
							type='button'
							disabled={!canMut}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => {
								if (!canFormat) {
									return;
								}
								p.onUpdateTextStyle({
									bold: false,
									italic: false,
									underline: false,
									strikethrough: false,
									highlightColor: undefined,
								});
							}}
							className={gL}
							title={t('pptx.text.clearFormatting')}
							{...controlAttr('home.font.clearFormatting')}
						>
							<LuRemoveFormatting className={ic} />
						</button>
					</div>

					<TextSpacingCaseMenus
						canMut={canMut}
						canFormat={canFormat}
						isTable={isTable}
						onUpdateTextStyle={p.onUpdateTextStyle}
						onTransformTextCase={p.onTransformTextCase}
					/>
					<TextColorMenus
						canMut={canMut}
						currentColor={currentColor}
						currentColorThemeRef={currentColorThemeRef}
						currentHighlight={currentHighlight}
						handleColorChange={handleColorChange}
						handleHighlightChange={handleHighlightChange}
					/>
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>
					{t('pptx.ribbon.font')}
				</span>
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
