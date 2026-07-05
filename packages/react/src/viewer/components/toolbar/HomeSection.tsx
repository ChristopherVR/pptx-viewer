import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import React, { useState, useRef, useEffect } from 'react';
import { LuChevronDown, LuClipboardPaste, LuCopy, LuPaintbrush, LuScissors } from 'react-icons/lu';

import type { ElementClipboardPayload } from '../../types';
import { cn } from '../../utils';
import { SlidesGroup } from './SlidesGroup';
import { gB, gL, grp, ic, sep } from './toolbar-constants';

export interface HomeSectionProps {
	canEdit: boolean;
	clipboardPayload: ElementClipboardPayload | null;
	formatPainterActive?: boolean;
	canActivateFormatPainter?: boolean;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onToggleFormatPainter?: () => void;
	layoutOptions: Array<{ path: string; name: string }>;
	onInsertSlideFromLayout: (path: string, name?: string) => void;
	onApplyLayout?: (path: string) => void;
	onResetSlide?: () => void;
	onAddSection?: () => void;
	selectedElement?: PptxElement | null;
	onUpdateTextStyle?: (style: Record<string, unknown>) => void;
}

function extractFontInfo(element?: PptxElement | null): { fontFamily: string; fontSize: string } {
	const defaults = { fontFamily: 'Segoe UI', fontSize: '24' };
	if (!element) {
		return defaults;
	}
	if (!hasTextProperties(element)) {
		return defaults;
	}

	const segStyle = element.textSegments?.[0]?.style;
	const textStyle = element.textStyle;

	const fontFamily = segStyle?.fontFamily ?? textStyle?.fontFamily ?? defaults.fontFamily;
	const fontSize = segStyle?.fontSize ?? textStyle?.fontSize;

	return {
		fontFamily,
		fontSize: fontSize !== undefined && fontSize !== null ? String(fontSize) : defaults.fontSize,
	};
}

const COMMON_FONTS = [
	'Arial',
	'Calibri',
	'Cambria',
	'Comic Sans MS',
	'Courier New',
	'Georgia',
	'Helvetica',
	'Impact',
	'Segoe UI',
	'Tahoma',
	'Times New Roman',
	'Trebuchet MS',
	'Verdana',
];

const COMMON_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72, 96];

export function HomeSection(p: HomeSectionProps): React.ReactElement {
	const [fontMenuOpen, setFontMenuOpen] = useState(false);
	const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
	const [copiedFeedback, setCopiedFeedback] = useState(false);
	const [cutFeedback, setCutFeedback] = useState(false);
	const fontMenuRef = useRef<HTMLDivElement>(null);
	const sizeMenuRef = useRef<HTMLDivElement>(null);
	const { fontFamily, fontSize } = extractFontInfo(p.selectedElement);

	// Close font menu on outside click
	useEffect(() => {
		if (!fontMenuOpen) {
			return;
		}
		const handler = (e: MouseEvent) => {
			if (fontMenuRef.current && !fontMenuRef.current.contains(e.target as Node)) {
				setFontMenuOpen(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [fontMenuOpen]);

	// Close size menu on outside click
	useEffect(() => {
		if (!sizeMenuOpen) {
			return;
		}
		const handler = (e: MouseEvent) => {
			if (sizeMenuRef.current && !sizeMenuRef.current.contains(e.target as Node)) {
				setSizeMenuOpen(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [sizeMenuOpen]);

	return (
		<>
			{/* Clipboard group */}
			<div className='flex flex-col items-center gap-0.5'>
				<div className={grp}>
					<button
						type='button'
						onClick={p.onPaste}
						disabled={!p.clipboardPayload || !p.canEdit}
						className={gB}
						title='Paste'
					>
						<LuClipboardPaste className={ic} />
					</button>
					<button
						type='button'
						onClick={() => {
							p.onCut();
							setCutFeedback(true);
							setTimeout(() => setCutFeedback(false), 600);
						}}
						disabled={!p.canEdit}
						className={cn(gB, cutFeedback && 'bg-green-600/20 text-green-400')}
						title='Cut'
					>
						<LuScissors className={ic} />
					</button>
					<button
						type='button'
						onClick={() => {
							p.onCopy();
							setCopiedFeedback(true);
							setTimeout(() => setCopiedFeedback(false), 600);
						}}
						className={cn(gB, copiedFeedback && 'bg-green-600/20 text-green-400')}
						title='Copy'
					>
						<LuCopy className={ic} />
					</button>
					{p.onToggleFormatPainter && (
						<button
							type='button'
							onClick={p.onToggleFormatPainter}
							disabled={
								!p.canEdit || (p.canActivateFormatPainter === false && !p.formatPainterActive)
							}
							data-testid='format-painter-toggle'
							data-active={p.formatPainterActive ? 'true' : 'false'}
							className={cn(
								gL,
								p.formatPainterActive ? 'bg-amber-600 hover:bg-amber-500 text-amber-50' : '',
							)}
							title='Format Painter'
						>
							<LuPaintbrush className={ic} />
						</button>
					)}
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>Clipboard</span>
			</div>

			{sep}

			<SlidesGroup
				canEdit={p.canEdit}
				layoutOptions={p.layoutOptions}
				onInsertSlideFromLayout={p.onInsertSlideFromLayout}
				onApplyLayout={p.onApplyLayout}
				onResetSlide={p.onResetSlide}
				onAddSection={p.onAddSection}
			/>

			{/* Font group */}
			<div className='flex flex-col items-center gap-0.5'>
				<div className='flex items-center gap-1'>
					<div className='relative' ref={fontMenuRef}>
						<button
							type='button'
							onClick={() => setFontMenuOpen((v) => !v)}
							className='inline-flex items-center justify-between px-2 py-1 rounded-sm border border-border/60 bg-background/60 text-[11px] text-foreground min-w-[120px] truncate hover:bg-accent/40 transition-colors cursor-pointer'
						>
							<span className='truncate'>{fontFamily}</span>
							<LuChevronDown className='w-3 h-3 ml-1 shrink-0 text-muted-foreground' />
						</button>
						{fontMenuOpen && (
							<div className='absolute left-0 top-full z-50 flex flex-col w-48 pt-1'>
								<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1 max-h-60 overflow-y-auto'>
									{COMMON_FONTS.map((f) => (
										<button
											key={f}
											type='button'
											className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
											style={{ fontFamily: f }}
											onClick={() => {
												p.onUpdateTextStyle?.({ fontFamily: f });
												setFontMenuOpen(false);
											}}
										>
											{f}
										</button>
									))}
								</div>
							</div>
						)}
					</div>
					<div className='relative' ref={sizeMenuRef}>
						<button
							type='button'
							onClick={() => setSizeMenuOpen((v) => !v)}
							className='inline-flex items-center justify-between px-2 py-1 rounded-sm border border-border/60 bg-background/60 text-[11px] text-foreground min-w-[50px] text-center hover:bg-accent/40 transition-colors cursor-pointer'
						>
							<span className='truncate'>{fontSize}</span>
							<LuChevronDown className='w-3 h-3 ml-1 shrink-0 text-muted-foreground' />
						</button>
						{sizeMenuOpen && (
							<div className='absolute left-0 top-full z-50 flex flex-col w-48 pt-1'>
								<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1 max-h-60 overflow-y-auto'>
									{COMMON_SIZES.map((s) => (
										<button
											key={s}
											type='button'
											className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
											onClick={() => {
												p.onUpdateTextStyle?.({ fontSize: s });
												setSizeMenuOpen(false);
											}}
										>
											{s}
										</button>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>Font</span>
			</div>

			{sep}
		</>
	);
}
