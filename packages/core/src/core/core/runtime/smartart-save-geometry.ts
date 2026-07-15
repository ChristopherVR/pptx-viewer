import type { PptxSmartArtData, XmlObject } from '../../types';
import {
	buildFabricatedLayoutDefXml,
	fabricatedLayoutCategory,
	fabricatedLayoutUniqueId,
	resolveFabricatedLayoutFamily,
} from './smartart-fabrication-layouts';

export interface SmartArtSaveLayout {
	category: string;
	uniqueId: string;
	xml: string;
}

/** Resolve the custom layout identity written for an edited or inserted diagram. */
export function resolveSmartArtSaveLayout(data: PptxSmartArtData): SmartArtSaveLayout {
	const family = resolveFabricatedLayoutFamily(data);
	const identity = data.layout ?? data.resolvedLayoutType;
	return {
		category: fabricatedLayoutCategory(family),
		uniqueId: fabricatedLayoutUniqueId(family, identity),
		xml: buildFabricatedLayoutDefXml(family, identity),
	};
}

/** Update the document point so its layout identity matches layoutN.xml. */
export function applySmartArtLayoutIdentity(
	dataModel: XmlObject,
	layout: SmartArtSaveLayout,
	localName: (key: string) => string,
): void {
	const pointListKey = Object.keys(dataModel).find((key) => localName(key) === 'ptLst');
	const pointList = pointListKey ? (dataModel[pointListKey] as XmlObject) : undefined;
	const pointKey = pointList
		? Object.keys(pointList).find((key) => localName(key) === 'pt')
		: undefined;
	const points = pointKey && pointList ? ensureObjects(pointList[pointKey]) : [];
	const docPoint = points.find((point) => String(point['@_type'] || '') === 'doc');
	if (!docPoint) {
		return;
	}
	const propertySetKey = Object.keys(docPoint).find((key) => localName(key) === 'prSet');
	const propertySet = propertySetKey ? (docPoint[propertySetKey] as XmlObject) : undefined;
	if (propertySet) {
		propertySet['@_loTypeId'] = layout.uniqueId;
		propertySet['@_loCatId'] = layout.category;
	}
}

/** Map content-node ids to their presentation-point ids for cached shapes. */
export function presentationIdsFromPoints(
	points: XmlObject[],
	localName: (key: string) => string,
): Map<string, string> {
	const result = new Map<string, string>();
	for (const point of points) {
		if (String(point['@_type'] || '') !== 'pres') {
			continue;
		}
		const propertySetKey = Object.keys(point).find((key) => localName(key) === 'prSet');
		const propertySet = propertySetKey ? (point[propertySetKey] as XmlObject) : undefined;
		const contentId = String(propertySet?.['@_presAssocID'] || '').trim();
		const presentationId = String(point['@_modelId'] || '').trim();
		if (contentId && presentationId && !result.has(contentId)) {
			result.set(contentId, presentationId);
		}
	}
	return result;
}

function ensureObjects(value: unknown): XmlObject[] {
	if (Array.isArray(value)) {
		return value as XmlObject[];
	}
	return value ? [value as XmlObject] : [];
}
