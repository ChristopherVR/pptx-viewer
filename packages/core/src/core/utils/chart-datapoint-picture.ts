/**
 * Parse/serialize helpers for `c:dPt/c:pictureOptions` (per-data-point
 * picture-fill flags, C2-G9), split out of `chart-datapoint-serializer.ts`
 * to keep that file within the repo's ~300-LOC limit.
 *
 * @module utils/chart-datapoint-picture
 */

import type { PptxChartDataPointPicture, PptxChartPictureFormat, XmlObject } from '../types';

interface PictureOptionsXmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
}

const PICTURE_FORMATS = new Set<PptxChartPictureFormat>(['stretch', 'stack', 'stackScale']);

/** CT_Boolean: an element present without a `val` attribute defaults to true. */
function ctBoolean(node: XmlObject | undefined): boolean | undefined {
	if (!node) {
		return undefined;
	}
	const value = node['@_val'];
	if (value === undefined) {
		return true;
	}
	const normalized = String(value);
	if (normalized === 'true' || normalized === '1') {
		return true;
	}
	if (normalized === 'false' || normalized === '0') {
		return false;
	}
	return undefined;
}

/**
 * Parse `c:dPt/c:pictureOptions` (per-point picture-fill flags): PowerPoint's
 * "Picture or texture fill" with "Stack"/"Stretch" on a bar/column data
 * point (C2-G9, parse half). The picture itself (`c:spPr/a:blipFill`) is not
 * resolved here; see {@link PptxChartDataPointPicture}'s doc comment.
 */
export function parseChartDataPointPicture(
	dPtNode: XmlObject,
	xmlLookup: PictureOptionsXmlLookupLike,
): PptxChartDataPointPicture | undefined {
	const pictureOptions = xmlLookup.getChildByLocalName(dPtNode, 'pictureOptions');
	if (!pictureOptions) {
		return undefined;
	}
	const result: PptxChartDataPointPicture = {};
	const applyToFront = ctBoolean(xmlLookup.getChildByLocalName(pictureOptions, 'applyToFront'));
	if (applyToFront !== undefined) {
		result.applyToFront = applyToFront;
	}
	const applyToSides = ctBoolean(xmlLookup.getChildByLocalName(pictureOptions, 'applyToSides'));
	if (applyToSides !== undefined) {
		result.applyToSides = applyToSides;
	}
	const applyToEnd = ctBoolean(xmlLookup.getChildByLocalName(pictureOptions, 'applyToEnd'));
	if (applyToEnd !== undefined) {
		result.applyToEnd = applyToEnd;
	}
	const pictureFormatNode = xmlLookup.getChildByLocalName(pictureOptions, 'pictureFormat');
	const formatRaw = String(pictureFormatNode?.['@_val'] ?? '').trim();
	if (PICTURE_FORMATS.has(formatRaw as PptxChartPictureFormat)) {
		result.pictureFormat = formatRaw as PptxChartPictureFormat;
	}
	const stackUnitNode = xmlLookup.getChildByLocalName(pictureOptions, 'pictureStackUnit');
	const stackUnit = Number.parseFloat(String(stackUnitNode?.['@_val'] ?? ''));
	if (Number.isFinite(stackUnit)) {
		result.pictureStackUnit = stackUnit;
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Extract the `r:embed`/`r:link` relationship id from a `c:dPt`'s sibling
 * `c:spPr/a:blipFill/a:blip` (C2-G9 render half: resolving this to an actual
 * image needs the runtime's relationship map and zip access, which this pure
 * parser does not have; the runtime resolves the id this returns into
 * {@link PptxChartDataPointPicture.imageUrl} in a follow-up pass). Returns
 * `undefined` when the point has no picture fill.
 */
export function parseChartDataPointPictureBlipRel(
	dPtNode: XmlObject,
	xmlLookup: PictureOptionsXmlLookupLike,
): string | undefined {
	const spPr = xmlLookup.getChildByLocalName(dPtNode, 'spPr');
	const blipFill = xmlLookup.getChildByLocalName(spPr, 'blipFill');
	const blip = xmlLookup.getChildByLocalName(blipFill, 'blip');
	const relId = String(blip?.['@_r:embed'] ?? blip?.['@_r:link'] ?? '').trim();
	return relId.length > 0 ? relId : undefined;
}

/**
 * Build `c:dPt/c:pictureOptions` from the typed model (C2-G9 save half: an
 * independent write path distinct from the raw-XML passthrough an untouched
 * point still round-trips through). `picture: undefined` preserves whatever
 * `c:pictureOptions` subtree already existed verbatim, matching every other
 * unmodeled `c:dPt` child; a defined (possibly empty) `picture` rebuilds the
 * element (or removes it, when every flag is unset) from the model, the same
 * "typed edit wins once touched" convention `buildDptSpPr` uses for fills.
 */
export function buildDptPictureOptions(
	existing: XmlObject | undefined,
	picture: PptxChartDataPointPicture | undefined,
): XmlObject | undefined {
	if (picture === undefined) {
		return existing;
	}
	const node: XmlObject = {};
	if (picture.applyToFront !== undefined) {
		node['c:applyToFront'] = { '@_val': picture.applyToFront ? '1' : '0' };
	}
	if (picture.applyToSides !== undefined) {
		node['c:applyToSides'] = { '@_val': picture.applyToSides ? '1' : '0' };
	}
	if (picture.applyToEnd !== undefined) {
		node['c:applyToEnd'] = { '@_val': picture.applyToEnd ? '1' : '0' };
	}
	if (picture.pictureFormat !== undefined) {
		node['c:pictureFormat'] = { '@_val': picture.pictureFormat };
	}
	if (picture.pictureStackUnit !== undefined) {
		node['c:pictureStackUnit'] = { '@_val': String(picture.pictureStackUnit) };
	}
	return Object.keys(node).length > 0 ? node : undefined;
}
