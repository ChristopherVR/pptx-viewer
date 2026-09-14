import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxThemeColorRef, TextStyle } from 'pptx-viewer-core';
import {
	CHARACTER_SPACING_OPTIONS,
	nextToggleValue,
	OFFICE_COLOR_SWATCHES,
	textFontSizePtToPx,
} from 'pptx-viewer-shared';
import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuAArrowDown,
	LuAArrowUp,
	LuHighlighter,
	LuIndentDecrease,
	LuIndentIncrease,
	LuList,
	LuListOrdered,
	LuRemoveFormatting,
} from 'react-icons/lu';

import type { TableCellEditorState } from '../../types';
import type { ChangeCaseMode } from '../../utils/text-case-transform';
import { useRecentColors } from '../inspector/RecentColorsContext';
import { RecentColorsRow } from '../inspector/RecentColorsRow';
import { ThemeColorSwatchGrid } from '../inspector/ThemeColorSwatchGrid';
import { ColumnsDropdown, LineSpacingDropdown, TextDirectionDropdown } from './ParagraphDropdowns';
import { RibbonMenu } from './RibbonMenu';
import {
	getEffectiveTextStyle,
	isTextDecorationFlag,
	textSectionBulletKind,
	textSectionFlags,
} from './text-section-state';
import { gB, gL, grp, FMT, ATXT, pill, ic, sep } from './toolbar-constants';
import { useParagraphListKind } from './useParagraphListKind';

/** Pressed look for a toggle whose state is on. */
const ON = 'bg-primary/20 ring-1 ring-primary';

