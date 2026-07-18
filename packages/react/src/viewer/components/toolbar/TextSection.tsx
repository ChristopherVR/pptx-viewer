import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
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
import { ColumnsDropdown, LineSpacingDropdown, TextDirectionDropdown } from './ParagraphDropdowns';
import { RibbonMenu } from './RibbonMenu';
import { gB, gL, grp, FMT, ATXT, pill, ic, sep } from './toolbar-constants';

/**
 * Returns the text style currently in effect for toolbar toggles:
 * - For text/shape/connector elements, the element's own `textStyle`.
 * - For tables with a focused cell, that cell's style (a superset of the
 *   relevant `TextStyle` fields like `bold`/`italic`/`underline`/`fontSize`).
 * - `undefined` otherwise.
 *
 * Without this lookup, table-cell toggles always read `undefined` (since
 * `hasTextProperties` is false for tables) and `!undefined === true`, so
 * re-clicking Bold/Italic/Underline never turns the formatting off.
 */
function getEffectiveTextStyle(
	element: PptxElement | null,
	tableEditorState: TableCellEditorState | null | undefined,
): Partial<TextStyle> | undefined {
	if (!element) {
		return undefined;
	}
	if (hasTextProperties(element)) {
		return element.textStyle;
	}
	if (element.type === 'table' && tableEditorState && element.tableData) {
		const cell =
			element.tableData.rows[tableEditorState.rowIndex]?.cells[tableEditorState.columnIndex];
		return cell?.style as Partial<TextStyle> | undefined;
	}
	return undefined;
}

const FONT_COLOR_PRESETS = [
	'#000000',
	'#ffffff',
	'#ff0000',
	'#00aa00',
	'#0000ff',
	'#ff8800',
	'#8800cc',
	'#00cccc',
	'#ff69b4',
	'#808080',
];

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

	const currentColor =
		isTextEl && p.selectedElement && hasTextProperties(p.selectedElement)
			? (p.selectedElement.textSegments?.[0]?.style?.color ??
				p.selectedElement.textStyle?.color ??
				'#000000')
			: (effectiveTs?.color ?? '#000000');

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
	const handleColorChange = useCallback(
		(color: string) => {
			if (!canFormat) {
				return;
			}
			p.onUpdateTextStyle({ color });
		},
		[canFormat, p],
	);
	const handleHighlightChange = useCallback(
		(highlightColor: string) => {
			if (!canFormat) {
				return;
			}
			p.onUpdateTextStyle({ highlightColor });
		},
		[canFormat, p],
	);

	return (
		<>
			{/* ── Font group ── */}
			<div className='flex flex-col items-center gap-0.5'>
				<div className='flex items-center gap-1'>
					<div className={grp}>
						{FMT.map((b, i, a) => {
							const handleClick = () => {
								if (!canFormat || !p.selectedElement) {
									return;
								}
								const ts = effectiveTs;
								switch (b.id) {
									case 'bold':
										p.onUpdateTextStyle({ bold: !ts?.bold });
										break;
									case 'italic':
										p.onUpdateTextStyle({ italic: !ts?.italic });
										break;
									case 'underline':
										p.onUpdateTextStyle({
											underline: !ts?.underline,
										});
										break;
									case 'strikethrough':
										p.onUpdateTextStyle({
											strikethrough: !ts?.strikethrough,
										});
										break;
								}
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
								const current = effectiveTs?.fontSize ?? 18;
								p.onUpdateTextStyle({ fontSize: current + 2 });
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
								const current = effectiveTs?.fontSize ?? 18;
								p.onUpdateTextStyle({ fontSize: Math.max(1, current - 2) });
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
								{[
									{ label: 'Very Tight', value: -150 },
									{ label: 'Tight', value: -75 },
									{ label: 'Normal', value: 0 },
									{ label: 'Loose', value: 75 },
									{ label: 'Very Loose', value: 150 },
								].map((opt) => (
									<button
										key={opt.label}
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
										{opt.label}
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
							<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-2 w-36'>
								<div className='grid grid-cols-5 gap-1.5 mb-2'>
									{FONT_COLOR_PRESETS.map((c) => (
										<button
											key={c}
											type='button'
											aria-label={c}
											data-pptx-compact
											className={`w-5 h-5 rounded-full border transition-transform hover:scale-125 ${
												currentColor?.toLowerCase() === c
													? 'border-primary ring-1 ring-primary'
													: 'border-border'
											}`}
											style={{ backgroundColor: c }}
											onMouseDown={(e) => e.preventDefault()}
											onClick={() => handleColorChange(c)}
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
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => {
								if (!canFormat || !p.selectedElement) {
									return;
								}
								p.onUpdateTextStyle({
									listType: effectiveTs?.listType === 'bullet' ? 'none' : 'bullet',
								});
							}}
							className={gB}
							title={t('pptx.text.bulletList')}
						>
							<LuList className={ic} />
						</button>
						<button
							type='button'
							disabled={!canMut}
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => {
								if (!canFormat || !p.selectedElement) {
									return;
								}
								p.onUpdateTextStyle({
									listType: effectiveTs?.listType === 'numbered' ? 'none' : 'numbered',
								});
							}}
							className={gL}
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
