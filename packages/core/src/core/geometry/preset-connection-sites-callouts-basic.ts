/**
 * Connection sites for the basic (line-leader) callout family: `accentBorderCallout1-3`,
 * `accentCallout1-3`, `borderCallout1-3`, `callout1-3`, `cloudCallout`.
 *
 * See `preset-connection-sites-quads.ts` for the provenance note; same source
 * (`presetShapeDefinitions.xml`), same transcription method.
 *
 * @module render/preset-connection-sites-callouts-basic
 */
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { cxn, gd } from './preset-connection-sites-types';

export const CALLOUT_CONNECTION_SITES: Record<string, PresetConnectionSiteDefinition> = {
	accentBorderCallout1: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	accentBorderCallout2: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	accentBorderCallout3: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	accentCallout1: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	accentCallout2: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	accentCallout3: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	borderCallout1: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	borderCallout2: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	borderCallout3: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	callout1: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	callout2: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	callout3: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	cloudCallout: {
		avLst: { adj1: -20833, adj2: 62500 },
		gdLst: [
			gd('dxPos', '*/ w adj1 100000'),
			gd('dyPos', '*/ h adj2 100000'),
			gd('xPos', '+- hc dxPos 0'),
			gd('yPos', '+- vc dyPos 0'),
			gd('g27', '*/ w 67 21600'),
			gd('g28', '*/ h 21577 21600'),
			gd('g29', '*/ w 21582 21600'),
			gd('g30', '*/ h 1235 21600'),
		],
		sites: [
			cxn('cd2', 'g27', 'vc'),
			cxn('cd4', 'hc', 'g28'),
			cxn('0', 'g29', 'vc'),
			cxn('3cd4', 'hc', 'g30'),
			cxn('pang', 'xPos', 'yPos'),
		],
	},
};
