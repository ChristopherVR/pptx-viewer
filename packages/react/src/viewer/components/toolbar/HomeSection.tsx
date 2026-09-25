import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxLayoutOption, PptxLayoutPreview } from 'pptx-viewer-core';
import {
	COMMON_FONT_SIZES,
	resolveDefaultFontFamily,
	textFontSizePtToPx,
	textFontSizePxToPt,
} from 'pptx-viewer-shared';
import type { SlideTemplateId } from 'pptx-viewer-shared';
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown } from 'react-icons/lu';

import type { ElementClipboardPayload, TableCellEditorState } from '../../types';
import { ClipboardGroup } from './ClipboardGroup';
import { FontFamilyMenu } from './FontFamilyMenu';
import { controlAttr, groupAttr } from './PowerPointRibbonControls';
import { RibbonMenu } from './RibbonMenu';
import { SlidesGroup } from './SlidesGroup';
import { sep } from './toolbar-constants';

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
	tableEditorState?: TableCellEditorState | null;
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
		fontSize:
			fontSize !== undefined && fontSize !== null
				? String(textFontSizePxToPt(fontSize))
				: defaults.fontSize,
	};
}

export function HomeSection(p: HomeSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const [fontMenuOpen, setFontMenuOpen] = useState(false);
	const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
	const fontMenuRef = useRef<HTMLDivElement>(null);
	const sizeMenuRef = useRef<HTMLDivElement>(null);
	const { fontFamily, fontSize } = extractFontInfo(p.selectedElement, p.themeFonts);
	// Cut and Copy act on the selection, so with nothing selected they are
	// no-ops. They used to render live anyway, which offered the user a button
	// that could not do anything and disagreed with the Svelte binding.
	const hasSelection = Boolean(p.selectedElement);
	const canFormat =
		p.canEdit &&
		Boolean(p.onUpdateTextStyle) &&
		Boolean(
			p.selectedElement &&
			(hasTextProperties(p.selectedElement) ||
				(p.selectedElement.type === 'table' && p.tableEditorState)),
		);
	useEffect(() => {
		if (!canFormat) {
			setFontMenuOpen(false);
			setSizeMenuOpen(false);
		}
	}, [canFormat]);

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
			<ClipboardGroup
				canEdit={p.canEdit}
				hasSelection={hasSelection}
				canPaste={Boolean(p.clipboardPayload)}
				formatPainterActive={p.formatPainterActive}
				canActivateFormatPainter={p.canActivateFormatPainter}
				onCopy={p.onCopy}
				onCut={p.onCut}
				onPaste={p.onPaste}
				onToggleFormatPainter={p.onToggleFormatPainter}
			/>

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
			<div className='flex flex-col items-center gap-0.5' {...groupAttr('home.font')}>
				<div className='flex items-center gap-1'>
					<div className='relative' ref={fontMenuRef} {...controlAttr('home.font.fontFamily')}>
						<button
							type='button'
							onClick={() => setFontMenuOpen((v) => !v)}
							disabled={!canFormat}
							// Named explicitly: the trigger's only text is the CURRENT font, so
							// without this it announces itself as "Segoe UI" and neither a screen
							// reader nor a role+name query can find the control it actually is.
							aria-label={t('pptx.ribbon.fontFamily')}
							className='inline-flex items-center justify-between px-2 py-1 rounded-sm border border-border/60 bg-background/60 text-[11px] text-foreground min-w-[120px] truncate enabled:hover:bg-accent/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
						>
							<span className='truncate'>{fontFamily}</span>
							<LuChevronDown className='w-3 h-3 ml-1 shrink-0 text-muted-foreground' />
						</button>
						{fontMenuOpen && canFormat && (
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
					<div className='relative' ref={sizeMenuRef} {...controlAttr('home.font.fontSize')}>
						<button
							type='button'
							onClick={() => setSizeMenuOpen((v) => !v)}
							disabled={!canFormat}
							// Same reason as the font trigger above: its text is the current size.
							aria-label={t('pptx.ribbon.fontSize')}
							className='inline-flex items-center justify-between px-2 py-1 rounded-sm border border-border/60 bg-background/60 text-[11px] text-foreground min-w-[50px] text-center enabled:hover:bg-accent/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
						>
							<span className='truncate'>{fontSize}</span>
							<LuChevronDown className='w-3 h-3 ml-1 shrink-0 text-muted-foreground' />
						</button>
						{sizeMenuOpen && canFormat && (
							<RibbonMenu anchorRef={sizeMenuRef} className='flex flex-col w-48 pt-1'>
								<div className='rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1 max-h-60 overflow-y-auto'>
									{COMMON_FONT_SIZES.map((s) => (
										<button
											key={s}
											type='button'
											className='flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors'
											onClick={() => {
												p.onUpdateTextStyle?.({
													fontSize:
														p.selectedElement && hasTextProperties(p.selectedElement)
															? textFontSizePtToPx(s)
															: s,
												});
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
				<span className='text-[9px] text-muted-foreground leading-none'>
					{t('pptx.ribbon.font')}
				</span>
			</div>

			{sep}
		</>
	);
}
