/**
 * action-buttons.ts: Action-button insertion (Insert > Action) shared across
 * bindings. Builds the OOXML built-in action-button shapes: a labelled
 * `#4472C4` button carrying a slide-navigation `actionClick` for the nav presets.
 */

import type { ActionButtonPreset, PptxElement } from 'pptx-viewer-core';

/** OOXML slide-show jump actions per default-action key. */
const JUMP_ACTION: Record<string, string> = {
	prevSlide: 'ppaction://hlinkshowjump?jump=previousslide',
	nextSlide: 'ppaction://hlinkshowjump?jump=nextslide',
	firstSlide: 'ppaction://hlinkshowjump?jump=firstslide',
	lastSlide: 'ppaction://hlinkshowjump?jump=lastslide',
};

/** The 12 OOXML built-in action buttons -> label + default nav jump (if any). */
const ACTION_BUTTONS: Record<string, { label: string; jump?: keyof typeof JUMP_ACTION }> = {
	actionButtonBackPrevious: { label: 'Back / Previous', jump: 'prevSlide' },
	actionButtonForwardNext: { label: 'Forward / Next', jump: 'nextSlide' },
	actionButtonBeginning: { label: 'Home / First', jump: 'firstSlide' },
	actionButtonEnd: { label: 'End / Last', jump: 'lastSlide' },
	actionButtonReturn: { label: 'Return', jump: 'prevSlide' },
	actionButtonHome: { label: 'Home', jump: 'firstSlide' },
	actionButtonHelp: { label: 'Help' },
	actionButtonInformation: { label: 'Information' },
	actionButtonDocument: { label: 'Document' },
	actionButtonSound: { label: 'Sound' },
	actionButtonMovie: { label: 'Movie' },
	actionButtonBlank: { label: 'Custom' },
};

/** Whether `shapeType` is a known OOXML action button. */
export function isActionButton(shapeType: string): boolean {
	return shapeType in ACTION_BUTTONS;
}

/**
 * Build an action-button `shape` element, or `null` for an unknown shape type.
 * The element is positioned at (0,0) at default size; the caller centres it.
 */
export function buildActionButtonElement(shapeType: string, id: string): PptxElement | null {
	const def = ACTION_BUTTONS[shapeType];
	if (!def) {
		return null;
	}
	const action = def.jump ? JUMP_ACTION[def.jump] : undefined;
	return {
		id,
		type: 'shape',
		x: 0,
		y: 0,
		width: 120,
		height: 50,
		shapeType,
		text: def.label,
		textStyle: { fontSize: 11, color: '#FFFFFF', align: 'center', vAlign: 'middle' },
		textSegments: [{ text: def.label, style: { fontSize: 11, color: '#FFFFFF', bold: true } }],
		shapeStyle: { fillColor: '#4472C4', strokeColor: '#2F5597', strokeWidth: 1 },
		...(action ? { actionClick: { action, tooltip: def.label, highlightClick: true } } : {}),
	} as unknown as PptxElement;
}

/**
 * The 12 OOXML built-in action-button presets (11 with glyphs + Blank): shape
 * type, label, default action, and an SVG `iconPath` glyph rendered inside the
 * button on the slide. Shared by every binding's Insert > Action gallery and
 * the on-canvas glyph overlay.
 */
export const ACTION_BUTTON_PRESETS: ActionButtonPreset[] = [
	{
		shapeType: 'actionButtonBackPrevious',
		label: 'Back / Previous',
		defaultAction: 'prevSlide',
		iconPath: 'M16 4 L4 12 L16 20 Z',
	},
	{
		shapeType: 'actionButtonForwardNext',
		label: 'Forward / Next',
		defaultAction: 'nextSlide',
		iconPath: 'M8 4 L20 12 L8 20 Z',
	},
	{
		shapeType: 'actionButtonBeginning',
		label: 'Home / First',
		defaultAction: 'firstSlide',
		iconPath: 'M4 4 L4 20 M6 12 L18 4 L18 20 Z',
	},
	{
		shapeType: 'actionButtonEnd',
		label: 'End / Last',
		defaultAction: 'lastSlide',
		iconPath: 'M20 4 L20 20 M18 12 L6 4 L6 20 Z',
	},
	{
		shapeType: 'actionButtonReturn',
		label: 'Return',
		defaultAction: 'prevSlide',
		iconPath: 'M18 8 L18 14 L6 14 M6 14 L10 10 M6 14 L10 18',
	},
	{
		shapeType: 'actionButtonHome',
		label: 'Home',
		defaultAction: 'firstSlide',
		// House: roof + body
		iconPath: 'M12 4 L20 11 L20 20 L14 20 L14 14 L10 14 L10 20 L4 20 L4 11 Z',
	},
	{
		shapeType: 'actionButtonHelp',
		label: 'Help',
		defaultAction: 'none',
		// Question mark
		iconPath: 'M9 9 a3 3 0 1 1 4 2.8 c-1 0.4 -1 1.2 -1 2 M12 17 v0.5',
	},
	{
		shapeType: 'actionButtonInformation',
		label: 'Information',
		defaultAction: 'none',
		// Lower-case "i": dot + body
		iconPath: 'M12 6 v0.01 M12 10 v8',
	},
	{
		shapeType: 'actionButtonDocument',
		label: 'Document',
		defaultAction: 'none',
		// Document with folded corner
		iconPath: 'M6 4 L14 4 L18 8 L18 20 L6 20 Z M14 4 L14 8 L18 8',
	},
	{
		shapeType: 'actionButtonSound',
		label: 'Sound',
		defaultAction: 'none',
		// Speaker cone + sound waves
		iconPath: 'M4 10 L4 14 L8 14 L12 18 L12 6 L8 10 Z M16 9 a4 4 0 0 1 0 6 M18 7 a7 7 0 0 1 0 10',
	},
	{
		shapeType: 'actionButtonMovie',
		label: 'Movie',
		defaultAction: 'none',
		// Film strip with play triangle
		iconPath: 'M4 6 L20 6 L20 18 L4 18 Z M10 9 L15 12 L10 15 Z',
	},
	{
		shapeType: 'actionButtonBlank',
		label: 'Custom',
		defaultAction: 'none',
		// No glyph: empty path. The button still renders as a rounded rect via clip-path.
		iconPath: '',
	},
];

/** Map from action-button shape type to its default action type. */
export const ACTION_BUTTON_DEFAULT_ACTIONS: Record<string, ActionButtonPreset['defaultAction']> =
	Object.fromEntries(ACTION_BUTTON_PRESETS.map((p) => [p.shapeType, p.defaultAction]));
