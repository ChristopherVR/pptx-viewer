/**
 * Builds a single `c:dLbl` node (one data point's label override) in schema
 * order, reusing the point's existing styling where the model doesn't
 * override it. Split out of `chart-series-datalabel-serializer.ts` (which
 * reconciles the whole `c:dLbls` list) to keep both files under the repo's
 * 300-line-per-file convention.
 *
 * @module utils/chart-series-datalabel-build
 */

import type { PptxChartDataLabel, XmlObject } from '../types';
import { applyChartManualLayout } from './chart-layout';

/** Resolve a possibly-prefixed XML key to its local name. */
export type GetLocalName = (key: string) => string;

export function findKey(
	obj: XmlObject,
	local: string,
	getLocalName: GetLocalName,
): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === local);
}

function boolVal(on: boolean | undefined): XmlObject {
	return { '@_val': on ? '1' : '0' };
}

const DLBL_ORDER = [
	'idx',
	'delete',
	'layout',
	'tx',
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
] as const;
const POSITIONS = new Set(['bestFit', 'b', 'ctr', 'inBase', 'inEnd', 'l', 'outEnd', 'r', 't']);

function mergeOrdered(
	existing: XmlObject | undefined,
	built: XmlObject,
	replaced: Set<string>,
	getLocalName: GetLocalName,
): XmlObject {
	const entries = Object.entries(existing ?? {}).filter(
		([key]) => !replaced.has(getLocalName(key)),
	);
	entries.push(...Object.entries(built));
	entries.sort(([a], [b]) => {
		const rank = (key: string) => {
			const index = DLBL_ORDER.indexOf(getLocalName(key) as (typeof DLBL_ORDER)[number]);
			return index < 0 ? DLBL_ORDER.length - 1 : index;
		};
		return rank(a) - rank(b);
	});
	return Object.fromEntries(entries) as XmlObject;
}

/** Build a single `c:dLbl` node (a per-data-point label override) in schema order. */
export function buildDLbl(
	existing: XmlObject | undefined,
	label: PptxChartDataLabel,
	getLocalName: GetLocalName,
): XmlObject {
	if (!Number.isInteger(label.idx) || label.idx < 0 || label.idx > 0xffffffff) {
		throw new RangeError('data label idx must be an unsigned 32-bit integer');
	}
	const node: XmlObject = {};
	const replaced = new Set([
		'idx',
		'delete',
		'dLblPos',
		'showLegendKey',
		'showVal',
		'showCatName',
		'showSerName',
		'showPercent',
		'showBubbleSize',
		'separator',
		'showLeaderLines',
	]);
	node['c:idx'] = { '@_val': String(label.idx) };

	// A modeled label with no content flags and no text is treated as a delete
	// override, which suppresses the auto label for that point.
	const hasShow =
		label.showVal !== undefined ||
		label.showCatName !== undefined ||
		label.showSerName !== undefined ||
		label.showPercent !== undefined ||
		label.showLegendKey !== undefined ||
		label.showBubbleSize !== undefined;
	const hasContent =
		hasShow ||
		label.position !== undefined ||
		label.text !== undefined ||
		label.separator !== undefined ||
		label.showLeaderLines !== undefined ||
		label.numberFormat !== undefined ||
		label.layout !== undefined;
	if (label.deleted === true || (!hasContent && label.deleted === undefined)) {
		node['c:delete'] = { '@_val': '1' };
		return mergeOrdered(existing, node, replaced, getLocalName);
	}
	if (label.deleted === false) {
		node['c:delete'] = { '@_val': '0' };
	}

	// Preserve existing layout/tx/numFmt/spPr/txPr styling when present, unless
	// the model supplies an overriding value for that piece.
	if (existing && label.layout === undefined) {
		const layoutKey = findKey(existing, 'layout', getLocalName);
		if (layoutKey) {
			node[layoutKey] = existing[layoutKey];
		}
	}
	if (label.layout !== undefined) {
		// `null` removes a dragged position back to automatic; an object writes
		// the manual coordinates. Either way the OLD c:layout (if any) must not
		// also survive via `existing`, hence adding it to `replaced`.
		replaced.add('layout');
		applyChartManualLayout(node, label.layout, getLocalName);
	}
	if (label.text !== undefined) {
		replaced.add('tx');
		node['c:tx'] = {
			'c:rich': {
				'a:bodyPr': {},
				'a:lstStyle': {},
				'a:p': { 'a:r': { 'a:t': label.text } },
			},
		};
	} else if (existing) {
		const txKey = findKey(existing, 'tx', getLocalName);
		if (txKey) {
			node[txKey] = existing[txKey];
		}
	}
	if (existing) {
		for (const local of ['numFmt', 'spPr', 'txPr']) {
			if (local === 'numFmt' && label.numberFormat !== undefined) {
				continue;
			}
			const k = findKey(existing, local, getLocalName);
			if (k) {
				node[k] = existing[k];
			}
		}
	}
	if (label.numberFormat !== undefined) {
		replaced.add('numFmt');
		node['c:numFmt'] = { '@_formatCode': label.numberFormat, '@_sourceLinked': '0' };
	}

	if (label.position !== undefined) {
		if (!POSITIONS.has(label.position)) {
			throw new RangeError(`Invalid data label position: ${label.position}`);
		}
		node['c:dLblPos'] = { '@_val': label.position };
	}
	if (label.showLegendKey !== undefined) {
		node['c:showLegendKey'] = boolVal(label.showLegendKey);
	}
	if (label.showVal !== undefined) {
		node['c:showVal'] = boolVal(label.showVal);
	}
	if (label.showCatName !== undefined) {
		node['c:showCatName'] = boolVal(label.showCatName);
	}
	if (label.showSerName !== undefined) {
		node['c:showSerName'] = boolVal(label.showSerName);
	}
	if (label.showPercent !== undefined) {
		node['c:showPercent'] = boolVal(label.showPercent);
	}
	if (label.showBubbleSize !== undefined) {
		node['c:showBubbleSize'] = boolVal(label.showBubbleSize);
	}
	if (label.separator !== undefined) {
		node['c:separator'] = label.separator;
	}
	if (label.showLeaderLines !== undefined) {
		node['c:showLeaderLines'] = boolVal(label.showLeaderLines);
	}
	return mergeOrdered(existing, node, replaced, getLocalName);
}
