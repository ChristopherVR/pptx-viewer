import type { RibbonHomeViewState } from './ribbon-home-spec';

export * from './ribbon-home-spec';

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
	};
}

export type RibbonHomeAlign = 'left' | 'center' | 'right' | 'justify';

export interface ParagraphHomeInput {
	enabled: boolean;
	/** Omit when the binding cannot read the alignment, so no pressed state is reflected. */
	align?: RibbonHomeAlign;
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
	input: { findOpen?: boolean } = {},
): RibbonHomeViewState['controls'] {
	const state = { pressed: input.findOpen };
	return { 'home.editing.find': { ...state }, 'home.editing.replace': { ...state } };
}

export interface SlidesHomeInput {
	editable: boolean;
	/** The deck offers at least one layout to choose from. */
	hasLayouts: boolean;
	hasSlides: boolean;
	/** False hides Slide Templates for hosts that cannot insert a template. */
	showTemplates: boolean;
	/** New Slide inserts the first layout, so some hosts disable it without layouts. */
	newSlideNeedsLayout: boolean;
	/** Reset and Section need an existing slide in hosts that cannot add one to an empty deck. */
	resetNeedsSlide: boolean;
	/** Native popovers currently open, mirrored as `aria-expanded`. */
	layoutOpen?: boolean;
	newSlideOpen?: boolean;
}

/** Slides group gating; the host still opens the layout popovers and runs every edit. */
export function slidesHomeControls(input: SlidesHomeInput): RibbonHomeViewState['controls'] {
	const locked = !input.editable;
	const noSlide = input.resetNeedsSlide && !input.hasSlides;
	return {
		'home.slides.newSlide': {
			disabled: locked || (input.newSlideNeedsLayout && !input.hasLayouts),
		},
		'home.slides.newSlide#caret': {
			disabled: locked,
			hidden: !input.hasLayouts,
			expanded: Boolean(input.newSlideOpen),
		},
		'home.slides.slideTemplates': { disabled: locked, hidden: !input.showTemplates },
		'home.slides.layout': {
			disabled: locked || !input.hasLayouts,
			expanded: Boolean(input.layoutOpen),
		},
		'home.slides.reset': { disabled: locked || noSlide },
		'home.slides.section': { disabled: locked || noSlide },
	};
}

export interface DrawingHomeInput {
	editable: boolean;
	hasSelection: boolean;
	/** Native popovers currently open, mirrored as `aria-expanded`. */
	open?: Partial<Record<'shapes' | 'arrange' | 'fill' | 'outline', boolean>>;
}

/** Shapes inserts, so it needs only edit rights; the other triggers act on the selection. */
export function drawingHomeControls(input: DrawingHomeInput): RibbonHomeViewState['controls'] {
	const noTarget = !input.editable || !input.hasSelection;
	const open = input.open ?? {};
	return {
		'home.drawing.shapes': { disabled: !input.editable, expanded: Boolean(open.shapes) },
		'home.drawing.arrange': { disabled: noTarget, expanded: Boolean(open.arrange) },
		'home.drawing.shapeFill': { disabled: noTarget, expanded: Boolean(open.fill) },
		'home.drawing.shapeOutline': { disabled: noTarget, expanded: Boolean(open.outline) },
	};
}

export interface ArrangeHomeInput {
	editable: boolean;
	hasSelection: boolean;
	/** The selection holds enough elements to distribute (host-specific threshold). */
	canDistribute: boolean;
}

/** Arrange, flip, order, duplicate and delete act on a selection the user may edit. */
export function arrangeHomeControls(input: ArrangeHomeInput): RibbonHomeViewState['controls'] {
	const disabled = !input.editable || !input.hasSelection;
	const distribute = { disabled: !input.editable || !input.canDistribute };
	const controls: Record<string, { disabled: boolean }> = {
		'home.arrange.flipHorizontal': { disabled },
		'home.arrange.flipVertical': { disabled },
		'home.arrange.sendBackward': { disabled },
		'home.arrange.bringForward': { disabled },
		'home.arrange.sendToBack': { disabled },
		'home.arrange.bringToFront': { disabled },
		'home.arrange.duplicate': { disabled },
		'home.arrange.delete': { disabled },
		'home.arrange.align#distribute-horizontal': distribute,
		'home.arrange.align#distribute-vertical': distribute,
	};
	for (const edge of ['left', 'centerH', 'right', 'top', 'middle', 'bottom']) {
		controls[`home.arrange.align#${edge}`] = { disabled };
	}
	return controls;
}

/** Decode an Align strip intent: an alignment edge, or a distribute axis. */
export function arrangeAlignAction(
	part: string | undefined,
):
	| { kind: 'align'; edge: 'left' | 'centerH' | 'right' | 'top' | 'middle' | 'bottom' }
	| { kind: 'distribute'; axis: 'horizontal' | 'vertical' }
	| undefined {
	if (part === 'distribute-horizontal') {
		return { kind: 'distribute', axis: 'horizontal' };
	}
	if (part === 'distribute-vertical') {
		return { kind: 'distribute', axis: 'vertical' };
	}
	return part === 'left' ||
		part === 'centerH' ||
		part === 'right' ||
		part === 'top' ||
		part === 'middle' ||
		part === 'bottom'
		? { kind: 'align', edge: part }
		: undefined;
}
