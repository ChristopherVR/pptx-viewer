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
		position?: string;
	};
}

function findKey(obj: XmlObject, local: string, getLocalName: GetLocalName): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === local);
}

function boolVal(on: boolean | undefined): XmlObject {
	return { '@_val': on ? '1' : '0' };
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
	if (existing) {
		for (const local of ['numFmt', 'spPr', 'txPr']) {
			const k = findKey(existing, local, getLocalName);
			if (k) {
				built[k] = existing[k];
			}
		}
	}
	if (opts.position) {
		built['c:dLblPos'] = { '@_val': opts.position };
	}
	built['c:showLegendKey'] = boolVal(opts.showLegendKey);
	built['c:showVal'] = boolVal(opts.showValue);
	built['c:showCatName'] = boolVal(opts.showCategory);
	built['c:showSerName'] = boolVal(opts.showSeriesName);
	built['c:showPercent'] = boolVal(opts.showPercent);
	built['c:showBubbleSize'] = boolVal(false);
	return built;
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
			const off: XmlObject = { 'c:delete': { '@_val': '1' } };
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
			opts.showLegendKey;
		const effective = anyFlag ? opts : { ...opts, showValue: true };

		const existing = existingKey ? (container[existingKey] as XmlObject) : undefined;
		// A previously-disabled dLbls (<c:delete/>) carries no styling to keep.
		const base = existing && !findKey(existing, 'delete', getLocalName) ? existing : undefined;
		const built = buildDLbls(base, effective, getLocalName);

		if (existingKey) {
			container[existingKey] = built;
		} else {
			insertAfterLastSeries(container, built, getLocalName);
		}
	}
}
