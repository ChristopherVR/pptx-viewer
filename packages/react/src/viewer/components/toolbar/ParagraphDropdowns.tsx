import type { TextStyle } from 'pptx-viewer-core';
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LuColumns3 } from 'react-icons/lu';

import { RibbonMenu } from './RibbonMenu';
import { ic, pill } from './toolbar-constants';

interface DropdownProps {
	canMut: boolean;
	canFormat: boolean;
	effectiveTs?: Partial<TextStyle>;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
}

type SimpleDropdownProps = Omit<DropdownProps, 'effectiveTs'>;

const LINE_SPACING_OPTIONS = [
	{ label: '1.0', value: 1.0 },
	{ label: '1.15', value: 1.15 },
	{ label: '1.5', value: 1.5 },
	{ label: '2.0', value: 2.0 },
	{ label: '2.5', value: 2.5 },
	{ label: '3.0', value: 3.0 },
];

const TEXT_DIRECTION_OPTIONS: Array<{ label: string; value: TextStyle['textDirection'] }> = [
	{ label: 'Horizontal', value: 'horizontal' },
	{ label: 'Rotate 90\u00B0', value: 'vertical' },
	{ label: 'Rotate 270\u00B0', value: 'vertical270' },
	{ label: 'Stacked', value: 'wordArtVert' },
];

const COLUMN_OPTIONS = [
	{ label: '1 Column', value: 1 },
	{ label: '2 Columns', value: 2 },
	{ label: '3 Columns', value: 3 },
];

function useCloseOnClickOutside(
	ref: React.RefObject<HTMLDivElement | null>,
	open: boolean,
	setOpen: (v: boolean) => void,
) {
	useEffect(() => {
		if (!open) {
			return;
		}
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [open, ref, setOpen]);
}

export function LineSpacingDropdown(p: DropdownProps): React.ReactElement {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useCloseOnClickOutside(ref, open, setOpen);

	return (
		<div className='relative' ref={ref}>
			<button
				type='button'
				disabled={!p.canMut}
				onMouseDown={(e) => e.preventDefault()}
				onClick={() => setOpen((v) => !v)}
				className={pill}
				title={t('pptx.paragraph.lineSpacing')}
				aria-label={t('pptx.paragraph.lineSpacing')}
			>
				<svg className={ic} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
					<line x1='5' y1='5' x2='19' y2='5' />
					<line x1='5' y1='12' x2='19' y2='12' />
					<line x1='5' y1='19' x2='19' y2='19' />
					<path d='M2 8 L2 3 M2 3 L3.5 4.5 M2 3 L0.5 4.5' />
					<path d='M2 16 L2 21 M2 21 L3.5 19.5 M2 21 L0.5 19.5' />
				</svg>
			</button>
			{open && (
				<RibbonMenu anchorRef={ref} className='pt-1'>
					<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1 w-28'>
						{LINE_SPACING_OPTIONS.map((opt) => (
							<button
								key={opt.value}
								type='button'
								className='flex items-center w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors'
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => {
									if (!p.canFormat) {
										return;
									}
									p.onUpdateTextStyle({ lineSpacing: opt.value });
									setOpen(false);
								}}
							>
								{opt.label}
								{p.effectiveTs?.lineSpacing === opt.value && (
									<span className='ml-auto text-primary'>&bull;</span>
								)}
							</button>
						))}
					</div>
				</RibbonMenu>
			)}
		</div>
	);
}

export function TextDirectionDropdown(p: SimpleDropdownProps): React.ReactElement {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useCloseOnClickOutside(ref, open, setOpen);

	return (
		<div className='relative' ref={ref}>
			<button
				type='button'
				disabled={!p.canMut}
				onMouseDown={(e) => e.preventDefault()}
				onClick={() => setOpen((v) => !v)}
				className={pill}
				title={t('pptx.paragraph.textDirection')}
				aria-label={t('pptx.paragraph.textDirection')}
			>
				<svg className={ic} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
					<text x='3' y='16' fontSize='12' fill='currentColor' stroke='none'>
						A
					</text>
					<path d='M18 6 C21 6 21 10 18 10' />
					<path d='M18 10 L19.5 8.5 M18 10 L16.5 8.5' />
				</svg>
			</button>
			{open && (
				<RibbonMenu anchorRef={ref} className='pt-1'>
					<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1 w-36'>
						{TEXT_DIRECTION_OPTIONS.map((opt) => (
							<button
								key={opt.value}
								type='button'
								className='flex items-center w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors'
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => {
									if (!p.canFormat) {
										return;
									}
									p.onUpdateTextStyle({ textDirection: opt.value });
									setOpen(false);
								}}
							>
								{opt.label}
							</button>
						))}
					</div>
				</RibbonMenu>
			)}
		</div>
	);
}

export function ColumnsDropdown(p: SimpleDropdownProps): React.ReactElement {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useCloseOnClickOutside(ref, open, setOpen);

	return (
		<div className='relative' ref={ref}>
			<button
				type='button'
				disabled={!p.canMut}
				onMouseDown={(e) => e.preventDefault()}
				onClick={() => setOpen((v) => !v)}
				className={pill}
				title={t('pptx.paragraph.columns')}
			>
				<LuColumns3 className={ic} />
			</button>
			{open && (
				<RibbonMenu anchorRef={ref} className='pt-1'>
					<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1 w-28'>
						{COLUMN_OPTIONS.map((opt) => (
							<button
								key={opt.value}
								type='button'
								className='flex items-center w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors'
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => {
									if (!p.canFormat) {
										return;
									}
									p.onUpdateTextStyle({ columnCount: opt.value });
									setOpen(false);
								}}
							>
								{opt.label}
							</button>
						))}
					</div>
				</RibbonMenu>
			)}
		</div>
	);
}
