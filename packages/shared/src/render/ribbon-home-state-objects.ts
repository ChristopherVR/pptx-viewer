import type { RibbonHomeLayoutModel, RibbonHomeViewState } from './ribbon-home-spec';
import type { HomeColourInput } from './ribbon-home-state';
import { homeColourState } from './ribbon-home-state';

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
	/** Layout gallery content: the New Slide caret shows it without a current tile. */
	layouts?: RibbonHomeLayoutModel;
}

/** Slides group gating; the host still opens the layout popovers and runs every edit. */
export function slidesHomeControls(input: SlidesHomeInput): RibbonHomeViewState['controls'] {
	const locked = !input.editable;
	const noSlide = input.resetNeedsSlide && !input.hasSlides;
	return {
		'home.slides.newSlide': {
			disabled: locked || (input.newSlideNeedsLayout && !input.hasLayouts),
			layouts: input.layouts && { ...input.layouts, current: undefined },
		},
		'home.slides.newSlide#caret': { disabled: locked, hidden: !input.hasLayouts },
		'home.slides.slideTemplates': { disabled: locked, hidden: !input.showTemplates },
		'home.slides.layout': { disabled: locked || !input.hasLayouts, layouts: input.layouts },
		'home.slides.reset': { disabled: locked || noSlide },
		'home.slides.section': { disabled: locked || noSlide },
	};
}

export interface DrawingHomeInput {
	editable: boolean;
	hasSelection: boolean;
	/** Shape type of the Shapes menu's current choice, marked in the list. */
	shapeType?: string;
	/** Shape Fill and Shape Outline popovers; omit to offer no colour data. */
	fill?: HomeColourInput;
	outline?: HomeColourInput;
}

/** Shapes inserts, so it needs only edit rights; the other triggers act on the selection. */
export function drawingHomeControls(input: DrawingHomeInput): RibbonHomeViewState['controls'] {
	const noTarget = !input.editable || !input.hasSelection;
	return {
		'home.drawing.shapes': { disabled: !input.editable, value: input.shapeType },
		'home.drawing.arrange': { disabled: noTarget },
		'home.drawing.shapeFill': input.fill
			? homeColourState(noTarget, input.fill)
			: { disabled: noTarget },
		'home.drawing.shapeOutline': input.outline
			? homeColourState(noTarget, input.outline)
			: { disabled: noTarget },
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
