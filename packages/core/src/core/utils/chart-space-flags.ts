/**
 * Pure parser for two `c:chartSpace`-root boolean flags that are siblings of
 * `c:chart` (not children of it): `c:date1904` and `c:roundedCorners`. Split
 * out of `PptxHandlerRuntimeChartParsing.ts` (already at the repo's 300-line
 * guidance) rather than grown inline there.
 *
 * @module utils/chart-space-flags
 */
import type { XmlObject } from '../types';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
}

/** Parsed `c:chartSpace`-root flags. */
export interface PptxChartSpaceFlags {
	/**
	 * `c:date1904/@val`. Absent when the source XML omits the element
	 * (the 1900 date system applies, per the CT_Boolean schema default).
	 */
	date1904?: boolean;
	/** `c:roundedCorners/@val`. Absent when the source XML omits the element. */
	roundedCorners?: boolean;
}

/** Parse a `CT_Boolean` child: a present element with no `@val` defaults to `true`. */
function parseBoolChild(node: XmlObject | undefined): boolean | undefined {
	if (!node) {
		return undefined;
	}
	const val = node['@_val'];
	if (val === undefined || val === null || val === '') {
		return true;
	}
	return !(val === '0' || val === 'false');
}

/** Parse `c:chartSpace/c:date1904` and `c:chartSpace/c:roundedCorners`. */
export function parseChartSpaceFlags(
	chartSpace: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): PptxChartSpaceFlags {
	if (!chartSpace) {
		return {};
	}
	const result: PptxChartSpaceFlags = {};
	const date1904 = parseBoolChild(xmlLookup.getChildByLocalName(chartSpace, 'date1904'));
	if (date1904 !== undefined) {
		result.date1904 = date1904;
	}
	const roundedCorners = parseBoolChild(
		xmlLookup.getChildByLocalName(chartSpace, 'roundedCorners'),
	);
	if (roundedCorners !== undefined) {
		result.roundedCorners = roundedCorners;
	}
	return result;
}
