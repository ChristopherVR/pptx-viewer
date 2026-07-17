import type { PptxChartRegionMapOptions, XmlObject } from '../types';
import type { XmlLookupLike } from './chart-cx-parser';
import { cloneXmlObject } from './clone-utils';

const PROJECTIONS = new Set(['mercator', 'miller', 'robinson', 'albers']);
const VIEW_LEVELS = new Set([
	'dataOnly',
	'postalCode',
	'county',
	'state',
	'countryRegion',
	'countryRegionList',
	'world',
]);
const LABEL_LAYOUTS = new Set(['none', 'bestFitOnly', 'showAll']);

/** Parse schema-defined ChartEx region-map dimensions and geography properties. */
export function parseCxRegionMapOptions(
	series: XmlObject,
	dataNode: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
): PptxChartRegionMapOptions | undefined {
	if (series['@_layoutId'] !== 'regionMap') {
		return undefined;
	}
	const layoutPr = xmlLookup.getChildByLocalName(series, 'layoutPr');
	const labelLayout = xmlLookup.getChildByLocalName(layoutPr, 'regionLabelLayout')?.['@_val'];
	const geography = xmlLookup.getChildByLocalName(layoutPr, 'geography');
	const projection = geography?.['@_projectionType'];
	const viewLevel = geography?.['@_viewedRegionType'];
	const categories = readIndexedDimension(dataNode, 'strDim', 'cat', xmlLookup);
	const entityIds = readIndexedDimension(dataNode, 'strDim', 'entityId', xmlLookup);
	const values = readIndexedDimension(dataNode, 'numDim', 'colorVal', xmlLookup);
	const geographyCache = xmlLookup.getChildByLocalName(geography, 'geoCache');
	return {
		...(entityIds.values.length ? { entityIds: entityIds.values } : {}),
		...(categories.indices.length ? { categorySourceIndices: categories.indices } : {}),
		...(values.indices.length ? { valueSourceIndices: values.indices } : {}),
		...(entityIds.indices.length ? { entityIdSourceIndices: entityIds.indices } : {}),
		...(LABEL_LAYOUTS.has(String(labelLayout))
			? { regionLabelLayout: labelLayout as PptxChartRegionMapOptions['regionLabelLayout'] }
			: {}),
		...(PROJECTIONS.has(String(projection))
			? { projectionType: projection as PptxChartRegionMapOptions['projectionType'] }
			: {}),
		...(VIEW_LEVELS.has(String(viewLevel))
			? { viewedRegionType: viewLevel as PptxChartRegionMapOptions['viewedRegionType'] }
			: {}),
		...(geography?.['@_cultureLanguage'] !== undefined
			? { cultureLanguage: String(geography['@_cultureLanguage']) }
			: {}),
		...(geography?.['@_cultureRegion'] !== undefined
			? { cultureRegion: String(geography['@_cultureRegion']) }
			: {}),
		...(geography?.['@_attribution'] !== undefined
			? { attribution: String(geography['@_attribution']) }
			: {}),
		...(geographyCache ? { geographyCache: cloneXmlObject(geographyCache) } : {}),
	};
}

function readIndexedDimension(
	dataNode: XmlObject | undefined,
	kind: 'strDim' | 'numDim',
	type: string,
	xmlLookup: XmlLookupLike,
): { values: string[]; indices: number[] } {
	const dimension = xmlLookup
		.getChildrenArrayByLocalName(dataNode, kind)
		.find((candidate) => String(candidate['@_type'] ?? '') === type);
	const level = xmlLookup.getChildByLocalName(dimension, 'lvl');
	const values: string[] = [];
	const indices: number[] = [];
	for (const [position, point] of xmlLookup.getChildrenArrayByLocalName(level, 'pt').entries()) {
		const raw = xmlLookup.getScalarChildByLocalName(point, 'v') ?? point['#text'];
		values.push(String(raw ?? '').trim());
		const parsed = Number.parseInt(String(point['@_idx'] ?? position), 10);
		indices.push(Number.isInteger(parsed) && parsed >= 0 ? parsed : position);
	}
	return { values, indices };
}
