import type { RibbonControlId, RibbonGroupId } from './customization/ribbon-control-ids';

/** Home group families that share one framework-neutral view. */
export type RibbonHomeFamily = 'clipboard' | 'font' | 'paragraph' | 'editing';

export interface RibbonHomeControlSpec {
	readonly id: RibbonControlId;
	readonly labelKey: string;
	readonly fallback: string;
	/** Framework-neutral test hook preserved from the migrated markup. */
	readonly testId?: string;
}

export interface RibbonHomeFamilySpec {
	/** Present when the element renders the whole group (wrapper and caption). */
	readonly group?: { id: RibbonGroupId; captionKey: string; fallback: string };
	/** Each cluster is one joined strip of buttons. */
	readonly clusters: readonly (readonly RibbonHomeControlSpec[])[];
}

export interface RibbonHomeControlState {
	disabled?: boolean;
	/** Omit for ordinary commands; a boolean reflects `aria-pressed`. */
	pressed?: boolean;
	hidden?: boolean;
}

export interface RibbonHomeViewState {
	/** Missing entries are enabled, unpressed and visible. */
	controls: Readonly<Partial<Record<RibbonControlId, RibbonHomeControlState>>>;
	translate?: (key: string) => string;
}

export interface RibbonHomeIntent {
	id: RibbonControlId;
}

const control = (
	id: RibbonControlId,
	labelKey: string,
	fallback: string,
	testId?: string,
): RibbonHomeControlSpec => ({ id, labelKey, fallback, testId });

export const RIBBON_HOME_FAMILIES: Readonly<Record<RibbonHomeFamily, RibbonHomeFamilySpec>> = {
	clipboard: {
		group: { id: 'home.clipboard', captionKey: 'pptx.ribbon.clipboard', fallback: 'Clipboard' },
		clusters: [
			[
				control('home.clipboard.paste', 'pptx.arrange.paste', 'Paste'),
				control('home.clipboard.cut', 'pptx.arrange.cut', 'Cut'),
				control('home.clipboard.copy', 'pptx.arrange.copy', 'Copy'),
				control(
					'home.clipboard.formatPainter',
					'pptx.arrange.formatPainter',
					'Format Painter',
					'format-painter-toggle',
				),
			],
		],
	},
	font: {
		clusters: [
			[
				control('home.font.bold', 'pptx.textPanel.bold', 'Bold'),
				control('home.font.italic', 'pptx.textPanel.italic', 'Italic'),
				control('home.font.underline', 'pptx.textPanel.underline', 'Underline'),
				control('home.font.strikethrough', 'pptx.textPanel.strikethrough', 'Strikethrough'),
			],
			[control('home.font.shadow', 'pptx.textEffects.shadow', 'Text Shadow')],
			[
				control('home.font.increaseFontSize', 'pptx.text.increaseFontSize', 'Increase Font Size'),
				control('home.font.decreaseFontSize', 'pptx.text.decreaseFontSize', 'Decrease Font Size'),
				control('home.font.clearFormatting', 'pptx.text.clearFormatting', 'Clear Formatting'),
			],
		],
	},
	paragraph: {
		clusters: [
			[
				control('home.paragraph.decreaseIndent', 'pptx.text.decreaseIndent', 'Decrease Indent'),
				control('home.paragraph.increaseIndent', 'pptx.text.increaseIndent', 'Increase Indent'),
			],
			[
				control('home.paragraph.alignLeft', 'pptx.ribbon.alignLeft', 'Align Left'),
				control('home.paragraph.alignCenter', 'pptx.ribbon.alignCenter', 'Center'),
				control('home.paragraph.alignRight', 'pptx.ribbon.alignRight', 'Align Right'),
				control('home.paragraph.justify', 'pptx.ribbon.justify', 'Justify'),
			],
		],
	},
	editing: {
		clusters: [
			[
				control('home.editing.find', 'pptx.editing.find', 'Find'),
				control('home.editing.replace', 'pptx.ribbon.replace', 'Replace'),
			],
		],
	},
};

export function homeFamilyControls(family: RibbonHomeFamily): readonly RibbonHomeControlSpec[] {
	return RIBBON_HOME_FAMILIES[family].clusters.flat();
}

export function homeLabel(state: RibbonHomeViewState, key: string, fallback: string): string {
	const value = state.translate?.(key);
	return value && value !== key ? value : fallback;
}

/** Reject unknown ids and disabled or hidden controls, however the intent arrived. */
export function canRequestHome(
	family: RibbonHomeFamily,
	state: RibbonHomeViewState,
	intent: RibbonHomeIntent,
): boolean {
	if (!homeFamilyControls(family).some((spec) => spec.id === intent.id)) {
		return false;
	}
	const current = state.controls[intent.id];
	return !current?.disabled && !current?.hidden;
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

/** Find and Replace open the host's find panel, so they are always available. */
export function editingHomeControls(): RibbonHomeViewState['controls'] {
	return { 'home.editing.find': {}, 'home.editing.replace': {} };
}
