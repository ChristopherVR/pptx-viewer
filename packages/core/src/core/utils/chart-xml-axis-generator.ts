import type { PptxChartAxisFormatting, XmlObject } from '../types';
import { applyChartAxisDisplayUnitsToXml } from './chart-axis-dispunits-serializer';
import { applyChartAxisLabelFormatting } from './chart-axis-label-formatting';
import { applyChartAxisScaling, upsertChartAxisChild } from './chart-axis-scaling';
import { applyChartDateAxisUnits } from './chart-date-axis';

/** Build a generated classic ChartML category, date, or value axis. */
export function buildGeneratedChartAxis(
	axId: number,
	crossId: number,
	pos: string,
	formatting?: PptxChartAxisFormatting,
): XmlObject {
	const axis: XmlObject = {
		'c:axId': { '@_val': String(axId) },
		'c:scaling': { 'c:orientation': { '@_val': 'minMax' } },
		'c:delete': { '@_val': '0' },
		'c:axPos': { '@_val': pos },
		'c:crossAx': { '@_val': String(crossId) },
	};
	if (formatting) {
		const localName = (key: string) => key.replace(/^.*:/u, '');
		applyChartAxisScaling(axis['c:scaling'] as XmlObject, formatting, localName);
		applyChartAxisLabelFormatting(axis, formatting, localName);
		upsertChartAxisChild(
			axis,
			'majorUnit',
			formatting.majorUnit === undefined ? undefined : String(formatting.majorUnit),
			localName,
		);
		upsertChartAxisChild(
			axis,
			'minorUnit',
			formatting.minorUnit === undefined ? undefined : String(formatting.minorUnit),
			localName,
		);
		applyChartDateAxisUnits(axis, formatting, localName);
	}
	if (formatting?.displayUnits) {
		applyChartAxisDisplayUnitsToXml(axis, formatting, (key) => key.replace(/^.*:/u, ''));
	}
	return axis;
}
