import type { PptxChartDataTable, XmlObject } from '../types';

type LocalName = (key: string) => string;

const TABLE_ORDER = [
	'showHorzBorder',
	'showVertBorder',
	'showOutline',
	'showKeys',
	'spPr',
	'txPr',
	'extLst',
] as const;
const PLOT_AREA_ORDER = [
	'layout',
	'areaChart',
	'area3DChart',
	'lineChart',
	'line3DChart',
	'stockChart',
	'radarChart',
	'scatterChart',
	'pieChart',
	'pie3DChart',
	'doughnutChart',
	'barChart',
	'bar3DChart',
	'ofPieChart',
	'surfaceChart',
	'surface3DChart',
	'bubbleChart',
	'valAx',
	'catAx',
	'dateAx',
	'serAx',
	'dTable',
	'spPr',
	'extLst',
] as const;
const FLAGS = ['showHorzBorder', 'showVertBorder', 'showOutline', 'showKeys'] as const;

function findKey(node: XmlObject, name: string, localName: LocalName): string | undefined {
	return Object.keys(node).find((key) => localName(key) === name);
}

function setOrdered(
	node: XmlObject,
	name: string,
	value: XmlObject,
	order: readonly string[],
	localName: LocalName,
): void {
	const existingKey = findKey(node, name, localName);
	if (existingKey) {
		node[existingKey] = value;
		return;
	}
	const entries = Object.entries(node);
	const rank = order.indexOf(name);
	const index = entries.findIndex(([key]) => {
		const candidateRank = order.indexOf(localName(key));
		return candidateRank >= 0 && candidateRank > rank;
	});
	entries.splice(index < 0 ? entries.length : index, 0, [`c:${name}`, value]);
	for (const key of Object.keys(node)) {
		delete node[key];
	}
	for (const [key, child] of entries) {
		node[key] = child;
	}
}

/**
 * Reconcile a typed ChartML `c:dTable` with an existing plot area.
 * Undefined preserves the source node, null removes it, and an object creates
 * or edits it while retaining unmodelled styling, extensions, and children.
 */
export function applyChartDataTable(
	plotArea: XmlObject,
	dataTable: PptxChartDataTable | null | undefined,
	localName: LocalName,
): void {
	if (dataTable === undefined) {
		return;
	}
	const tableKey = findKey(plotArea, 'dTable', localName);
	if (dataTable === null) {
		if (tableKey) {
			delete plotArea[tableKey];
		}
		return;
	}

	const table: XmlObject = {
		...((tableKey ? plotArea[tableKey] : undefined) as XmlObject | undefined),
	};
	for (const flag of FLAGS) {
		const value = dataTable[flag];
		if (value !== undefined) {
			setOrdered(table, flag, { '@_val': value ? '1' : '0' }, TABLE_ORDER, localName);
		}
	}
	if (tableKey) {
		plotArea[tableKey] = table;
	} else {
		setOrdered(plotArea, 'dTable', table, PLOT_AREA_ORDER, localName);
	}
}
