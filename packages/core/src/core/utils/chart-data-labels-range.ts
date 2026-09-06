/**
 * chart-data-labels-range.ts: two more members of the "chart15" data-label
 * extension family (uri `{CE6537A1-D6FC-4f65-9D91-7224C49458BB}`, see
 * `chart-data-label-field-table.ts` for the family and `findChart15Ext`):
 *
 * - `c15:datalabelsRange` (CT_SeriesDataLabelsRange): a SERIES-WIDE
 *   alternative to `c15:dlblFieldTable`'s per-point idx lookup. One cell
 *   range (`c15:f`) supplies every label in the group (chart-type or series
 *   `c:dLbls`), with a dense positional cache (`c15:dlblRangeCache`, a plain
 *   `c:strCache`-shaped list) aligned to point order. Paired with a
 *   group-level `c15:showDataLabelsRange` (the SAME element name the
 *   per-point flag uses, at a different parent) gating whether the group
 *   actually resolves through it.
 * - `c15:xForSave` (CT_Boolean, child of an individual `c:dLbl`): marks a
 *   data-label override that exists only so its properties survive a
 *   save/reload; PowerPoint merges it back onto the series' default label on
 *   load. Purely round-tripped: {@link parseXForSave} exists for
 *   introspection, and the save path preserves an existing `c:dLbl`'s whole
 *   `c:extLst` (including this flag) automatically whenever the point isn't
 *   otherwise rebuilt from scratch (see `chart-series-datalabel-build.ts`).
 *
 * Neither was reproducible via PowerPoint 2016 COM automation for this
 * module (see `scripts/make-chart-ext-fixtures.ps1`); modelled directly from
 * the published [MS-ODRAWXML] schema (CT_SeriesDataLabelsRange, xForSave).
 *
 * @module utils/chart-data-labels-range
 */
import type { PptxChartDataLabelsRange, XmlObject } from '../types';
import {
	CHART15_EXT_URI,
	collectByLocalName,
	findChart15Ext,
} from './chart-data-label-field-table';

/** Resolve a possibly-prefixed XML key to its local name. */
export type GetLocalName = (key: string) => string;

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
	getScalarChildByLocalName?: (parent: XmlObject | undefined, name: string) => string | undefined;
}

function scalar(
	parent: XmlObject | undefined,
	name: string,
	xmlLookup: XmlLookupLike,
): string | undefined {
	const value = xmlLookup.getScalarChildByLocalName?.(parent, name);
	if (value !== undefined && value !== '') {
		return value;
	}
	// A leaf-only element (`<c15:f>text</c15:f>`, no attributes) parses to a
	// plain string/number by fast-xml-parser, not a `{'#text': ...}` object;
	// `getChildByLocalName` on the real PptxXmlLookupService already unwraps
	// that, but the save-side `localNameLookup` adapter below is a raw object
	// walk and hands the primitive straight back.
	const node = xmlLookup.getChildByLocalName(parent, name) as unknown;
	if (typeof node === 'string' || typeof node === 'number') {
		return String(node);
	}
	const obj = node as XmlObject | undefined;
	return obj?.['#text'] === undefined ? undefined : String(obj['#text']);
}

/** Dense-array reader for a `c15:dlblRangeCache` (CT_StrData: `ptCount` + `pt[@idx]/v`). */
function readStrData(cacheNode: XmlObject | undefined, xmlLookup: XmlLookupLike): string[] {
	if (!cacheNode) {
		return [];
	}
	const points = xmlLookup.getChildrenArrayByLocalName(cacheNode, 'pt');
	const byIndex = new Map<number, string>();
	let maxIndex = -1;
	for (const point of points) {
		const idx = Number.parseInt(String(point['@_idx'] ?? ''), 10);
		if (!Number.isInteger(idx) || idx < 0) {
			continue;
		}
		byIndex.set(idx, scalar(point, 'v', xmlLookup) ?? '');
		if (idx > maxIndex) {
			maxIndex = idx;
		}
	}
	if (byIndex.size === 0) {
		return [];
	}
	const declared = Number.parseInt(
		String(xmlLookup.getChildByLocalName(cacheNode, 'ptCount')?.['@_val'] ?? ''),
		10,
	);
	const length = Number.isFinite(declared) && declared > maxIndex + 1 ? declared : maxIndex + 1;
	const out: string[] = [];
	for (let i = 0; i < length; i++) {
		out.push(byIndex.get(i) ?? '');
	}
	return out;
}

