import type { PptxThemeColorRef, TextStyle } from 'pptx-viewer-core';
import type { ChangeCaseMode } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import type { ApplyToSelected } from './editor-apply-to-selected';
import {
	adjustFontSize,
	changeTextCase,
	clearFormatting,
	setCharacterSpacing,
	setFontFamily,
	setFontSize,
	setHighlightColor,
	setTextColor,
	toggleTextProp,
	toggleTextShadow,
} from './editor-format-mutations';
import {
	adjustIndent,
	setColumnCount,
	setLineSpacing,
	setTextAlign,
	setTextDirection,
	toggleListType,
} from './editor-paragraph-mutations';
import { recordRecentColor } from './editor-recent-colors';

/**
 * Character + paragraph formatting actions for the ribbon's Home > Font and
 * Home > Paragraph groups. Every method is a thin `applyToSelected` wrapper
 * around the pure builders in `editor-format-mutations.ts` /
 * `editor-paragraph-mutations.ts`; this file owns none of the mutation logic
 * itself, only the selection/history wiring shared by the whole action set.
 */
export interface TextActions {
	toggleBold(): void;
	toggleItalic(): void;
	toggleUnderline(): void;
	toggleStrikethrough(): void;
	toggleTextShadow(): void;
	changeFontSize(delta: number): void;
	setFontSize(size: number): void;
	setFontFamily(family: string): void;
	setTextColor(color: string, ref?: PptxThemeColorRef): void;
	setHighlightColor(color: string): void;
	setCharacterSpacing(value: number): void;
	changeCase(mode: ChangeCaseMode): void;
	clearFormatting(): void;
	toggleBulletList(): void;
	toggleNumberedList(): void;
	increaseIndent(): void;
	decreaseIndent(): void;
	setTextAlign(align: TextStyle['align']): void;
	setLineSpacing(value: number): void;
	setTextDirection(direction: TextStyle['textDirection']): void;
	setColumnCount(count: number): void;
}

export function createTextActions(
	store: Store<ViewerState>,
	applyToSelected: ApplyToSelected,
): TextActions {
	return {
		toggleBold: () => applyToSelected((el) => toggleTextProp(el, 'bold')),
		toggleItalic: () => applyToSelected((el) => toggleTextProp(el, 'italic')),
		toggleUnderline: () => applyToSelected((el) => toggleTextProp(el, 'underline')),
		toggleStrikethrough: () => applyToSelected((el) => toggleTextProp(el, 'strikethrough')),
		toggleTextShadow: () => applyToSelected((el) => toggleTextShadow(el)),
		changeFontSize: (delta) => applyToSelected((el) => adjustFontSize(el, delta)),
		setFontSize: (size) => applyToSelected((el) => setFontSize(el, size)),
		setFontFamily: (family) => applyToSelected((el) => setFontFamily(el, family)),
		setTextColor: (color, ref) => {
			recordRecentColor(store, color);
			applyToSelected((el) => setTextColor(el, color, ref));
		},
		setHighlightColor: (color) => {
			recordRecentColor(store, color);
			applyToSelected((el) => setHighlightColor(el, color));
		},
		setCharacterSpacing: (value) => applyToSelected((el) => setCharacterSpacing(el, value)),
		changeCase: (mode) => applyToSelected((el) => changeTextCase(el, mode)),
		clearFormatting: () => applyToSelected((el) => clearFormatting(el)),
		toggleBulletList: () => applyToSelected((el) => toggleListType(el, 'bullet')),
		toggleNumberedList: () => applyToSelected((el) => toggleListType(el, 'numbered')),
		increaseIndent: () => applyToSelected((el) => adjustIndent(el, 1)),
		decreaseIndent: () => applyToSelected((el) => adjustIndent(el, -1)),
		setTextAlign: (align) => applyToSelected((el) => setTextAlign(el, align)),
		setLineSpacing: (value) => applyToSelected((el) => setLineSpacing(el, value)),
		setTextDirection: (direction) => applyToSelected((el) => setTextDirection(el, direction)),
		setColumnCount: (count) => applyToSelected((el) => setColumnCount(el, count)),
	};
}