const HIGHLIGHT_COLOR_PRESETS = [
	'#ffff00',
	'#00ff00',
	'#00ffff',
	'#ff00ff',
	'#0000ff',
	'#ff0000',
	'#000080',
	'#008080',
	'#008000',
	'#800080',
];

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

	const colorInputRef = useRef<HTMLInputElement>(null);
	const highlightInputRef = useRef<HTMLInputElement>(null);
	const charSpacingRef = useRef<HTMLDivElement>(null);
	const changeCaseRef = useRef<HTMLDivElement>(null);
	const fontColorRef = useRef<HTMLDivElement>(null);
	const highlightMenuRef = useRef<HTMLDivElement>(null);
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
			<div className='flex flex-col items-center gap-0.5'>
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
						>
							<LuRemoveFormatting className={ic} />
						</button>
					</div>

					{/* Character Spacing */}
					<div className='relative group' ref={charSpacingRef}>
						<button
							type='button'
							disabled={!canMut}
							onMouseDown={(e) => e.preventDefault()}
							className={pill}
							title={t('pptx.text.characterSpacing')}
							aria-label={t('pptx.text.characterSpacing')}
						>
							<svg
								className={ic}
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='1.5'
							>
								<text
									x='4'
									y='16'
									fontSize='11'
									fontWeight='bold'
									fill='currentColor'
									stroke='none'
								>
									AV
								</text>
								<path d='M3 20 L1 20 M3 20 L5 20' strokeWidth='1.5' />
								<path d='M21 20 L19 20 M21 20 L23 20' strokeWidth='1.5' />
							</svg>
						</button>
						<RibbonMenu anchorRef={charSpacingRef} className='hidden group-hover:block pt-1'>
							<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1 w-32'>
								{CHARACTER_SPACING_OPTIONS.map((opt) => (
									<button
										key={opt.i18nKey}
										type='button'
										className='flex items-center w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors'
										onMouseDown={(e) => e.preventDefault()}
										onClick={() => {
											if (!canFormat) {
												return;
											}
											p.onUpdateTextStyle({ characterSpacing: opt.value });
										}}
									>
										{t(opt.i18nKey)}
									</button>
								))}
							</div>
						</RibbonMenu>
					</div>

					{/* Change Case (Aa) */}
					<div className='relative group' ref={changeCaseRef}>
						<button
							type='button'
							disabled={!canMut}
							onMouseDown={(e) => e.preventDefault()}
							className={pill}
							title={t('pptx.text.changeCase')}
							aria-label={t('pptx.text.changeCase')}
						>
							<svg
								className={ic}
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='1.5'
							>
								<text
									x='2'
									y='16'
									fontSize='13'
									fontWeight='bold'
									fill='currentColor'
									stroke='none'
								>
									Aa
								</text>
							</svg>
						</button>
						<RibbonMenu anchorRef={changeCaseRef} className='hidden group-hover:block pt-1'>
							<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1 w-44'>
								{[
									{ label: t('pptx.text.changeCaseSentence'), value: 'sentence' },
									{ label: t('pptx.text.changeCaseLower'), value: 'lower' },
									{ label: t('pptx.text.changeCaseUpper'), value: 'upper' },
									{ label: t('pptx.text.changeCaseCapitalize'), value: 'capitalize' },
									{ label: t('pptx.text.changeCaseToggle'), value: 'toggle' },
								].map((opt) => (
									<button
										key={opt.value}
										type='button'
										className='flex items-center w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors'
										onMouseDown={(e) => e.preventDefault()}
										onClick={() => {
											if (!canFormat) {
												return;
											}
											if (isTable) {
												// Table-cell text is plain (no textSegments to rewrite);
												// fall back to the visual all-caps render hint.
												p.onUpdateTextStyle({
													textCaps: opt.value === 'upper' ? 'all' : 'none',
												});
												return;
											}
											p.onTransformTextCase(opt.value as ChangeCaseMode);
										}}
									>
										{opt.label}
									</button>
								))}
							</div>
						</RibbonMenu>
					</div>

					{/* Font colour */}
					<div className='relative group' ref={fontColorRef}>
						<button
							type='button'
							disabled={!canMut}
							onMouseDown={(e) => e.preventDefault()}
							className={pill}
							title={t('pptx.text.fontColor')}
							aria-label={t('pptx.text.fontColor')}
						>
							<svg
								className={ic}
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='2'
								strokeLinecap='round'
								strokeLinejoin='round'
							>
								<path d='M6 20h12M9.5 4h5L18 16H6L9.5 4z' />
							</svg>
							<div
								className='w-4 h-1 rounded-sm -mt-0.5'
								style={{ backgroundColor: currentColor }}
							/>
						</button>
						<RibbonMenu anchorRef={fontColorRef} className='hidden group-hover:block pt-1'>
							<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-2 w-48'>
								<ThemeColorSwatchGrid
									prefix='font-color'
									disabled={!canMut}
									selectedRef={currentColorThemeRef}
									selectedHex={currentColor}
									onPick={(c) => handleColorChange(c.hex, c.ref)}
								/>
								<div className='text-[10px] text-muted-foreground mt-1 mb-1'>
									{t('pptx.colorPicker.standardColors')}
								</div>
								<div className='grid grid-cols-5 gap-1.5 mb-2'>
									{OFFICE_COLOR_SWATCHES.map((c) => (
										<button
											key={c.hex}
											type='button'
											aria-label={c.label}
											title={c.label}
											data-pptx-compact
											className={`w-5 h-5 rounded-full border transition-transform hover:scale-125 ${
												currentColor?.toLowerCase() === c.hex
													? 'border-primary ring-1 ring-primary'
													: 'border-border'
											}`}
											style={{ backgroundColor: c.hex }}
											onMouseDown={(e) => e.preventDefault()}
											onClick={() => handleColorChange(c.hex)}
										/>
									))}
								</div>
								<button
									type='button'
									className='w-full text-[10px] text-muted-foreground hover:text-foreground py-1 transition-colors'
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => colorInputRef.current?.click()}
								>
									{t('pptx.ribbon.customColour')}
								</button>
								<input
									ref={colorInputRef}
									type='color'
									className='sr-only'
									value={currentColor}
									onChange={(e) => handleColorChange(e.target.value)}
								/>
								<RecentColorsRow
									prefix='font-color'
									disabled={!canMut}
									onCommit={handleColorChange}
								/>
							</div>
						</RibbonMenu>
					</div>

					{/* Text highlight colour */}
					<div className='relative group' ref={highlightMenuRef}>
						<button
							type='button'
							disabled={!canMut}
							onMouseDown={(e) => e.preventDefault()}
							className={pill}
							title={t('pptx.text.highlightColor')}
							aria-label={t('pptx.text.highlightColor')}
						>
							<LuHighlighter className={ic} />
							<div
								className='w-4 h-1 rounded-sm -mt-0.5'
								style={{ backgroundColor: currentHighlight }}
							/>
						</button>
						<RibbonMenu anchorRef={highlightMenuRef} className='hidden group-hover:block pt-1'>
							<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-2 w-36'>
								<div className='grid grid-cols-5 gap-1.5 mb-2'>
									{HIGHLIGHT_COLOR_PRESETS.map((c) => (
										<button
											key={c}
											type='button'
											aria-label={c}
											data-pptx-compact
											className={`w-5 h-5 rounded-full border transition-transform hover:scale-125 ${
												currentHighlight?.toLowerCase() === c
													? 'border-primary ring-1 ring-primary'
													: 'border-border'
											}`}
											style={{ backgroundColor: c }}
											onMouseDown={(e) => e.preventDefault()}
											onClick={() => handleHighlightChange(c)}
										/>
									))}
								</div>
								<button
									type='button'
									className='w-full text-[10px] text-muted-foreground hover:text-foreground py-1 transition-colors'
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => highlightInputRef.current?.click()}
								>
									{t('pptx.ribbon.customColour')}
								</button>
								<input
									ref={highlightInputRef}
									type='color'
									className='sr-only'
									value={currentHighlight}
									onChange={(e) => handleHighlightChange(e.target.value)}
								/>
							</div>
						</RibbonMenu>
					</div>
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>Font</span>
			</div>

			{sep}

			{/* ── Paragraph group ── */}
			<div className='flex flex-col items-center gap-0.5'>
				<div className='flex items-center gap-1'>
					{/* List style */}
					<div className={grp}>
						<button
							type='button'
							disabled={!canMut}
							aria-pressed={bulletKind === 'bullet'}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => toggleBullets('bullet')}
							className={`${gB}${bulletKind === 'bullet' ? ` ${ON}` : ''}`}
							title={t('pptx.text.bulletList')}
						>
							<LuList className={ic} />
						</button>
						<button
							type='button'
							disabled={!canMut}
							aria-pressed={bulletKind === 'numbered'}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => toggleBullets('numbered')}
							className={`${gL}${bulletKind === 'numbered' ? ` ${ON}` : ''}`}
							title={t('pptx.text.numberedList')}
						>
							<LuListOrdered className={ic} />
						</button>
					</div>

					{/* Indent decrease / increase */}
					<div className={grp}>
						<button
							type='button'
							disabled={!canMut}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => {
								if (!canFormat || !p.selectedElement) {
									return;
								}
								const current = effectiveTs?.paragraphMarginLeft ?? 0;
								p.onUpdateTextStyle({
									paragraphMarginLeft: Math.max(0, current - 24),
								});
							}}
							className={gB}
							title={t('pptx.text.decreaseIndent')}
						>
							<LuIndentDecrease className={ic} />
						</button>
						<button
							type='button'
							disabled={!canMut}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => {
								if (!canFormat || !p.selectedElement) {
									return;
								}
								const current = effectiveTs?.paragraphMarginLeft ?? 0;
								p.onUpdateTextStyle({
									paragraphMarginLeft: current + 24,
								});
							}}
							className={gL}
							title={t('pptx.text.increaseIndent')}
						>
							<LuIndentIncrease className={ic} />
						</button>
					</div>

					{/* Alignment */}
					<div className={grp}>
						{ATXT.map((b, i, a) => {
							const handleClick = () => {
								if (!canFormat) {
									return;
								}
								p.onUpdateTextStyle({ align: b.id as 'left' | 'center' | 'right' | 'justify' });
							};
							return (
								<button
									key={b.id}
									type='button'
									disabled={!canMut}
									onMouseDown={(e) => e.preventDefault()}
									onClick={handleClick}
									className={i < a.length - 1 ? gB : gL}
									title={t(b.labelKey)}
								>
									{b.i}
								</button>
							);
						})}
					</div>

					{/* Line Spacing */}
					<LineSpacingDropdown
						canMut={canMut}
						canFormat={canFormat}
						effectiveTs={effectiveTs}
						onUpdateTextStyle={p.onUpdateTextStyle}
					/>

					{/* Text Direction */}
					<TextDirectionDropdown
						canMut={canMut}
						canFormat={canFormat}
						onUpdateTextStyle={p.onUpdateTextStyle}
					/>

					{/* Columns */}
					<ColumnsDropdown
						canMut={canMut}
						canFormat={canFormat}
						onUpdateTextStyle={p.onUpdateTextStyle}
					/>
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>Paragraph</span>
			</div>
		</>
	);
}
