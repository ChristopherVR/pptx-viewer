/**
 * Text-inset rects for the `actionButton*` family (all 12 share the identical plain-rectangle `rect`).
 *
 * Transcribed verbatim from ECMA-376's `presetShapeDefinitions.xml` `<rect>`
 * element (the same source, same method as `preset-connection-sites-*.ts`).
 * See `preset-text-rect-types.ts` for why this is a separate override table
 * rather than an edit to `preset-shape-definitions-*.ts`.
 *
 * @module render/preset-text-rect-action-buttons
 */
import type { PresetTextRectDefinition } from './preset-text-rect-types';

export const ACTION_BUTTON_TEXT_RECTS: Record<string, PresetTextRectDefinition> = {
	actionButtonBackPrevious: {
		rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	},

	actionButtonBeginning: {
		rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	},

	actionButtonBlank: {
		rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	},

	actionButtonDocument: {
		rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	},

	actionButtonEnd: {
		rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	},

	actionButtonForwardNext: {
		rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	},

	actionButtonHelp: {
		rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	},

	actionButtonHome: {
		rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	},

	actionButtonInformation: {
		rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	},

	actionButtonMovie: {
		rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	},

	actionButtonReturn: {
		rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	},

	actionButtonSound: {
		rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	},
};
