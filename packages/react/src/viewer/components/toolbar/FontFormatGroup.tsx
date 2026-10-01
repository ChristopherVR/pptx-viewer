import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { fontHomeControls, nextToggleValue, textFontSizePtToPx } from 'pptx-viewer-shared';
import React, { useCallback, useMemo } from 'react';

import type { TableCellEditorState } from '../../types';
import { isTextDecorationFlag, textSectionFlags } from './text-section-state';
import { WebHomeControls } from './WebHomeControls';

export interface FontFormatGroupProps {
	canMut: boolean;
	canFormat: boolean;
	isTextEl: boolean;
	selectedElement: PptxElement | null;
	tableEditorState?: TableCellEditorState | null;
	effectiveTs?: Partial<TextStyle>;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
}

const TEXT_SHADOW_ON = {
	textShadowColor: '#000000',
	textShadowBlur: 2,
	textShadowOffsetX: 1,
	textShadowOffsetY: 1,
	textShadowOpacity: 0.5,
};
const TEXT_SHADOW_OFF = {
	textShadowColor: undefined,
	textShadowBlur: undefined,
	textShadowOffsetX: undefined,
	textShadowOffsetY: undefined,
};

/**
 * Home > Font: the character toggles, Text Shadow, font-size steps and Clear
 * Formatting as the shared strip. The edits themselves, including the
 * run-level tri-state read at click time, stay with this binding.
 */
export function FontFormatGroup(p: FontFormatGroupProps): React.ReactElement {
	const { canMut, canFormat, isTextEl, selectedElement, tableEditorState, effectiveTs } = p;
	const { onUpdateTextStyle } = p;
	// Pressed state over the whole element; the DOM selection is only read at
	// click time, since the ribbon does not re-render as the caret moves.
	const flags = textSectionFlags(selectedElement, tableEditorState, false);
	const shadow = Boolean(effectiveTs?.textShadowColor);
	const controls = useMemo(
		() =>
			fontHomeControls({
				enabled: canMut && canFormat,
				bold: flags.bold === 'on',
				italic: flags.italic === 'on',
				underline: flags.underline === 'on',
				strikethrough: flags.strikethrough === 'on',
				shadow,
			}),
		[canMut, canFormat, flags.bold, flags.italic, flags.underline, flags.strikethrough, shadow],
	);
	const request = useCallback(
		(id: string) => {
			if (!canFormat || !selectedElement) {
				return;
			}
			const flag = id.replace('home.font.', '');
			if (isTextDecorationFlag(flag)) {
				// Decide from the runs the user selected (shared tri-state), not from
				// the body style: `!ts?.bold` could never un-bold a run-level bold word.
				const current = textSectionFlags(selectedElement, tableEditorState, true);
				onUpdateTextStyle({ [flag]: nextToggleValue(current[flag]) });
				return;
			}
			const textual = isTextEl;
			const current = effectiveTs?.fontSize ?? (textual ? textFontSizePtToPx(18) : 18);
			const delta = textual ? textFontSizePtToPx(2) : 2;
			switch (id) {
				case 'home.font.shadow':
					onUpdateTextStyle(shadow ? TEXT_SHADOW_OFF : TEXT_SHADOW_ON);
					break;
				case 'home.font.increaseFontSize':
					onUpdateTextStyle({ fontSize: current + delta });
					break;
				case 'home.font.decreaseFontSize':
					onUpdateTextStyle({
						fontSize: Math.max(textual ? textFontSizePtToPx(1) : 1, current - delta),
					});
					break;
				case 'home.font.clearFormatting':
					onUpdateTextStyle({
						bold: false,
						italic: false,
						underline: false,
						strikethrough: false,
						highlightColor: undefined,
					});
			}
		},
		[
			canFormat,
			selectedElement,
			tableEditorState,
			isTextEl,
			effectiveTs,
			shadow,
			onUpdateTextStyle,
		],
	);
	return <WebHomeControls family='font' controls={controls} onRequest={request} />;
}
