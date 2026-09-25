import type { PptxThemeColorRef } from 'pptx-viewer-core';
import { OFFICE_COLOR_SWATCHES } from 'pptx-viewer-shared';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LuHighlighter } from 'react-icons/lu';

import { RecentColorsRow } from '../inspector/RecentColorsRow';
import { ThemeColorSwatchGrid } from '../inspector/ThemeColorSwatchGrid';
import { controlAttr } from './PowerPointRibbonControls';
import { RibbonMenu } from './RibbonMenu';
import { ic, pill } from './toolbar-constants';

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

export interface TextColorMenusProps {
	canMut: boolean;
	currentColor: string;
	currentColorThemeRef?: PptxThemeColorRef;
	currentHighlight: string;
	handleColorChange: (color: string, ref?: PptxThemeColorRef) => void;
	handleHighlightChange: (color: string) => void;
}

/** Home > Font's Font Color and Text Highlight Color dropdowns. */
export function TextColorMenus(p: TextColorMenusProps): React.ReactElement {
	const { t } = useTranslation();
	const {
		canMut,
		currentColor,
		currentColorThemeRef,
		currentHighlight,
		handleColorChange,
		handleHighlightChange,
	} = p;
	const colorInputRef = useRef<HTMLInputElement>(null);
	const highlightInputRef = useRef<HTMLInputElement>(null);
	const fontColorRef = useRef<HTMLDivElement>(null);
	const highlightMenuRef = useRef<HTMLDivElement>(null);
	return (
		<>
			{/* Font colour */}
			<div className='relative group' ref={fontColorRef} {...controlAttr('home.font.fontColor')}>
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
					<div className='w-4 h-1 rounded-sm -mt-0.5' style={{ backgroundColor: currentColor }} />
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
						<RecentColorsRow prefix='font-color' disabled={!canMut} onCommit={handleColorChange} />
					</div>
				</RibbonMenu>
			</div>

			{/* Text highlight colour */}
			<div
				className='relative group'
				ref={highlightMenuRef}
				{...controlAttr('home.font.highlightColor')}
			>
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
		</>
	);
}
