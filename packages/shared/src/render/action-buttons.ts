/**
 * action-buttons.ts: Action-button insertion (Insert > Action) shared across
 * bindings. Builds the OOXML built-in action-button shapes: a labelled
 * `#4472C4` button carrying a slide-navigation `actionClick` for the nav presets.
 */

import type { PptxElement } from 'pptx-viewer-core';

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
