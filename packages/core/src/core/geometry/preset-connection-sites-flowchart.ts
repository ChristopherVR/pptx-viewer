/**
 * Connection sites for the ANSI flowchart preset family (`flowChart*`).
 *
 * Most flowchart shapes are box-like enough that PowerPoint's own `cxnLst`
 * for them is the plain 4 cardinal edge midpoints (already this app's
 * fallback), so those presets are listed only so `getPresetConnectionSites`
 * has a hit and future audits can see they were checked, not skipped. The
 * ones whose sites are NOT the cardinal fallback (`flowChartDocument`'s
 * wavy bottom edge, the circular connectors, the parallelogram-ish I/O
 * shapes) carry the extra `gdLst` guides their `cxnLst` needs.
 *
 * See `preset-connection-sites-quads.ts` for the provenance note; same source
 * (`presetShapeDefinitions.xml`), same transcription method.
 *
 * @module render/preset-connection-sites-flowchart
 */
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { CARDINAL_SITES, cxn, gd } from './preset-connection-sites-types';

/** `il`/`it`/`ir`/`ib` for the circular flowchart connectors (same as `ellipse`). */
const CIRCLE_GUIDES = [
	gd('idx', 'cos wd2 2700000'),
	gd('idy', 'sin hd2 2700000'),
	gd('il', '+- hc 0 idx'),
	gd('ir', '+- hc idx 0'),
	gd('it', '+- vc 0 idy'),
	gd('ib', '+- vc idy 0'),
];
const CIRCLE_SITES = [
	cxn('3cd4', 'hc', 't'),
	cxn('3cd4', 'il', 'it'),
	cxn('cd2', 'l', 'vc'),
	cxn('cd4', 'il', 'ib'),
	cxn('cd4', 'hc', 'b'),
	cxn('cd4', 'ir', 'ib'),
	cxn('0', 'r', 'vc'),
	cxn('3cd4', 'ir', 'it'),
];

const CARDINAL: PresetConnectionSiteDefinition = { sites: CARDINAL_SITES };

export const FLOWCHART_CONNECTION_SITES: Record<string, PresetConnectionSiteDefinition> = {
	flowChartProcess: CARDINAL,
	flowChartDecision: CARDINAL,
	flowChartTerminator: CARDINAL,
	flowChartPredefinedProcess: CARDINAL,
	flowChartInternalStorage: CARDINAL,
	flowChartPreparation: CARDINAL,
	flowChartManualInput: CARDINAL,
	flowChartOffpageConnector: CARDINAL,
	flowChartPunchedCard: CARDINAL,
	flowChartSort: CARDINAL,
	flowChartDelay: CARDINAL,
	flowChartMagneticTape: CARDINAL,
	// hd3 is a builtin (short-side-family divisor), so no extra gdLst needed.
	flowChartMagneticDisk: CARDINAL,
	flowChartDisplay: CARDINAL,
	flowChartAlternateProcess: CARDINAL,

	flowChartDocument: {
		gdLst: [gd('y2', '*/ h 20172 21600')],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'hc', 'y2'),
			cxn('0', 'r', 'vc'),
		],
	},

	flowChartMultidocument: {
		gdLst: [
			gd('y8', '*/ h 20782 21600'),
			gd('x3', '*/ w 9298 21600'),
			gd('x4', '*/ w 12286 21600'),
		],
		sites: [
			cxn('3cd4', 'x4', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'x3', 'y8'),
			cxn('0', 'r', 'vc'),
		],
	},

	flowChartManualOperation: {
		gdLst: [gd('x4', '*/ w 9 10')],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'wd10', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'x4', 'vc'),
		],
	},

	flowChartConnector: { gdLst: CIRCLE_GUIDES, sites: CIRCLE_SITES },
	flowChartSummingJunction: { gdLst: CIRCLE_GUIDES, sites: CIRCLE_SITES },
	flowChartOr: { gdLst: CIRCLE_GUIDES, sites: CIRCLE_SITES },

	flowChartPunchedTape: {
		gdLst: [gd('y2', '*/ h 9 10')],
		sites: [
			cxn('3cd4', 'hc', 'hd10'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'hc', 'y2'),
			cxn('0', 'r', 'vc'),
		],
	},

	flowChartCollate: {
		sites: [cxn('3cd4', 'hc', 't'), cxn('3cd4', 'hc', 'vc'), cxn('cd4', 'hc', 'b')],
	},

	flowChartExtract: {
		gdLst: [gd('x2', '*/ w 3 4')],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'wd4', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'x2', 'vc'),
		],
	},

	flowChartMerge: {
		gdLst: [gd('x2', '*/ w 3 4')],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'wd4', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'x2', 'vc'),
		],
	},

	flowChartOnlineStorage: {
		gdLst: [gd('x2', '*/ w 5 6')],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'x2', 'vc'),
		],
	},

	flowChartMagneticDrum: {
		gdLst: [gd('x2', '*/ w 2 3')],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'x2', 'vc'),
			cxn('0', 'r', 'vc'),
		],
	},

	flowChartInputOutput: {
		gdLst: [gd('x3', '*/ w 2 5'), gd('x4', '*/ w 3 5'), gd('x6', '*/ w 9 10')],
		sites: [
			cxn('3cd4', 'x4', 't'),
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'wd10', 'vc'),
			cxn('cd4', 'x3', 'b'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'x6', 'vc'),
		],
	},

	flowChartOfflineStorage: {
		gdLst: [gd('x4', '*/ w 3 4')],
		sites: [
			cxn('0', 'x4', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'wd4', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},
};
