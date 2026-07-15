/**
 * Pure serialization helper for writing a chart's chart-level data labels
 * (`c:dLbls` directly under each chart-type container, applying to every
 * series) back into the parsed chart XML tree on save.
 *
 * Dependency-light (only a `getLocalName` resolver) so it works for both
 * prefixed (`c:dLbls`) and namespace-stripped (`dLbls`) keys and can be
 * unit-tested without a full save round-trip.
 *
 * @module utils/chart-data-labels-serializer
 */

import type { XmlObject } from '../types';

/** Resolve a possibly-prefixed XML key to its local name. */
type GetLocalName = (key: string) => string;

/** The data-label-relevant subset of `PptxChartStyle`. */
export interface ChartDataLabelStyle {
	hasDataLabels?: boolean;
	dataLabels?: {
		showValue?: boolean;
		showCategory?: boolean;
		showSeriesName?: boolean;
		showPercent?: boolean;
		showLegendKey?: boolean;
		showBubbleSize?: boolean;
		separator?: string;
		showLeaderLines?: boolean;
		position?: string;
	};
}

const POSITION_VALUES = new Set([
	'bestFit',
	'b',
	'ctr',
	'inBase',
	'inEnd',
	'l',
	'outEnd',
	'r',
	't',
]);
const CHILD_ORDER = [
	'dLbl',
	'delete',
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
const MODELED = new Set([
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

function findKey(obj: XmlObject, local: string, getLocalName: GetLocalName): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === local);
}

function boolVal(on: boolean | undefined): XmlObject {
	return { '@_val': on ? '1' : '0' };
}

function ordered(
	existing: XmlObject | undefined,
	modeled: XmlObject,
	getLocalName: GetLocalName,
): XmlObject {
	const entries = Object.entries(existing ?? {}).filter(([key]) => !MODELED.has(getLocalName(key)));
	entries.push(...Object.entries(modeled));
	entries.sort(([a], [b]) => {
		const rank = (key: string) => {
			const index = CHILD_ORDER.indexOf(getLocalName(key) as (typeof CHILD_ORDER)[number]);
			return index < 0 ? CHILD_ORDER.length - 1 : index;
		};
		return rank(a) - rank(b);
	});
	return Object.fromEntries(entries) as XmlObject;
}

/** Insert `c:dLbls` after the last `c:ser` child (schema order), preserving key order. */
function insertAfterLastSeries(
	container: XmlObject,
	dLbls: XmlObject,
	getLocalName: GetLocalName,
): void {
	const keys = Object.keys(container);
	let lastSer = -1;
	keys.forEach((k, i) => {
		if (getLocalName(k) === 'ser') {
			lastSer = i;
		}
	});
	const entries = keys.map((k) => [k, container[k]] as const);
	const at = lastSer === -1 ? entries.length : lastSer + 1;
	entries.splice(at, 0, ['c:dLbls', dLbls] as const);
	for (const k of keys) {
		delete container[k];
	}
	for (const [k, v] of entries) {
		container[k] = v;
	}
}

/**
 * Build a `c:dLbls` element from the requested options. Preserves an existing
 * node's `numFmt`/`spPr`/`txPr` styling (in schema order) and then writes the
 * `dLblPos` and `show*` flags in schema order.
 */
function buildDLbls(
	existing: XmlObject | undefined,
	opts: NonNullable<ChartDataLabelStyle['dataLabels']>,
	getLocalName: GetLocalName,
): XmlObject {
	const built: XmlObject = {};
	if (opts.position) {
		if (!POSITION_VALUES.has(opts.position)) {
			throw new RangeError(`Invalid data label position: ${opts.position}`);
		}
		built['c:dLblPos'] = { '@_val': opts.position };
	}
	built['c:showLegendKey'] = boolVal(opts.showLegendKey);
	built['c:showVal'] = boolVal(opts.showValue);
	built['c:showCatName'] = boolVal(opts.showCategory);
	built['c:showSerName'] = boolVal(opts.showSeriesName);
	built['c:showPercent'] = boolVal(opts.showPercent);
	built['c:showBubbleSize'] = boolVal(opts.showBubbleSize);
	if (opts.separator !== undefined) {
		built['c:separator'] = opts.separator;
	}
	if (opts.showLeaderLines !== undefined) {
		built['c:showLeaderLines'] = boolVal(opts.showLeaderLines);
	}
	return ordered(existing, built, getLocalName);
}

/**
 * Apply chart-level data-label visibility/content onto the plot area.
 *
 * - `style.hasDataLabels === true` writes a `c:dLbls` under every chart-type
 *   container with the requested `show*` flags and optional `dLblPos`,
 *   defaulting to showing the value when no content flag is set.
 * - `style.hasDataLabels === false` disables labels via `<c:dLbls><c:delete
 *   val="1"/></c:dLbls>`.
 * - `undefined` leaves the chart untouched so unedited charts round-trip via
 *   the original XML.
 *
 * Mutates `plotArea` in place.
 */
export function applyChartDataLabelsToXml(
	plotArea: XmlObject,
	style: ChartDataLabelStyle,
	getLocalName: GetLocalName,
): void {
	if (style.hasDataLabels === undefined) {
		return;
	}

	const chartTypeKeys = Object.keys(plotArea).filter((k) => getLocalName(k).endsWith('Chart'));
	for (const ctKey of chartTypeKeys) {
		const container = plotArea[ctKey] as XmlObject | undefined;
		if (!container || typeof container !== 'object') {
			continue;
		}
		const existingKey = findKey(container, 'dLbls', getLocalName);

		if (style.hasDataLabels === false) {
			const existing = existingKey ? (container[existingKey] as XmlObject) : undefined;
			const off = ordered(existing, { 'c:delete': { '@_val': '1' } }, getLocalName);
			if (existingKey) {
				container[existingKey] = off;
			} else {
				insertAfterLastSeries(container, off, getLocalName);
			}
			continue;
		}

		const opts = style.dataLabels ?? {};
		const anyFlag =
			opts.showValue ||
			opts.showCategory ||
			opts.showSeriesName ||
			opts.showPercent ||
			opts.showLegendKey ||
			opts.showBubbleSize;
		const effective = anyFlag ? opts : { ...opts, showValue: true };

		const existing = existingKey ? (container[existingKey] as XmlObject) : undefined;
		const built = buildDLbls(existing, effective, getLocalName);

		if (existingKey) {
			container[existingKey] = built;
		} else {
			insertAfterLastSeries(container, built, getLocalName);
		}
	}
}
