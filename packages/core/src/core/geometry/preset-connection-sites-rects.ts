/**
 * Connection sites for the cut/rounded-corner rectangle family: `round1Rect`,
 * `round2DiagRect`, `round2SameRect`, `snip1Rect`, `snip2DiagRect`,
 * `snip2SameRect`, `snipRoundRect`. PowerPoint attaches these to the plain
 * edge midpoints/corners of the notional rectangle, not the cut corners.
 *
 * See `preset-connection-sites-quads.ts` for the provenance note; same source
 * (`presetShapeDefinitions.xml`), same transcription method.
 *
 * @module render/preset-connection-sites-rects
 */
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { CARDINAL_SITES, cxn } from './preset-connection-sites-types';

export const RECT_VARIANT_CONNECTION_SITES: Record<string, PresetConnectionSiteDefinition> = {
	round1Rect: { sites: CARDINAL_SITES },

	round2DiagRect: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	round2SameRect: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	snip1Rect: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	snip2DiagRect: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	snip2SameRect: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	snipRoundRect: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},
};
