/**
 * Connection sites for `bracePair`, `bracketPair`, `leftBrace`, `leftBracket`,
 * `rightBrace`, `rightBracket`.
 *
 * See `preset-connection-sites-quads.ts` for the provenance note; same source
 * (`presetShapeDefinitions.xml`), same transcription method.
 *
 * @module render/preset-connection-sites-braces
 */
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { CARDINAL_SITES, cxn, gd } from './preset-connection-sites-types';

export const BRACE_CONNECTION_SITES: Record<string, PresetConnectionSiteDefinition> = {
	bracePair: { sites: CARDINAL_SITES },

	bracketPair: { sites: CARDINAL_SITES },

	leftBrace: {
		avLst: { adj2: 50000 },
		gdLst: [gd('a2', 'pin 0 adj2 100000'), gd('y3', '*/ h a2 100000')],
		sites: [cxn('cd4', 'r', 't'), cxn('cd2', 'l', 'y3'), cxn('3cd4', 'r', 'b')],
	},

	leftBracket: {
		sites: [cxn('cd4', 'r', 't'), cxn('cd2', 'l', 'vc'), cxn('3cd4', 'r', 'b')],
	},

	rightBrace: {
		avLst: { adj2: 50000 },
		gdLst: [gd('a2', 'pin 0 adj2 100000'), gd('y3', '*/ h a2 100000')],
		sites: [cxn('cd4', 'l', 't'), cxn('cd2', 'r', 'y3'), cxn('3cd4', 'l', 'b')],
	},

	rightBracket: {
		sites: [cxn('cd4', 'l', 't'), cxn('3cd4', 'l', 'b'), cxn('cd2', 'r', 'vc')],
	},
};
