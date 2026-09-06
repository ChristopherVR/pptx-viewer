/**
 * chart-filtered-series-writer.ts: the save-side counterpart to
 * `chart-filtered-series.ts`'s parser. Until now `PptxChartData.filteredSeries`
 * was read-mostly: the extension only ever survived save as opaque passthrough
 * on an otherwise-untouched chart part. The chart editor's "hide"/"show
 * series" actions (`pptx-viewer-shared`'s `hideChartSeries`/
 * `restoreFilteredSeries`) actually CHANGE this array, so it now needs a
 * writer or a hide/restore round trip would silently lose the change on save.
 *
 * A newly-hidden series has no real cell-range formula (it was a normal
 * plotted series a moment ago), so its `c15:ser/c:tx`/`c:cat`/`c:val` are
 * written as LITERAL values (`c15:v`, `c:strLit`, `c:numLit`), the same forms
 * `chart-xml-generator.ts` already uses for a brand-new SDK-created series,
 * rather than `c:strRef`/`c:numRef` (which require a `c:f` formula this
 * codebase does not track for a filtered entry).
 *
 * @module utils/chart-filtered-series-writer
 */
import type { PptxChartFilteredSeries, XmlObject } from '../types';
import { CHART_FILTERED_SERIES_EXT_URI, parseFilteredSeries } from './chart-filtered-series';

export type GetLocalName = (key: string) => string;

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
}

function findKey(obj: XmlObject, local: string, getLocalName: GetLocalName): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === local);
}

function points(values: string[]): XmlObject[] {
	return values.map((v, i) => ({ '@_idx': String(i), 'c:v': v }));
}

/** Wrapper element local name for this chart-type container, e.g. `barChart` -> `filteredBarSeries`. */
function wrapperLocalName(containerLocalName: string): string {
	const base = containerLocalName.replace(/Chart$/u, '');
	return `filtered${base.charAt(0).toUpperCase()}${base.slice(1)}Series`;
}

function buildFilteredSerNode(entry: PptxChartFilteredSeries, categories: string[]): XmlObject {
	const cats = entry.categories ?? categories;
	const node: XmlObject = {
		'c:idx': { '@_val': String(entry.idx) },
		'c:order': { '@_val': String(entry.order) },
	};
	if (entry.name !== undefined) {
		node['c:tx'] = { 'c15:v': entry.name };
	}
	if (cats.length > 0) {
		node['c:cat'] = {
			'c:strLit': { 'c:ptCount': { '@_val': String(cats.length) }, 'c:pt': points(cats) },
		};
	}
	if (entry.values) {
		node['c:val'] = {
			'c:numLit': {
				'c:formatCode': 'General',
				'c:ptCount': { '@_val': String(entry.values.length) },
				'c:pt': points(entry.values.map(String)),
			},
		};
	}
	if (entry.uniqueId) {
		node['c:extLst'] = {
			'c:ext': {
				'@_uri': '{C3380CC4-5D6E-409C-BE32-E72D297353CC}',
				'xmlns:c16': 'http://schemas.microsoft.com/office/drawing/2014/chart',
				'c16:uniqueId': { '@_val': entry.uniqueId },
			},
		};
	}
	return node;
}

/**
 * Whether `filteredSeries` (the model, possibly edited by hide/restore
 * actions) already matches what {@link parseFilteredSeries} reads back from
 * `container`'s CURRENT xml. Skipping the rewrite when true keeps an
 * untouched chart byte-identical.
 */
export function filteredSeriesUnchanged(
	container: XmlObject,
	filteredSeries: PptxChartFilteredSeries[] | undefined,
	xmlLookup: XmlLookupLike,
): boolean {
	const existing = parseFilteredSeries(container, xmlLookup);
	if (!filteredSeries || filteredSeries.length === 0) {
		return !existing || existing.length === 0;
	}
	if (!existing || existing.length !== filteredSeries.length) {
		return false;
	}
	return filteredSeries.every((entry, i) => {
		const other = existing[i]!;
		return (
			entry.idx === other.idx &&
			entry.order === other.order &&
			entry.name === other.name &&
			entry.uniqueId === other.uniqueId &&
			JSON.stringify(entry.values ?? null) === JSON.stringify(other.values ?? null) &&
			JSON.stringify(entry.categories ?? null) === JSON.stringify(other.categories ?? null)
		);
	});
}

/**
 * Rewrite a chart-type container's `c15:filtered<Type>Series` wrapper from
 * the model (adding/removing individual `c15:ser` entries), preserving every
 * OTHER child of the SAME `c:ext` (`c15:filteredSeriesTitle`,
 * `filteredCategoryTitle`) and every other `c:ext` uri untouched. Mutates
 * `container` in place. `filteredSeries` empty/undefined removes the wrapper
 * (and the whole ext/extLst once nothing else remains in them).
 */
export function applyFilteredSeriesToXml(
	container: XmlObject,
	filteredSeries: PptxChartFilteredSeries[] | undefined,
	categories: string[],
	containerLocalName: string,
	getLocalName: GetLocalName,
): void {
	const extLstKey = findKey(container, 'extLst', getLocalName) ?? 'c:extLst';
	const extLst = { ...((container[extLstKey] as XmlObject | undefined) ?? {}) };
	const extKey = findKey(extLst, 'ext', getLocalName);
	const exts = extKey
		? Array.isArray(extLst[extKey])
			? [...(extLst[extKey] as XmlObject[])]
			: [extLst[extKey] as XmlObject]
		: [];
	const otherExts = exts.filter((ext) => ext['@_uri'] !== CHART_FILTERED_SERIES_EXT_URI);
	const ownExt: XmlObject = {
		...(exts.find((ext) => ext['@_uri'] === CHART_FILTERED_SERIES_EXT_URI) ?? {}),
	};

	for (const key of Object.keys(ownExt)) {
		if (/^filtered.*series$/iu.test(getLocalName(key))) {
			delete ownExt[key];
		}
	}
	if (filteredSeries && filteredSeries.length > 0) {
		ownExt['@_uri'] = CHART_FILTERED_SERIES_EXT_URI;
		ownExt['xmlns:c15'] = 'http://schemas.microsoft.com/office/drawing/2012/chart';
		const serNodes = filteredSeries.map((entry) => buildFilteredSerNode(entry, categories));
		ownExt[`c15:${wrapperLocalName(containerLocalName)}`] = {
			'c15:ser': serNodes.length === 1 ? serNodes[0] : serNodes,
		};
	}

	const ownExtHasContent = Object.keys(ownExt).some(
		(key) => !key.startsWith('@_') && !key.startsWith('xmlns'),
	);
	const newExts = ownExtHasContent ? [...otherExts, ownExt] : otherExts;

	if (newExts.length === 0) {
		delete container[extLstKey];
		return;
	}
	extLst[extKey ?? 'c:ext'] = newExts.length === 1 ? newExts[0] : newExts;
	container[extLstKey] = extLst;
}
