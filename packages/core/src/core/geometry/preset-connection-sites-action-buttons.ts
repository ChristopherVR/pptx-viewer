/**
 * Connection sites for the `actionButton*` family (all 12 share the identical
 * plain-rectangle `cxnLst`, just in right/bottom/left/top document order rather
 * than this table's own `CARDINAL_SITES` top/left/bottom/right order, so `@idx`
 * still needs its own transcription per shape).
 *
 * See `preset-connection-sites-quads.ts` for the provenance note; same source
 * (`presetShapeDefinitions.xml`), same transcription method.
 *
 * @module render/preset-connection-sites-action-buttons
 */
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { cxn } from './preset-connection-sites-types';

export const ACTION_BUTTON_CONNECTION_SITES: Record<string, PresetConnectionSiteDefinition> = {
	actionButtonBackPrevious: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	actionButtonBeginning: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	actionButtonBlank: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	actionButtonDocument: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	actionButtonEnd: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	actionButtonForwardNext: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	actionButtonHelp: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	actionButtonHome: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	actionButtonInformation: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	actionButtonMovie: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	actionButtonReturn: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	actionButtonSound: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},
};
