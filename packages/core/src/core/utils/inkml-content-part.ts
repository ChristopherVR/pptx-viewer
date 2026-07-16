import type { ContentPartInkStroke, XmlObject } from '../types';

const INKML_NAMESPACE = 'http://www.w3.org/2003/InkML';
const METADATA_NAMESPACE = 'https://pptx-viewer.dev/inkml/metadata';

export interface ParsedInkMlContent {
	strokes: ContentPartInkStroke[];
	rawXml: XmlObject;
}

/** Parse authored InkML trace/brush metadata while tolerating plain legacy traces. */
export function parseInkMlContent(data: XmlObject): ParsedInkMlContent {
	const root = (data['ink:ink'] ?? data['ink']) as XmlObject | undefined;
	if (!root) {
		return { strokes: [], rawXml: data };
	}
	const brushes = new Map<string, Pick<ContentPartInkStroke, 'color' | 'width' | 'opacity'>>();
	for (const brush of ensureArray(root['ink:brush'] ?? root['brush'])) {
		const properties = ensureArray(brush['ink:brushProperty'] ?? brush['brushProperty']);
		const valueByName = new Map(
			properties.map((property) => [String(property['@_name'] ?? ''), property['@_value']]),
		);
		brushes.set(String(brush['@_id'] ?? ''), {
			color: String(valueByName.get('color') ?? '#000000'),
			width: finiteNumber(valueByName.get('width'), 1),
			opacity: finiteNumber(valueByName.get('opacity'), 1),
		});
	}
	const strokes: ContentPartInkStroke[] = [];
	for (const trace of ensureArray(root['ink:trace'] ?? root['trace'])) {
		const text = typeof trace === 'string' ? trace : String(trace['#text'] ?? '').trim();
		const path =
			typeof trace === 'string' ? text : String(trace['@_pva:path'] ?? '').trim() || text;
		if (!path) {
			continue;
		}
		const brushRef =
			typeof trace === 'string' ? '' : String(trace['@_brushRef'] ?? '').replace('#', '');
		const brush = brushes.get(brushRef) ?? { color: '#000000', width: 1, opacity: 1 };
		const pressures = tracePressures(text);
		strokes.push({ ...brush, path, ...(pressures.length > 0 ? { pressures } : {}) });
	}
	return { strokes, rawXml: data };
}

/** Build schema-shaped InkML while retaining unknown nodes from a loaded part. */
export function buildInkMlContent(
	strokes: readonly ContentPartInkStroke[],
	rawXml?: XmlObject,
): XmlObject {
	const data = rawXml ? { ...rawXml } : {};
	const existingRoot = (data['ink:ink'] ?? data['ink']) as XmlObject | undefined;
	const root: XmlObject = existingRoot ? { ...existingRoot } : {};
	root['@_xmlns:ink'] = INKML_NAMESPACE;
	root['@_xmlns:pva'] = METADATA_NAMESPACE;
	root['ink:traceFormat'] = {
		'ink:channel': [
			{ '@_name': 'X', '@_type': 'decimal' },
			{ '@_name': 'Y', '@_type': 'decimal' },
			{ '@_name': 'F', '@_type': 'decimal', '@_min': '0', '@_max': '1' },
		],
	};
	root['ink:brush'] = strokes.map((stroke, index) => ({
		'@_id': `brush${index + 1}`,
		'ink:brushProperty': [
			{ '@_name': 'color', '@_value': stroke.color },
			{ '@_name': 'width', '@_value': String(stroke.width) },
			{ '@_name': 'opacity', '@_value': String(stroke.opacity) },
		],
	}));
	root['ink:trace'] = strokes.map((stroke, index) => ({
		'@_brushRef': `#brush${index + 1}`,
		'@_pva:path': stroke.path,
		'#text': pathToTrace(stroke.path, stroke.pressures),
	}));
	data['ink:ink'] = root;
	delete data['ink'];
	return data;
}

function pathToTrace(path: string, pressures: readonly number[] | undefined): string {
	const points = [...path.matchAll(/[ML]\s*(?<x>[\d.eE+-]+)[,\s]+(?<y>[\d.eE+-]+)/giu)];
	if (points.length === 0) {
		return path;
	}
	return points
		.map((point, index) => {
			const pressure = Math.max(0, Math.min(1, pressures?.[index] ?? 0.5));
			return `${point.groups?.x} ${point.groups?.y} ${pressure}`;
		})
		.join(', ');
}

function tracePressures(text: string): number[] {
	const pressures: number[] = [];
	for (const point of text.split(',')) {
		const values = point.trim().split(/[\s]+/u).map(Number);
		if (values.length >= 3 && Number.isFinite(values[2])) {
			pressures.push(Math.max(0, Math.min(1, values[2])));
		}
	}
	return pressures;
}

function finiteNumber(value: unknown, fallback: number): number {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function ensureArray(value: unknown): XmlObject[] {
	if (value === undefined || value === null) {
		return [];
	}
	return (Array.isArray(value) ? value : [value]) as XmlObject[];
}
