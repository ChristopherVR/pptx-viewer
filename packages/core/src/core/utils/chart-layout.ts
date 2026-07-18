import type { PptxChartLayouts, PptxChartManualLayout, XmlObject } from '../types';

type LocalName = (key: string) => string;

const child = (node: XmlObject | undefined, name: string, localName: LocalName) => {
	if (!node) {
		return undefined;
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	return key ? (node[key] as XmlObject | undefined) : undefined;
};

const numberValue = (node: XmlObject | undefined): number | undefined => {
	const raw = node?.['@_val'];
	if (raw === undefined || raw === null || raw === '') {
		return undefined;
	}
	const value = Number(raw);
	return Number.isFinite(value) ? value : undefined;
};

/** Parse one `c:layout/c:manualLayout` subtree. */
export function parseChartManualLayout(
	parent: XmlObject | undefined,
	localName: LocalName,
): PptxChartManualLayout | undefined {
	const manual = child(child(parent, 'layout', localName), 'manualLayout', localName);
	if (!manual) {
		return undefined;
	}
	const result: PptxChartManualLayout = {};
	const enumValue = <T extends string>(name: string, allowed: readonly T[]): T | undefined => {
		const raw = child(manual, name, localName)?.['@_val'];
		return allowed.includes(raw as T) ? (raw as T) : undefined;
	};
	result.layoutTarget = enumValue('layoutTarget', ['inner', 'outer']);
	result.xMode = enumValue('xMode', ['edge', 'factor']);
	result.yMode = enumValue('yMode', ['edge', 'factor']);
	result.widthMode = enumValue('wMode', ['edge', 'factor']);
	result.heightMode = enumValue('hMode', ['edge', 'factor']);
	result.x = numberValue(child(manual, 'x', localName));
	result.y = numberValue(child(manual, 'y', localName));
	result.width = numberValue(child(manual, 'w', localName));
	result.height = numberValue(child(manual, 'h', localName));
	const ext = child(manual, 'extLst', localName);
	if (ext !== undefined) {
		result.ext = ext;
	}
	for (const key of Object.keys(result) as Array<keyof PptxChartManualLayout>) {
		if (result[key] === undefined) {
			delete result[key];
		}
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

/** Parse title, plot-area, and legend layouts from a chart root. */
export function parseChartLayouts(
	chartRoot: XmlObject | undefined,
	localName: LocalName,
): PptxChartLayouts | undefined {
	if (!chartRoot) {
		return undefined;
	}
	const layouts: PptxChartLayouts = {
		title: parseChartManualLayout(child(chartRoot, 'title', localName), localName),
		plotArea: parseChartManualLayout(child(chartRoot, 'plotArea', localName), localName),
		legend: parseChartManualLayout(child(chartRoot, 'legend', localName), localName),
	};
	for (const key of Object.keys(layouts) as Array<keyof PptxChartLayouts>) {
		if (layouts[key] === undefined) {
			delete layouts[key];
		}
	}
	return Object.keys(layouts).length > 0 ? layouts : undefined;
}

function replaceKeyAt(node: XmlObject, key: string, value: XmlObject, index: number): void {
	const entries = Object.entries(node).filter(([candidate]) => candidate !== key);
	entries.splice(Math.max(0, Math.min(index, entries.length)), 0, [key, value]);
	for (const candidate of Object.keys(node)) {
		delete node[candidate];
	}
	for (const [candidate, candidateValue] of entries) {
		node[candidate] = candidateValue;
	}
}

function layoutIndex(parent: XmlObject, localName: LocalName): number {
	const names = Object.keys(parent).map(localName);
	const titleText = names.lastIndexOf('tx');
	if (titleText >= 0) {
		return titleText + 1;
	}
	let legendPrefix = -1;
	for (let i = 0; i < names.length; i++) {
		if (names[i] === 'legendPos' || names[i] === 'legendEntry') {
			legendPrefix = i;
		}
	}
	return legendPrefix + 1;
}

/** Apply or remove one typed manual layout while retaining extension data. */
export function applyChartManualLayout(
	parent: XmlObject | undefined,
	layout: PptxChartManualLayout | null | undefined,
	localName: LocalName,
): void {
	if (!parent || layout === undefined) {
		return;
	}
	const layoutKey = Object.keys(parent).find((key) => localName(key) === 'layout');
	const layoutNode = layoutKey ? (parent[layoutKey] as XmlObject) : undefined;
	const manualKey = layoutNode
		? Object.keys(layoutNode).find((key) => localName(key) === 'manualLayout')
		: undefined;
	if (layout === null) {
		if (!layoutNode || !manualKey) {
			return;
		}
		delete layoutNode[manualKey];
		if (Object.keys(layoutNode).length === 0 && layoutKey) {
			delete parent[layoutKey];
		}
		return;
	}
	const manual: XmlObject = {};
	const add = (name: string, value: string | number | undefined) => {
		if (value !== undefined) {
			manual[`c:${name}`] = { '@_val': String(value) };
		}
	};
	add('layoutTarget', layout.layoutTarget);
	add('xMode', layout.xMode);
	add('yMode', layout.yMode);
	add('wMode', layout.widthMode);
	add('hMode', layout.heightMode);
	add('x', layout.x);
	add('y', layout.y);
	add('w', layout.width);
	add('h', layout.height);
	// CT_ManualLayout.extLst is the trailing child; re-emit the captured raw
	// node so an edited layout preserves its extensions instead of dropping them.
	if (layout.ext !== undefined) {
		manual['c:extLst'] = layout.ext;
	}
	if (Object.keys(manual).length === 0) {
		return;
	}
	if (layoutNode) {
		layoutNode[manualKey ?? 'c:manualLayout'] = manual;
		return;
	}
	replaceKeyAt(parent, 'c:layout', { 'c:manualLayout': manual }, layoutIndex(parent, localName));
}

/** Apply all explicitly supplied chart-region layouts. */
export function applyChartLayouts(
	chartRoot: XmlObject,
	layouts: PptxChartLayouts,
	localName: LocalName,
): void {
	applyChartManualLayout(child(chartRoot, 'title', localName), layouts.title, localName);
	applyChartManualLayout(child(chartRoot, 'plotArea', localName), layouts.plotArea, localName);
	applyChartManualLayout(child(chartRoot, 'legend', localName), layouts.legend, localName);
}
