/**
 * Pure serialization helper for writing per-data-point label overrides
 * (`c:dLbl`, keyed by `c:idx`) inside a series' `c:dLbls`, back into the parsed
 * chart XML on save.
 *
 * These individual overrides are distinct from the chart-level / series-level
 * data-label group settings (the `show*` flags). They appear ahead of the group
 * settings inside `c:dLbls`. Dependency-light (a `getLocalName` resolver only)
 * so it can be unit-tested directly and works for both prefixed (`c:dLbl`) and
 * namespace-stripped (`dLbl`) keys.
 *
 * Building one `c:dLbl` node is in the sibling `chart-series-datalabel-build.ts`
 * module (see its doc comment for why).
 *
 * @module utils/chart-series-datalabel-serializer
 */

import type { PptxChartDataLabel, XmlObject } from '../types';
import type { GetLocalName } from './chart-series-datalabel-build';
import { buildDLbl, findKey } from './chart-series-datalabel-build';

/** CT_Ser children that follow `c:dLbls` in schema order. */
const AFTER_DLBLS = new Set(['cat', 'val', 'xVal', 'yVal', 'bubbleSize', 'smooth', 'extLst']);

/** CT_DLbls group-level (non-`c:dLbl`) children, in schema order. */
const DLBLS_GROUP_ORDER = [
	'numFmt',
	'spPr',
	'txPr',
	'dLblPos',
	'showLegendKey',
	'showVal',
	'showCatName',
	'showSerName',
	'showPercent',
	'showBubbleSize',
	'separator',
	'showLeaderLines',
	'leaderLines',
	'extLst',
];

/**
 * Apply the model's per-data-point label overrides onto a `c:ser` node.
 *
 * Individual data-point labels live as `c:dLbl` children (each keyed by
 * `c:idx`) at the start of the series' `c:dLbls` element, ahead of the
 * series-level group settings. This reconciles them against the model:
 * matched `c:dLbl` nodes are rebuilt reusing their existing styling, new ones
 * are inserted in `c:idx` order, and unmodeled `c:dLbl` nodes are dropped. The
 * series-level group settings (numFmt/spPr/txPr/show flags) are preserved.
 *
 * An empty/undefined `dataLabels` removes all `c:dLbl` overrides but keeps the
 * `c:dLbls` group settings. Mutates `seriesNode` in place.
 */
export function applySeriesDataLabelsToXml(
	seriesNode: XmlObject,
	dataLabels: PptxChartDataLabel[] | undefined,
	getLocalName: GetLocalName,
): void {
	const dLblsKey = findKey(seriesNode, 'dLbls', getLocalName);
	const labels = dataLabels ?? [];

	// Index existing c:dLbl nodes by c:idx to reuse their styling.
	const existingByIdx = new Map<number, XmlObject>();
	let groupChildren: Array<readonly [string, XmlObject[keyof XmlObject]]> = [];
	if (dLblsKey) {
		const dLbls = seriesNode[dLblsKey] as XmlObject;
		const dLblKey = findKey(dLbls, 'dLbl', getLocalName);
		if (dLblKey) {
			const nodes = Array.isArray(dLbls[dLblKey])
				? (dLbls[dLblKey] as XmlObject[])
				: [dLbls[dLblKey] as XmlObject];
			for (const node of nodes) {
				const idxKey = findKey(node, 'idx', getLocalName);
				const idxNode = idxKey ? (node[idxKey] as XmlObject | undefined) : undefined;
				const idx = idxNode ? Number.parseInt(String(idxNode['@_val']), 10) : NaN;
				if (Number.isFinite(idx)) {
					existingByIdx.set(idx, node);
				}
			}
		}
		// Keep the group-level (non-dLbl) children to re-append after the dLbls.
		groupChildren = Object.keys(dLbls)
			.filter((k) => getLocalName(k) !== 'dLbl')
			.map((k) => [k, dLbls[k]] as const);
	}

	if (labels.length === 0 && groupChildren.length === 0) {
		// Nothing to write and no group settings to preserve: drop empty dLbls.
		if (dLblsKey) {
			delete seriesNode[dLblsKey];
		}
		return;
	}

	const built = [...labels]
		.sort((a, b) => a.idx - b.idx)
		.map((label) => buildDLbl(existingByIdx.get(label.idx), label, getLocalName));

	// Rebuild the c:dLbls: c:dLbl* first, then preserved group settings in order.
	const newDLbls: XmlObject = {};
	if (built.length > 0) {
		newDLbls['c:dLbl'] = built.length === 1 ? built[0] : built;
	}
	const ordered = [...groupChildren].sort((a, b) => {
		const ai = DLBLS_GROUP_ORDER.indexOf(getLocalName(a[0]));
		const bi = DLBLS_GROUP_ORDER.indexOf(getLocalName(b[0]));
		return (
			(ai === -1 ? DLBLS_GROUP_ORDER.length : ai) - (bi === -1 ? DLBLS_GROUP_ORDER.length : bi)
		);
	});
	for (const [k, v] of ordered) {
		newDLbls[k] = v;
	}

	if (dLblsKey) {
		seriesNode[dLblsKey] = newDLbls;
		return;
	}

	// Insert a new c:dLbls before the first following child in schema order.
	const keys = Object.keys(seriesNode);
	const beforeIdx = keys.findIndex((k) => AFTER_DLBLS.has(getLocalName(k)));
	const entries = keys.map((k) => [k, seriesNode[k]] as const);
	const at = beforeIdx === -1 ? entries.length : beforeIdx;
	entries.splice(at, 0, ['c:dLbls', newDLbls] as const);
	for (const k of keys) {
		delete seriesNode[k];
	}
	for (const [k, v] of entries) {
		seriesNode[k] = v;
	}
}
