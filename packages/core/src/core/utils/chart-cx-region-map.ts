import type { PptxChartRegionMapOptions, XmlObject } from '../types';
import type { XmlLookupLike } from './chart-cx-parser';

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
	entityIds: string[] | undefined,
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
	return {
		...(entityIds?.length ? { entityIds: [...entityIds] } : {}),
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
	};
}
