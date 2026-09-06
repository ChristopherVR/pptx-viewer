/**
 * chart-ext-titles.ts: two rare Office 2013+ ("chart15") extensions that
 * preserve auto-generated chart TEXT when PowerPoint's "Chart Filters"
 * feature hid the data that would otherwise supply it. Both are siblings of
 * `c15:filtered<Type>Series` inside the SAME chart-type container's
 * `c:extLst/c:ext[@uri={02D57815-91ED-43cb-92C2-25804820EDAC}]` (see
 * `chart-filtered-series.ts` for that extension family and why it is matched
 * generically across chart types).
 *
 * - `c15:filteredSeriesTitle/c15:tx` ([MS-ODRAWXML] CT_FilteredSeriesTitle):
 *   the series title PowerPoint auto-generated (e.g. "Series 3") for a
 *   series whose own title source got filtered away, so a later "un-filter"
 *   still has something to call it.
 * - `c15:filteredCategoryTitle/c15:cat` (CT_FilteredCategoryTitle): the
 *   auto-numbered category labels ("1", "2", "3", ...) PowerPoint generates
 *   when the real category axis source was filtered away entirely.
 *
 * Neither was reproducible via PowerPoint 2016 COM automation in the
 * investigation for this module (`Series.IsFiltered`, category
 * `FullCategoryCollection(i).IsFiltered`, and a cell-linked chart/axis title
 * all round-trip WITHOUT emitting either extension; see
 * `scripts/make-chart-ext-fixtures.ps1`), so this parser is written directly
 * from the published [MS-ODRAWXML] schema rather than a captured corpus
 * sample. It round-trips byte-identically through the same passthrough path
 * every other chart15 extension this codebase does not rewrite already
 * relies on.
 *
 * @module utils/chart-ext-titles
 */
import type { XmlObject } from '../types';
import { findFilterExt, readCachedValues } from './chart-filtered-series';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
	getScalarChildByLocalName?: (parent: XmlObject | undefined, name: string) => string | undefined;
}

/** Result of {@link parseFilteredTitles}. */
export interface PptxChartFilteredTitles {
	/** `c15:filteredSeriesTitle/c15:tx`: the filtered-away series' cached title. */
	seriesTitle?: string;
	/** `c15:filteredCategoryTitle/c15:cat`: the filtered-away category labels. */
	categoryTitle?: string[];
}

/** Resolve a `c15:tx` (CT_SerTx: a literal `c15:v` or a `c15:strRef`/`c15:numRef`). */
function readSerTx(tx: XmlObject | undefined, xmlLookup: XmlLookupLike): string | undefined {
	if (!tx) {
		return undefined;
	}
	const ref =
		xmlLookup.getChildByLocalName(tx, 'strRef') ?? xmlLookup.getChildByLocalName(tx, 'numRef');
	const cached = readCachedValues(ref, xmlLookup)[0];
	if (cached) {
		return cached;
	}
	const literal = xmlLookup.getScalarChildByLocalName?.(tx, 'v');
	return literal && literal.length > 0 ? literal : undefined;
}

/** Resolve a `c15:cat` (CT_AxDataSource: `strRef`/`numRef`/`multiLvlStrRef`). */
function readAxDataSource(cat: XmlObject | undefined, xmlLookup: XmlLookupLike): string[] {
	if (!cat) {
		return [];
	}
	const ref =
		xmlLookup.getChildByLocalName(cat, 'strRef') ?? xmlLookup.getChildByLocalName(cat, 'numRef');
	return readCachedValues(ref, xmlLookup);
}

/**
 * Parse `c15:filteredSeriesTitle` and `c15:filteredCategoryTitle` from a
 * chart-type container, if present. Returns `undefined` when neither is
 * present, so callers can merge with `??` without an extra field check.
 */
export function parseFilteredTitles(
	container: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): PptxChartFilteredTitles | undefined {
	const ext = findFilterExt(container, xmlLookup);
	if (!ext) {
		return undefined;
	}

	const result: PptxChartFilteredTitles = {};

	const seriesTitleWrapper = xmlLookup.getChildByLocalName(ext, 'filteredSeriesTitle');
	const seriesTitle = readSerTx(xmlLookup.getChildByLocalName(seriesTitleWrapper, 'tx'), xmlLookup);
	if (seriesTitle) {
		result.seriesTitle = seriesTitle;
	}

	const categoryTitleWrapper = xmlLookup.getChildByLocalName(ext, 'filteredCategoryTitle');
	const categoryTitle = readAxDataSource(
		xmlLookup.getChildByLocalName(categoryTitleWrapper, 'cat'),
		xmlLookup,
	);
	if (categoryTitle.length > 0) {
		result.categoryTitle = categoryTitle;
	}

	return result.seriesTitle !== undefined || result.categoryTitle !== undefined
		? result
		: undefined;
}
