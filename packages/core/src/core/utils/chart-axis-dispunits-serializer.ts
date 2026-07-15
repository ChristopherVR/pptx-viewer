import type {
	PptxChartAxisFormatting,
	PptxChartDisplayUnitsLabel,
	PptxChartShapeProps,
	XmlObject,
} from '../types';
import { applyChartManualLayout, parseChartManualLayout } from './chart-layout';
import { parseShapeProps } from './chart-series-detail-parser';

type LocalName = (key: string) => string;
interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
}
interface ColorParserLike {
	parseColor: (fillNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
}

const BUILT_IN_UNITS = new Set([
	'hundreds',
	'thousands',
	'tenThousands',
	'hundredThousands',
	'millions',
	'tenMillions',
	'hundredMillions',
	'billions',
	'trillions',
]);

const findKey = (node: XmlObject, name: string, localName: LocalName) =>
	Object.keys(node).find((key) => localName(key) === name);

function setOrdered(
	node: XmlObject,
	name: string,
	value: XmlObject,
	order: readonly string[],
	localName: LocalName,
): void {
	const existing = findKey(node, name, localName);
	if (existing) {
		node[existing] = value;
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

function collectText(node: XmlObject, result: string[]): void {
	for (const [key, value] of Object.entries(node)) {
		if (key.replace(/^.*:/u, '') === 't') {
			result.push(String(value));
		} else if (Array.isArray(value)) {
			for (const child of value) {
				if (child && typeof child === 'object') {
					collectText(child, result);
				}
			}
		} else if (value && typeof value === 'object') {
			collectText(value as XmlObject, result);
		}
	}
}

/** Parse the complete modeled CT_DispUnits and CT_DispUnitsLbl subset. */
export function parseChartAxisDisplayUnits(
	node: XmlObject,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
	target: PptxChartAxisFormatting,
	localName: LocalName,
): void {
	const builtIn = xmlLookup.getChildByLocalName(node, 'builtInUnit');
	const builtInValue = String(builtIn?.['@_val'] ?? '').trim();
	if (BUILT_IN_UNITS.has(builtInValue)) {
		target.displayUnits = builtInValue as PptxChartAxisFormatting['displayUnits'];
	}
	const custom = Number(xmlLookup.getChildByLocalName(node, 'custUnit')?.['@_val']);
	if (Number.isFinite(custom) && custom !== 0) {
		target.displayUnits = 'custom';
		target.displayUnitsValue = custom;
	}
	const labelNode = xmlLookup.getChildByLocalName(node, 'dispUnitsLbl');
	if (!labelNode) {
		return;
	}
	const label: PptxChartDisplayUnitsLabel = {};
	const text: string[] = [];
	collectText(xmlLookup.getChildByLocalName(labelNode, 'tx') ?? {}, text);
	if (text.length) {
		label.text = text.join('');
	}
	label.layout = parseChartManualLayout(labelNode, localName);
	label.spPr = parseShapeProps(
		xmlLookup.getChildByLocalName(labelNode, 'spPr'),
		xmlLookup as Parameters<typeof parseShapeProps>[1],
		colorParser,
	);
	for (const key of Object.keys(label) as Array<keyof PptxChartDisplayUnitsLabel>) {
		if (label[key] === undefined) {
			delete label[key];
		}
	}
	target.displayUnitsLabel = label;
}

function applyShapeProps(existing: XmlObject | undefined, style: PptxChartShapeProps): XmlObject {
	const result: XmlObject = { ...(existing ?? {}) };
	if (style.fillColor) {
		result['a:solidFill'] = { 'a:srgbClr': { '@_val': style.fillColor.replace(/^#/u, '') } };
	}
	if (style.strokeColor || style.strokeWidth !== undefined || style.strokeDashStyle) {
		const line: XmlObject = { ...((result['a:ln'] as XmlObject | undefined) ?? {}) };
		if (style.strokeColor) {
			line['a:solidFill'] = { 'a:srgbClr': { '@_val': style.strokeColor.replace(/^#/u, '') } };
		}
		if (style.strokeWidth !== undefined) {
			line['@_w'] = String(Math.round(style.strokeWidth * 12700));
		}
		if (style.strokeDashStyle) {
			line['a:prstDash'] = { '@_val': style.strokeDashStyle };
		}
		result['a:ln'] = line;
	}
	return result;
}

function applyLabel(
	node: XmlObject,
	edit: string | PptxChartDisplayUnitsLabel | null | undefined,
	localName: LocalName,
): void {
	if (edit === undefined) {
		return;
	}
	const key = findKey(node, 'dispUnitsLbl', localName);
	if (edit === null) {
		if (key) {
			delete node[key];
		}
		return;
	}
	const labelEdit = typeof edit === 'string' ? { text: edit } : edit;
	const label: XmlObject = { ...((key ? node[key] : undefined) as XmlObject | undefined) };
	applyChartManualLayout(label, labelEdit.layout, localName);
	if (labelEdit.text !== undefined) {
		setOrdered(
			label,
			'tx',
			{
				'c:rich': { 'a:bodyPr': {}, 'a:lstStyle': {}, 'a:p': { 'a:r': { 'a:t': labelEdit.text } } },
			},
			['layout', 'tx', 'spPr', 'txPr'],
			localName,
		);
	}
	if (labelEdit.spPr !== undefined) {
		const spPrKey = findKey(label, 'spPr', localName);
		if (labelEdit.spPr === null) {
			if (spPrKey) {
				delete label[spPrKey];
			}
		} else {
			setOrdered(
				label,
				'spPr',
				applyShapeProps(spPrKey ? (label[spPrKey] as XmlObject) : undefined, labelEdit.spPr),
				['layout', 'tx', 'spPr', 'txPr'],
				localName,
			);
		}
	}
	setOrdered(
		node,
		'dispUnitsLbl',
		label,
		['custUnit', 'builtInUnit', 'dispUnitsLbl', 'extLst'],
		localName,
	);
}

/** Reconcile CT_DispUnits while retaining extensions and unmodeled label XML. */
export function applyChartAxisDisplayUnitsToXml(
	axisNode: XmlObject,
	axis: Pick<PptxChartAxisFormatting, 'displayUnits' | 'displayUnitsValue' | 'displayUnitsLabel'>,
	localName: LocalName,
): void {
	const existingKey = findKey(axisNode, 'dispUnits', localName);
	if (!axis.displayUnits) {
		if (existingKey) {
			delete axisNode[existingKey];
		}
		return;
	}
	if (axis.displayUnits !== 'custom' && !BUILT_IN_UNITS.has(axis.displayUnits)) {
		throw new RangeError(`Unsupported built-in display unit: ${axis.displayUnits}`);
	}
	const node: XmlObject = {
		...((existingKey ? axisNode[existingKey] : undefined) as XmlObject | undefined),
	};
	for (const choice of ['custUnit', 'builtInUnit']) {
		const key = findKey(node, choice, localName);
		if (key) {
			delete node[key];
		}
	}
	if (axis.displayUnits === 'custom') {
		const value = axis.displayUnitsValue ?? 1;
		if (!Number.isFinite(value) || value === 0) {
			throw new RangeError('Custom display unit must be finite and non-zero');
		}
		setOrdered(
			node,
			'custUnit',
			{ '@_val': String(value) },
			['custUnit', 'builtInUnit', 'dispUnitsLbl', 'extLst'],
			localName,
		);
	} else {
		setOrdered(
			node,
			'builtInUnit',
			{ '@_val': axis.displayUnits },
			['custUnit', 'builtInUnit', 'dispUnitsLbl', 'extLst'],
			localName,
		);
	}
	applyLabel(node, axis.displayUnitsLabel, localName);
	setOrdered(axisNode, 'dispUnits', node, ['dispUnits', 'extLst'], localName);
}
