import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxLayoutOption, PptxLayoutPreview } from 'pptx-viewer-core';
import { resolveDefaultFontFamily } from 'pptx-viewer-shared';
import type { SlideTemplateId } from 'pptx-viewer-shared';
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuClipboardPaste, LuCopy, LuPaintbrush, LuScissors } from 'react-icons/lu';

import type { ElementClipboardPayload } from '../../types';
import { cn } from '../../utils';
import { FontFamilyMenu } from './FontFamilyMenu';
import { RibbonMenu } from './RibbonMenu';
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
	layoutOptions: PptxLayoutOption[];
	/** Marks the active tile in the Layout menu. */
	currentLayoutPath?: string;
	/** Supplies gallery artwork; without it the menus stay name-only. */
	loadLayoutPreviews?: () => Promise<PptxLayoutPreview[]>;
	onInsertSlideFromLayout: (path: string, name?: string) => void;
	onInsertSlideFromTemplate?: (templateId: SlideTemplateId) => void;
	templateScheme?: Record<string, string>;
	onApplyLayout?: (path: string) => void;
	onResetSlide?: () => void;
	onAddSection?: () => void;
	selectedElement?: PptxElement | null;
	onUpdateTextStyle?: (style: Record<string, unknown>) => void;
	/** Theme major/minor latin faces, leading the font dropdown. */
	themeFonts?: { heading?: string; body?: string };
	/** Families the deck embeds, offered as their own dropdown group. */
	embeddedFontFamilies?: readonly string[];
	/** Families registered this session via File > Options > Fonts. */
	customFontFamilies?: readonly string[];
}

/**
 * What the font name / size boxes should display for the current selection.
 *
 * With nothing overriding it on the element, the box shows the family the deck
 * would actually render: the theme's major font inside a title placeholder and
 * its minor font elsewhere. It used to show a hardcoded "Segoe UI", which
 * misreported every themed deck.
 */
function extractFontInfo(
	element: PptxElement | null | undefined,
	themeFonts: { heading?: string; body?: string } | undefined,
): { fontFamily: string; fontSize: string } {
	const placeholderType = (element as { placeholderType?: string } | null | undefined)
		?.placeholderType;
	const defaults = {
		fontFamily: resolveDefaultFontFamily(placeholderType, themeFonts),
		fontSize: '24',
	};
	if (!element || !hasTextProperties(element)) {
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

const COMMON_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72, 96];

export function HomeSection(p: HomeSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const [fontMenuOpen, setFontMenuOpen] = useState(false);
	const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
	const [copiedFeedback, setCopiedFeedback] = useState(false);
	const [cutFeedback, setCutFeedback] = useState(false);
	const fontMenuRef = useRef<HTMLDivElement>(null);
	const sizeMenuRef = useRef<HTMLDivElement>(null);
	const { fontFamily, fontSize } = extractFontInfo(p.selectedElement, p.themeFonts);
	// Cut and Copy act on the selection, so with nothing selected they are
	// no-ops. They used to render live anyway, which offered the user a button
	// that could not do anything and disagreed with the Svelte binding.
	const hasSelection = Boolean(p.selectedElement);

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
						title={t('pptx.arrange.paste')}
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
						disabled={!p.canEdit || !hasSelection}
						className={cn(gB, cutFeedback && 'bg-green-600/20 text-green-400')}
						title={t('pptx.arrange.cut')}
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
						disabled={!hasSelection}
						className={cn(gB, copiedFeedback && 'bg-green-600/20 text-green-400')}
						title={t('pptx.arrange.copy')}
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
							title={t('pptx.arrange.formatPainter')}
						>
							<LuPaintbrush className={ic} />
						</button>
					)}
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>
					{t('pptx.ribbon.clipboard')}
				</span>
			</div>

			{sep}

			<SlidesGroup
				canEdit={p.canEdit}
				layoutOptions={p.layoutOptions}
				currentLayoutPath={p.currentLayoutPath}
				loadLayoutPreviews={p.loadLayoutPreviews}
				onInsertSlideFromLayout={p.onInsertSlideFromLayout}
				onInsertSlideFromTemplate={p.onInsertSlideFromTemplate}
				templateScheme={p.templateScheme}
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
							// Named explicitly: the trigger's only text is the CURRENT font, so
							// without this it announces itself as "Segoe UI" and neither a screen
							// reader nor a role+name query can find the control it actually is.
							aria-label={t('pptx.ribbon.fontFamily')}
							className='inline-flex items-center justify-between px-2 py-1 rounded-sm border border-border/60 bg-background/60 text-[11px] text-foreground min-w-[120px] truncate hover:bg-accent/40 transition-colors cursor-pointer'
						>
							<span className='truncate'>{fontFamily}</span>
							<LuChevronDown className='w-3 h-3 ml-1 shrink-0 text-muted-foreground' />
						</button>
						{fontMenuOpen && (
							<FontFamilyMenu
								anchorRef={fontMenuRef}
								themeFonts={p.themeFonts}
								embeddedFonts={p.embeddedFontFamilies}
								customFonts={p.customFontFamilies}
								onSelect={(family) => {
									p.onUpdateTextStyle?.({ fontFamily: family });
									setFontMenuOpen(false);
								}}
							/>
						)}
					</div>
					<div className='relative' ref={sizeMenuRef}>
						<button
							type='button'
							onClick={() => setSizeMenuOpen((v) => !v)}
							// Same reason as the font trigger above: its text is the current size.
							aria-label={t('pptx.ribbon.fontSize')}
							className='inline-flex items-center justify-between px-2 py-1 rounded-sm border border-border/60 bg-background/60 text-[11px] text-foreground min-w-[50px] text-center hover:bg-accent/40 transition-colors cursor-pointer'
						>
							<span className='truncate'>{fontSize}</span>
							<LuChevronDown className='w-3 h-3 ml-1 shrink-0 text-muted-foreground' />
						</button>
						{sizeMenuOpen && (
							<RibbonMenu anchorRef={sizeMenuRef} className='flex flex-col w-48 pt-1'>
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
							</RibbonMenu>
						)}
					</div>
				</div>
				<span className='text-[9px] text-muted-foreground leading-none'>Font</span>
			</div>

			{sep}
		</>
	);
}
