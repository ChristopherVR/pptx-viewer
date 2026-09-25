import type { TextStyle } from 'pptx-viewer-core';
import { CHARACTER_SPACING_OPTIONS } from 'pptx-viewer-shared';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { ChangeCaseMode } from '../../utils/text-case-transform';
import { controlAttr } from './PowerPointRibbonControls';
import { RibbonMenu } from './RibbonMenu';
import { ic, pill } from './toolbar-constants';

export interface TextSpacingCaseMenusProps {
	canMut: boolean;
	canFormat: boolean;
	isTable: boolean;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
	onTransformTextCase: (mode: ChangeCaseMode) => void;
}

/** Home > Font's Character Spacing and Change Case (Aa) dropdowns. */
export function TextSpacingCaseMenus(p: TextSpacingCaseMenusProps): React.ReactElement {
	const { t } = useTranslation();
	const { canMut, canFormat, isTable } = p;
	const charSpacingRef = useRef<HTMLDivElement>(null);
	const changeCaseRef = useRef<HTMLDivElement>(null);
	return (
		<>
			{/* Character Spacing */}
			<div
				className='relative group'
				ref={charSpacingRef}
				{...controlAttr('home.font.characterSpacing')}
			>
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
						<text x='4' y='16' fontSize='11' fontWeight='bold' fill='currentColor' stroke='none'>
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
			<div className='relative group' ref={changeCaseRef} {...controlAttr('home.font.changeCase')}>
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
						<text x='2' y='16' fontSize='13' fontWeight='bold' fill='currentColor' stroke='none'>
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
		</>
	);
}
