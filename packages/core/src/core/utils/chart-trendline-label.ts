import type { PptxChartTrendlineLabel, XmlObject } from '../types';
import { applyChartManualLayout, parseChartManualLayout } from './chart-layout';

type LocalName = (key: string) => string;

function keyOf(
	node: XmlObject | undefined,
	name: string,
	localName: LocalName,
): string | undefined {
	return node ? Object.keys(node).find((key) => localName(key) === name) : undefined;
}

function child(
	node: XmlObject | undefined,
	name: string,
	localName: LocalName,
): XmlObject | undefined {
	const key = keyOf(node, name, localName);
	return key ? (node?.[key] as XmlObject | undefined) : undefined;
}

function booleanValue(node: XmlObject | undefined): boolean | undefined {
	if (!node) {
		return undefined;
	}
	const value = node['@_val'];
	return value === undefined || value === '1' ? true : value === '0' ? false : undefined;
}

/** Parse the editable subset of `CT_TrendlineLbl`. */
export function parseTrendlineLabel(
	node: XmlObject | undefined,
	localName: LocalName,
): PptxChartTrendlineLabel | undefined {
	if (!node) {
		return undefined;
	}
	const result: PptxChartTrendlineLabel = {};
	const layout = parseChartManualLayout(node, localName);
	if (layout) {
		result.layout = layout;
	}
	const numFmt = child(node, 'numFmt', localName);
	if (typeof numFmt?.['@_formatCode'] === 'string') {
		result.numberFormatCode = numFmt['@_formatCode'];
	}
	const sourceLinked = booleanValue(
		numFmt?.['@_sourceLinked'] === undefined ? undefined : { '@_val': numFmt['@_sourceLinked'] },
	);
	if (sourceLinked !== undefined) {
		result.sourceLinked = sourceLinked;
	}
	return Object.keys(result).length > 0 ? result : {};
}

/** Build a label edit while retaining unmodeled text, shape, and extension children. */
export function buildTrendlineLabel(
	existing: XmlObject | undefined,
	label: PptxChartTrendlineLabel,
	localName: LocalName,
): XmlObject {
	const node: XmlObject = existing ? { ...existing } : {};
	if (label.layout !== undefined) {
		applyChartManualLayout(node, label.layout, localName);
	}
	if (label.numberFormatCode !== undefined || label.sourceLinked !== undefined) {
		const oldKey = keyOf(node, 'numFmt', localName);
		const old = oldKey ? (node[oldKey] as XmlObject) : {};
		const numFmt: XmlObject = { ...old };
		if (label.numberFormatCode !== undefined) {
			numFmt['@_formatCode'] = label.numberFormatCode;
		}
		if (label.sourceLinked !== undefined) {
			numFmt['@_sourceLinked'] = label.sourceLinked ? '1' : '0';
		}
		if (oldKey && oldKey !== 'c:numFmt') {
			delete node[oldKey];
		}
		node['c:numFmt'] = numFmt;
	}
	return reorderLabel(node, localName);
}

function reorderLabel(node: XmlObject, localName: LocalName): XmlObject {
	const order = ['layout', 'tx', 'numFmt', 'spPr', 'txPr', 'extLst'];
	const entries = Object.entries(node);
	entries.sort(([a], [b]) => {
		const ai = order.indexOf(localName(a));
		const bi = order.indexOf(localName(b));
		return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
	});
	return Object.fromEntries(entries) as XmlObject;
}
