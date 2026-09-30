import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxLayoutOption, PptxLayoutPreview } from 'pptx-viewer-core';
import {
	resolveDefaultFontFamily,
	textFontSizePtToPx,
	textFontSizePxToPt,
} from 'pptx-viewer-shared';
import type { SlideTemplateId } from 'pptx-viewer-shared';
import React from 'react';

import type { ElementClipboardPayload, TableCellEditorState } from '../../types';
import { ClipboardGroup } from './ClipboardGroup';
import { FontPickers } from './FontPickers';
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

			<FontPickers
				enabled={canFormat}
				fontFamily={fontFamily}
				fontSize={fontSize}
				themeFonts={p.themeFonts}
				embeddedFonts={p.embeddedFontFamilies}
				customFonts={p.customFontFamilies}
				onFamily={(family) => p.onUpdateTextStyle?.({ fontFamily: family })}
				onSize={(size) =>
					p.onUpdateTextStyle?.({
						fontSize:
							p.selectedElement && hasTextProperties(p.selectedElement)
								? textFontSizePtToPx(size)
								: size,
					})
				}
			/>

			{sep}
		</>
	);
}
