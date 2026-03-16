import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import React, { useCallback, useRef } from 'react';

import { gB, gL, grp, FMT, ATXT, pill, ic } from './toolbar-constants';

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

export interface TextSectionProps {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
}

export function TextSection(p: TextSectionProps): React.ReactElement {
	const hasSel = Boolean(p.selectedElement);
	const canMut = hasSel && p.canEdit;
	const isTextEl = hasSel && p.selectedElement !== null && hasTextProperties(p.selectedElement);
	const isTable = hasSel && p.selectedElement?.type === 'table';
	// Enable formatting for text elements AND table cells
	const canFormat = isTextEl || isTable;

	const currentColor =
		isTextEl && p.selectedElement && hasTextProperties(p.selectedElement)
			? (p.selectedElement.textSegments?.[0]?.style?.color ??
				p.selectedElement.textStyle?.color ??
				'#000000')
			: '#000000';

	const colorInputRef = useRef<HTMLInputElement>(null);
	const handleColorChange = useCallback(
		(color: string) => {
			if (!canFormat) {
				return;
			}
			p.onUpdateTextStyle({ color });
		},
		[canFormat, p],
	);

	return (
		<>
			<div className={grp}>
				{FMT.map((b, i, a) => {
					const handleClick = () => {
						if (!canFormat || !p.selectedElement) {
							return;
						}
						const ts = hasTextProperties(p.selectedElement)
							? p.selectedElement.textStyle
							: undefined;
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

			{/* Font colour */}
			<div className='relative group'>
				<button
					type='button'
					disabled={!canMut}
					onMouseDown={(e) => e.preventDefault()}
					className={pill}
					title='Font color'
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
					<div className='w-4 h-1 rounded-sm -mt-0.5' style={{ backgroundColor: currentColor }} />
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
							Custom colour…
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
		</>
	);
}
