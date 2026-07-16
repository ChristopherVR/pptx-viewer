import type { PptxChartHistogramOptions, XmlObject } from '../types';
import type { XmlLookupLike } from './chart-cx-parser';

function parseDoubleOrAutomatic(value: unknown): number | 'auto' | undefined {
	if (value === 'auto') {
		return 'auto';
	}
	const parsed = Number.parseFloat(String(value ?? ''));
	return Number.isFinite(parsed) ? parsed : undefined;
}

/** Parse schema-defined ChartEx histogram and Pareto series properties. */
export function parseCxHistogramOptions(
	series: XmlObject,
	xmlLookup: XmlLookupLike,
): PptxChartHistogramOptions | undefined {
	const layoutId = series['@_layoutId'];
	if (layoutId !== 'clusteredColumn' && layoutId !== 'paretoLine') {
		return undefined;
	}
	const layoutPr = xmlLookup.getChildByLocalName(series, 'layoutPr');
	const binning = xmlLookup.getChildByLocalName(layoutPr, 'binning');
	const rawBinSize = xmlLookup.getScalarChildByLocalName(binning, 'binSize');
	const rawBinCount = xmlLookup.getScalarChildByLocalName(binning, 'binCount');
	const binSize = Number.parseFloat(String(rawBinSize ?? ''));
	const binCount = Number.parseInt(String(rawBinCount ?? ''), 10);
	const intervalClosed = binning?.['@_intervalClosed'];
	return {
		layout: layoutId === 'paretoLine' ? 'pareto' : 'histogram',
		...(Number.isFinite(binSize) ? { binSize } : {}),
		...(Number.isSafeInteger(binCount) && binCount >= 0 ? { binCount } : {}),
		...(intervalClosed === 'l' || intervalClosed === 'r' ? { intervalClosed } : {}),
		...(binning?.['@_underflow'] !== undefined
			? { underflow: parseDoubleOrAutomatic(binning['@_underflow']) }
			: {}),
		...(binning?.['@_overflow'] !== undefined
			? { overflow: parseDoubleOrAutomatic(binning['@_overflow']) }
			: {}),
	};
}