/**
 * Parse `c15:datalabelsRange` from a `c:dLbls` group (chart-type level or
 * series level; both use the same shape). `undefined` when absent or when
 * the required `c15:f` formula is missing.
 */
export function parseDataLabelsRange(
	dLblsGroup: XmlObject,
	xmlLookup: XmlLookupLike,
): PptxChartDataLabelsRange | undefined {
	const ext = findChart15Ext(dLblsGroup, xmlLookup);
	if (!ext) {
		return undefined;
	}
	const rangeNode = xmlLookup.getChildByLocalName(ext, 'datalabelsRange');
	if (!rangeNode) {
		return undefined;
	}
	const formula = scalar(rangeNode, 'f', xmlLookup);
	if (!formula) {
		return undefined;
	}
	const cache = readStrData(xmlLookup.getChildByLocalName(rangeNode, 'dlblRangeCache'), xmlLookup);
	return { formula, cache };
}

/**
 * Whether a `c:dLbls` GROUP's `c:extLst` carries a `c15:showDataLabelsRange`
 * flag set to true. Distinct from the per-point flag of the same name parsed
 * by `chart-data-label-field-table.ts`'s `showsDataLabelsRange`, which reads
 * an individual `c:dLbl`.
 */
export function groupShowsDataLabelsRange(
	dLblsGroup: XmlObject,
	xmlLookup: XmlLookupLike,
): boolean {
	const ext = findChart15Ext(dLblsGroup, xmlLookup);
	if (!ext) {
		return false;
	}
	const flags: XmlObject[] = [];
	collectByLocalName(ext, 'showDataLabelsRange', flags);
	return flags.some((flag) => flag['@_val'] === '1' || flag['@_val'] === 'true');
}

/**
 * Whether an individual `c:dLbl`'s `c:extLst` carries `c15:xForSave` set to
 * true (this override exists only to survive a save/reload round trip).
 */
export function parseXForSave(dLblNode: XmlObject, xmlLookup: XmlLookupLike): boolean | undefined {
	const ext = findChart15Ext(dLblNode, xmlLookup);
	if (!ext) {
		return undefined;
	}
	const flags: XmlObject[] = [];
	collectByLocalName(ext, 'xForSave', flags);
	if (flags.length === 0) {
		return undefined;
	}
	return flags.some((flag) => flag['@_val'] === '1' || flag['@_val'] === 'true');
}

/** Minimal `XmlLookupLike` adapter over a plain `getLocalName` resolver, for the save side. */
function localNameLookup(getLocalName: GetLocalName): XmlLookupLike {
	return {
		getChildByLocalName: (parent, name) => {
			if (!parent) {
				return undefined;
			}
			const key = Object.keys(parent).find((k) => getLocalName(k) === name);
			return key ? (parent[key] as XmlObject | undefined) : undefined;
		},
		getChildrenArrayByLocalName: (parent, name) => {
			if (!parent) {
				return [];
			}
			const key = Object.keys(parent).find((k) => getLocalName(k) === name);
			if (!key) {
				return [];
			}
			const value = parent[key];
			return Array.isArray(value) ? (value as XmlObject[]) : [value as XmlObject];
		},
	};
}

/**
 * Whether the model's `dataLabelsRange`/`showDataLabelsRange` for this group
 * already matches what {@link parseDataLabelsRange}/{@link groupShowsDataLabelsRange}
 * would read back from the group's CURRENT xml. Used to skip a rewrite (and
 * so preserve untouched formatting byte-for-byte) when nothing changed.
 */
