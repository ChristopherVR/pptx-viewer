import type { PptxThemeColorRef } from 'pptx-viewer-core';

import type { RibbonHomeViewState } from './ribbon-home-spec';

export * from './ribbon-home-spec';
export * from './ribbon-home-state-objects';
export * from './ribbon-home-state-extras';
export * from './ribbon-home-menus';

/** A colour trigger's current value and the data its popover shows. */
export interface HomeColourInput {
	value: string;
	ref?: PptxThemeColorRef;
	/** Deck theme colour map; omit to hide the theme palette. */
	themeColors?: Readonly<Record<string, string>>;
	/** Recently used colours, newest first. */
	recent?: readonly string[];
}

export function homeColourState(disabled: boolean, input: HomeColourInput) {
	return {
		disabled,
		value: input.value,
		colour: { themeColors: input.themeColors, selectedRef: input.ref, recent: input.recent },
	};
}

export interface ClipboardHomeInput {
	editable: boolean;
	hasSelection: boolean;
	hasClipboard: boolean;
	formatPainterActive: boolean;
	/** The selection carries formatting the painter can pick up. */
	canFormatPaint: boolean;
	/** False when the host offers no Format Painter at all. */
	showFormatPainter: boolean;
}

/** Paste/Cut need edit rights; Copy needs only a selection; the painter stays armed to cancel. */
export function clipboardHomeControls(input: ClipboardHomeInput): RibbonHomeViewState['controls'] {
	return {
		'home.clipboard.paste': { disabled: !input.editable || !input.hasClipboard },
		'home.clipboard.cut': { disabled: !input.editable || !input.hasSelection },
		'home.clipboard.copy': { disabled: !input.hasSelection },
		'home.clipboard.formatPainter': {
			disabled: !input.editable || (!input.canFormatPaint && !input.formatPainterActive),
			pressed: input.formatPainterActive,
			hidden: !input.showFormatPainter,
		},
	};
}

export interface FontHomeInput {
	/** Text can be edited on the current selection. */
	enabled: boolean;
	bold: boolean;
	italic: boolean;
	underline: boolean;
	strikethrough: boolean;
	shadow: boolean;
	/** Font colour popover; omit when the host offers no colour picker. */
	fontColor?: HomeColourInput;
	/** Highlight popover (no theme palette). */
	highlight?: HomeColourInput;
	/** Current character spacing in 1/100 pt, marked in the menu. */
	characterSpacing?: number;
}

export function fontHomeControls(input: FontHomeInput): RibbonHomeViewState['controls'] {
	const disabled = !input.enabled;
	return {
		'home.font.bold': { disabled, pressed: input.bold },
		'home.font.italic': { disabled, pressed: input.italic },
		'home.font.underline': { disabled, pressed: input.underline },
		'home.font.strikethrough': { disabled, pressed: input.strikethrough },
		'home.font.shadow': { disabled, pressed: input.shadow },
		'home.font.increaseFontSize': { disabled },
		'home.font.decreaseFontSize': { disabled },
		'home.font.clearFormatting': { disabled },
		'home.font.characterSpacing': {
			disabled,
			value: String(input.characterSpacing ?? 0),
		},
		'home.font.changeCase': { disabled },
		...(input.fontColor && { 'home.font.fontColor': homeColourState(disabled, input.fontColor) }),
		...(input.highlight && {
			'home.font.highlightColor': homeColourState(disabled, {
				...input.highlight,
				themeColors: undefined,
			}),
		}),
	};
}

export type RibbonHomeAlign = 'left' | 'center' | 'right' | 'justify';

export interface ParagraphHomeInput {
	enabled: boolean;
	/** Omit when the binding cannot read the alignment, so no pressed state is reflected. */
	align?: RibbonHomeAlign;
	/** The selection's list kind: reflected as the Bullets or Numbering toggle being pressed. */
	list?: 'bullet' | 'numbered' | 'none';
	/** Current line spacing multiplier, columns and text direction, marked in their menus. */
	lineSpacing?: number;
	columns?: number;
	textDirection?: string;
}

export function paragraphHomeControls(input: ParagraphHomeInput): RibbonHomeViewState['controls'] {
	const disabled = !input.enabled;
	const pressed = (align: RibbonHomeAlign) =>
		input.align === undefined ? undefined : input.align === align;
	return {
		'home.paragraph.decreaseIndent': { disabled },
		'home.paragraph.increaseIndent': { disabled },
		'home.paragraph.alignLeft': { disabled, pressed: pressed('left') },
		'home.paragraph.alignCenter': { disabled, pressed: pressed('center') },
		'home.paragraph.alignRight': { disabled, pressed: pressed('right') },
		'home.paragraph.justify': { disabled, pressed: pressed('justify') },
		'home.paragraph.bullets': {
			disabled,
			pressed: input.list === undefined ? undefined : input.list === 'bullet',
		},
		'home.paragraph.numbering': {
			disabled,
			pressed: input.list === undefined ? undefined : input.list === 'numbered',
		},
		'home.paragraph.lineSpacing': {
			disabled,
			value: String(input.lineSpacing ?? 1),
		},
		'home.paragraph.textDirection': { disabled, value: input.textDirection ?? 'horizontal' },
		'home.paragraph.columns': {
			disabled,
			value: String(input.columns ?? 1),
		},
	};
}

/** Model-pixel step of one Decrease/Increase Indent press. */
export const RIBBON_HOME_INDENT_STEP = 24;

export type ParagraphHomeAction =
	| { kind: 'indent'; delta: number }
	| { kind: 'align'; align: RibbonHomeAlign };

const PARAGRAPH_ALIGN_BY_ID: Readonly<Record<string, RibbonHomeAlign>> = {
	'home.paragraph.alignLeft': 'left',
	'home.paragraph.alignCenter': 'center',
	'home.paragraph.alignRight': 'right',
	'home.paragraph.justify': 'justify',
};

/** What a Paragraph intent asks the host to do; undefined for ids this strip does not own. */
export function paragraphHomeAction(id: string): ParagraphHomeAction | undefined {
	if (id === 'home.paragraph.decreaseIndent') {
		return { kind: 'indent', delta: -RIBBON_HOME_INDENT_STEP };
	}
	if (id === 'home.paragraph.increaseIndent') {
		return { kind: 'indent', delta: RIBBON_HOME_INDENT_STEP };
	}
	const align = PARAGRAPH_ALIGN_BY_ID[id];
	return align ? { kind: 'align', align } : undefined;
}

/** Narrow a stored alignment to the four values the strip can show as pressed. */
export function paragraphHomeAlign(value: unknown): RibbonHomeAlign | undefined {
	return value === 'left' || value === 'center' || value === 'right' || value === 'justify'
		? value
		: undefined;
}

/**
 * Find and Replace open the host's find panel, so they are always available.
 * Pass `findOpen` when the host can tell whether that panel is showing and
 * both buttons reflect it as pressed; omit it to show no pressed state.
 */
export function editingHomeControls(
	input: { findOpen?: boolean; selectAll?: boolean } = {},
): RibbonHomeViewState['controls'] {
	const state = { pressed: input.findOpen };
	return {
		'home.editing.find': { ...state },
		'home.editing.replace': { ...state },
		'home.editing.select': { disabled: input.selectAll === false },
	};
}
