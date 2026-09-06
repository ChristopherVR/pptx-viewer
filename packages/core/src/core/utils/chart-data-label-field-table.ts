/**
 * chart-data-label-field-table.ts: the Office 2013+ ("chart15") extension
 * family shared by several distinct chart15 additions
 * (`c15:layout`, `c15:showLeaderLines`, `c15:leaderLines`,
 * `c15:dlblFieldTable`, `c15:showDataLabelsRange`, `c15:datalabelsRange`,
 * `c15:xForSave`); which one applies is determined by the child element
 * inside `c:ext`, not by the uri. Split out of `chart-data-label-parser.ts`
 * to keep both files under the repo's 300-line-per-file convention; the
 * `c15:datalabelsRange`/`c15:xForSave` extensions of this SAME family are
 * parsed in the sibling `chart-data-labels-range.ts`, which imports
 * {@link findChart15Ext} from here rather than re-deriving the uri.
 *
 * Confirmed against real corpus markup (`e2e/fixtures/issue-132-gradient-fill.pptx`,
 * `e2e/fixtures/issue-132-hr-deck.pptx`).
 *
 * @module utils/chart-data-label-field-table
 */
import type { XmlObject } from '../types';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
	getScalarChildByLocalName?: (parent: XmlObject | undefined, name: string) => string | undefined;
}

/** `c:ext/@uri` for the Office 2013+ "chart15" extension namespace. */
export const CHART15_EXT_URI = '{CE6537A1-D6FC-4f65-9D91-7224C49458BB}';

/** Resolve a possibly-prefixed XML key to its local name (`c:layout` -> `layout`). */
function localNameOf(key: string): string {
	const colonIndex = key.lastIndexOf(':');
	return colonIndex >= 0 ? key.slice(colonIndex + 1) : key;
}

function scalar(parent: XmlObject, name: string, xmlLookup: XmlLookupLike): string | undefined {
	const value = xmlLookup.getScalarChildByLocalName?.(parent, name);
	if (value !== undefined) {
		return value;
	}
	const node = xmlLookup.getChildByLocalName(parent, name);
	return node?.['#text'] === undefined ? undefined : String(node['#text']);
}

export function findChart15Ext(
	group: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): XmlObject | undefined {
	const extLst = xmlLookup.getChildByLocalName(group, 'extLst');
	if (!extLst) {
		return undefined;
	}
	return xmlLookup
		.getChildrenArrayByLocalName(extLst, 'ext')
		.find((ext) => ext['@_uri'] === CHART15_EXT_URI);
}

/** Recursively collect every object descendant (inclusive of `node` itself's children) whose local name is `target`. */
export function collectByLocalName(node: XmlObject, target: string, out: XmlObject[]): void {
	for (const [key, child] of Object.entries(node)) {
		if (key.startsWith('@_') || key === '#text') {
			continue;
		}
		const items = Array.isArray(child) ? child : [child];
		for (const item of items) {
			if (item && typeof item === 'object') {
				if (localNameOf(key) === target) {
					out.push(item as XmlObject);
				}
				collectByLocalName(item as XmlObject, target, out);
			}
		}
	}
}

/**
 * Parse PowerPoint 2013+'s "Value From Cells" custom label text
 * (`c:dLbls/c:extLst/c:ext/c15:dlblFieldTable/c15:dlblFieldTableEntry`),
 * keyed by point index (`c:pt/@idx`).
 *
 * Distinct from the plain `c:dLbl/c:tx/c:rich` literal-text override: this
 * extension caches the linked cell range's text so a per-point label whose
 * `c15:showDataLabelsRange` flag is set can resolve straight to the cached
 * string, without needing the source workbook. Searched by local name only
 * (ignoring the exact `c15:`/`mc:AlternateContent` wrapping) since only the
 * idx -> text mapping matters here.
 */
export function parseDataLabelFieldTable(
	group: XmlObject,
	xmlLookup: XmlLookupLike,
): Map<number, string> | undefined {
	const extLst = xmlLookup.getChildByLocalName(group, 'extLst');
	if (!extLst) {
		return undefined;
	}
	const tables: XmlObject[] = [];
	collectByLocalName(extLst, 'dlblFieldTable', tables);
	if (tables.length === 0) {
		return undefined;
	}
	const points: XmlObject[] = [];
	for (const table of tables) {
		collectByLocalName(table, 'pt', points);
	}
	const map = new Map<number, string>();
	for (const pt of points) {
		const idx = Number.parseInt(String(pt['@_idx'] ?? ''), 10);
		if (!Number.isInteger(idx) || idx < 0) {
			continue;
		}
		const value = scalar(pt, 'v', xmlLookup);
		if (value !== undefined) {
			map.set(idx, value);
		}
	}
	return map.size > 0 ? map : undefined;
}

/** Whether an element's `c:extLst` carries a `c15:showDataLabelsRange` flag set to true. */
export function showsDataLabelsRange(node: XmlObject, xmlLookup: XmlLookupLike): boolean {
	const extLst = xmlLookup.getChildByLocalName(node, 'extLst');
	if (!extLst) {
		return false;
	}
	const flags: XmlObject[] = [];
	collectByLocalName(extLst, 'showDataLabelsRange', flags);
	return flags.some((flag) => flag['@_val'] === '1' || flag['@_val'] === 'true');
}