export function dataLabelsRangeUnchanged(
	dLbls: XmlObject,
	range: PptxChartDataLabelsRange | undefined,
	showDataLabelsRange: boolean | undefined,
	getLocalName: GetLocalName,
): boolean {
	const lookup = localNameLookup(getLocalName);
	const existingRange = parseDataLabelsRange(dLbls, lookup);
	const existingShow = existingRange ? groupShowsDataLabelsRange(dLbls, lookup) : undefined;
	if (range === undefined) {
		return existingRange === undefined;
	}
	if (existingRange === undefined) {
		return false;
	}
	return (
		existingRange.formula === range.formula &&
		existingRange.cache.length === range.cache.length &&
		existingRange.cache.every((value, idx) => value === range.cache[idx]) &&
		existingShow === (showDataLabelsRange !== false)
	);
}

function findKey(obj: XmlObject, local: string, getLocalName: GetLocalName): string | undefined {
	return Object.keys(obj).find((k) => getLocalName(k) === local);
}

function asExtArray(value: XmlObject[keyof XmlObject]): XmlObject[] {
	return Array.isArray(value) ? (value as XmlObject[]) : [value as XmlObject];
}

function pointsOf(cache: readonly string[]): XmlObject {
	return {
		'c:ptCount': { '@_val': String(cache.length) },
		'c:pt': cache.map((value, idx) => ({ '@_idx': String(idx), 'c:v': value })),
	};
}

/**
 * Rewrite the `c15:datalabelsRange` + group-level `c15:showDataLabelsRange`
 * portion of a `c:dLbls` GROUP's `c:extLst` from the model, so an edit to
 * either survives save (the group's OTHER children, including numFmt/spPr/
 * txPr/show flags AND every other extLst child - `c15:dlblFieldTable`,
 * `c15:showLeaderLines`, `c15:leaderLines`, and any unrelated `c:ext` uri -
 * are preserved verbatim). Passing `range: undefined` removes the extension
 * entirely (still preserving those siblings). Mutates `dLbls` in place.
 */
export function applyDataLabelsRangeToDLbls(
	dLbls: XmlObject,
	range: PptxChartDataLabelsRange | undefined,
	showDataLabelsRange: boolean | undefined,
	getLocalName: GetLocalName,
): void {
	if (dataLabelsRangeUnchanged(dLbls, range, showDataLabelsRange, getLocalName)) {
		return;
	}
	const extLstKey = findKey(dLbls, 'extLst', getLocalName) ?? 'c:extLst';
	const extLst = { ...((dLbls[extLstKey] as XmlObject | undefined) ?? {}) };
	const extKey = findKey(extLst, 'ext', getLocalName);
	const exts = extKey ? asExtArray(extLst[extKey]) : [];
	const otherExts = exts.filter((ext) => ext['@_uri'] !== CHART15_EXT_URI);
	const ownExt: XmlObject = { ...(exts.find((ext) => ext['@_uri'] === CHART15_EXT_URI) ?? {}) };

	for (const key of Object.keys(ownExt)) {
		const local = getLocalName(key);
		if (local === 'datalabelsRange' || local === 'showDataLabelsRange') {
			delete ownExt[key];
		}
	}
	if (range) {
		ownExt['@_uri'] = CHART15_EXT_URI;
		ownExt['xmlns:c15'] = 'http://schemas.microsoft.com/office/drawing/2012/chart';
		ownExt['c15:showDataLabelsRange'] = { '@_val': showDataLabelsRange === false ? '0' : '1' };
		ownExt['c15:datalabelsRange'] = {
			'c15:f': range.formula,
			'c15:dlblRangeCache': pointsOf(range.cache),
		};
	}

	const ownExtHasContent = Object.keys(ownExt).some(
		(key) => !key.startsWith('@_') && !key.startsWith('xmlns'),
	);
	const newExts = ownExtHasContent ? [...otherExts, ownExt] : otherExts;

	if (newExts.length === 0) {
		delete dLbls[extLstKey];
		return;
	}
	extLst[extKey ?? 'c:ext'] = newExts.length === 1 ? newExts[0] : newExts;
	dLbls[extLstKey] = extLst;
}
