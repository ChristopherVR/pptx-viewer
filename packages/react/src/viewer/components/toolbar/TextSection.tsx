import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import React, { useCallback, useRef } from 'react';
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
}

export function TextSection(p: TextSectionProps): React.ReactElement {
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
								switch (b.t) {
									case 'Bold':
										p.onUpdateTextStyle({ bold: !ts?.bold });
										break;
									case 'Italic':
										p.onUpdateTextStyle({ italic: !ts?.italic });
										break;
									case 'Underline':
										p.onUpdateTextStyle({
											underline: !ts?.underline,
										});
										break;
									case 'Strikethrough':
										p.onUpdateTextStyle({
											strikethrough: !ts?.strikethrough,
										});
										break;
								}
							};
							return (
								<button
									key={b.t}
									type='button'
									disabled={!canMut}
									onMouseDown={(e) => e.preventDefault()}
									onClick={handleClick}
									className={i < a.length - 1 ? gB : gL}
									title={b.t}
								>
									{b.i}
								</button>
							);
						})}
					</div>

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
							title='Increase Font Size'
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
							title='Decrease Font Size'
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
							title='Clear Formatting'
						>
							<LuRemoveFormatting className={ic} />
						</button>
					</div>

					{/* Font colour */}
					<div className='relative group'>
						<button
							type='button'
							disabled={!canMut}
							onMouseDown={(e) => e.preventDefault()}
							className={pill}
							title='Font Color'
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
						<div className='absolute left-0 top-full z-50 hidden group-hover:block pt-1'>
							<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-2 w-36'>
								<div className='grid grid-cols-5 gap-1.5 mb-2'>
									{FONT_COLOR_PRESETS.map((c) => (
										<button
											key={c}
											type='button'
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
									Custom colour...
								</button>
								<input
									ref={colorInputRef}
									type='color'
									className='sr-only'
									value={currentColor}
									onChange={(e) => handleColorChange(e.target.value)}
								/>
							</div>
						</div>
					</div>

					{/* Text highlight colour */}
					<div className='relative group'>
						<button
							type='button'
							disabled={!canMut}
							onMouseDown={(e) => e.preventDefault()}
							className={pill}
							title='Text Highlight Color'
						>
							<LuHighlighter className={ic} />
							<div
								className='w-4 h-1 rounded-sm -mt-0.5'
								style={{ backgroundColor: currentHighlight }}
							/>
						</button>
						<div className='absolute left-0 top-full z-50 hidden group-hover:block pt-1'>
							<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-2 w-36'>
								<div className='grid grid-cols-5 gap-1.5 mb-2'>
									{HIGHLIGHT_COLOR_PRESETS.map((c) => (
										<button
											key={c}
											type='button'
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
									Custom colour...
								</button>
								<input
									ref={highlightInputRef}
									type='color'
									className='sr-only'
									value={currentHighlight}
									onChange={(e) => handleHighlightChange(e.target.value)}
								/>
							</div>
						</div>
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
							title='Bullet List'
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
							title='Numbered List'
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
							title='Decrease Indent'
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
							title='Increase Indent'
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
								const alignMap: Record<string, 'left' | 'center' | 'right' | 'justify'> = {
									'Align left': 'left',
									'Align center': 'center',
									'Align right': 'right',
									Justify: 'justify',
								};
								const align = alignMap[b.t];
								if (align) {
									p.onUpdateTextStyle({ align });
								}
							};
							return (
								<button
									key={b.t}
									type='button'
									disabled={!canMut}
									onMouseDown={(e) => e.preventDefault()}
									onClick={handleClick}
									className={i < a.length - 1 ? gB : gL}
									title={b.t}
								>
									{b.i}
								</button>
							);
						})}
					</div>
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>Paragraph</span>
			</div>
		</>
	);
}
