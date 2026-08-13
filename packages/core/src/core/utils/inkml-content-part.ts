import type { ContentPartInkStroke, XmlObject } from '../types';
import type { InkTargetBox } from './inkml-ink-space';
import { inkBounds, inkLengthToPx, inkPointMapper } from './inkml-ink-space';
import {
	collectByLocalName,
	decodeTracePoints,
	ensureArray,
	nsAttr,
	nsGet,
	pointsToPressures,
	pointsToSvgPath,
	resolveChannelOrder,
} from './inkml-trace-decode';

const INKML_NAMESPACE = 'http://www.w3.org/2003/InkML';
const METADATA_NAMESPACE = 'https://pptx-viewer.dev/inkml/metadata';

export interface ParsedInkMlContent {
	strokes: ContentPartInkStroke[];
	rawXml: XmlObject;
}

type BrushStyle = Pick<ContentPartInkStroke, 'color' | 'width' | 'opacity'>;

const DEFAULT_BRUSH: BrushStyle = { color: '#000000', width: 1, opacity: 1 };

/**
 * Parse authored InkML trace/brush metadata while tolerating plain legacy traces.
 *
 * `box` is the `p:contentPart` extent in CSS pixels. When it is supplied, every
 * trace decoded from raw channel data is normalised into that box (see
 * `inkml-ink-space`), because a real PowerPoint InkML part is written in its own
 * device units and would otherwise land thousands of pixels off-element. Strokes
 * carrying the library's own authored `@pva:path` are already in element space
 * and pass through untouched.
 */
export function parseInkMlContent(data: XmlObject, box?: InkTargetBox): ParsedInkMlContent {
	const root = (nsGet(data, 'ink') ?? data['ink']) as XmlObject | undefined;
	if (!root) {
		return { strokes: [], rawXml: data };
	}
	const brushes = collectBrushes(root);
	const channelOrder = resolveChannelOrder(root);

	// Two passes: decode every trace first so the normalisation bounds cover the
	// whole part, then emit paths. A per-stroke bound would rescale each stroke
	// independently and pull the drawing apart.
	const decoded = collectByLocalName(root, 'trace').map((trace) => {
		const text = typeof trace === 'string' ? String(trace) : String(trace['#text'] ?? '').trim();
		// The library's own authored format stamps a ready-made SVG `@pva:path`
		// on each trace. A real PowerPoint InkML part has none: its trace text
		// is channel data (e.g. "100 200,'40'46") that must be decoded into
		// `M x y L x y ...` before it can drive an SVG `<path d>`.
		const authored = typeof trace === 'string' ? '' : String(nsAttr(trace, 'path') ?? '').trim();
		return {
			authored,
			text,
			points: authored ? [] : decodeTracePoints(text, channelOrder),
			brushRef:
				typeof trace === 'string' ? '' : String(nsAttr(trace, 'brushRef') ?? '').replace('#', ''),
		};
	});

	const bounds = box ? inkBounds(decoded.map((entry) => entry.points)) : undefined;
	const mapPoint = bounds && box ? inkPointMapper(bounds, box) : undefined;

	const strokes: ContentPartInkStroke[] = [];
	for (const entry of decoded) {
		const points = mapPoint ? mapDecodedPoints(entry.points, channelOrder, mapPoint) : entry.points;
		const path = entry.authored || pointsToSvgPath(points, mapPoint ? ['X', 'Y'] : channelOrder);
		if (!path) {
			continue;
		}
		const brush = brushes.get(entry.brushRef) ?? DEFAULT_BRUSH;
		const pressures = entry.authored
			? tracePressures(entry.text)
			: pointsToPressures(entry.points, channelOrder);
		strokes.push({ ...brush, path, ...(pressures.length > 0 ? { pressures } : {}) });
	}
	return { strokes, rawXml: data };
}

/** Re-project decoded channel values, keeping every non-XY channel in place. */
function mapDecodedPoints(
	points: readonly (readonly number[])[],
	channelOrder: readonly string[],
	mapPoint: (x: number, y: number) => [number, number],
): number[][] {
	const xi = Math.max(channelOrder.indexOf('X'), 0);
	const yi = channelOrder.indexOf('Y') >= 0 ? channelOrder.indexOf('Y') : 1;
	return points.map((point) => mapPoint(point[xi], point[yi]));
}

/**
 * Index every `<brush>` in the part by id, wherever it sits.
 *
 * PowerPoint nests its brushes inside `<inkml:definitions>`, so a direct-child
 * lookup found none of them and every real stroke fell back to a 1 px black
 * default. Brush measurements carry their own `units` attribute (PowerPoint
 * writes `units="cm"`), so a raw `Number(value)` would have produced a 0.05 px
 * stroke even once the brush was found.
 */
function collectBrushes(root: XmlObject): Map<string, BrushStyle> {
	const brushes = new Map<string, BrushStyle>();
	for (const brush of collectByLocalName(root, 'brush')) {
		if (typeof brush === 'string') {
			continue;
		}
		const properties = new Map<string, { value: unknown; units: unknown }>();
		for (const property of ensureArray(nsGet(brush, 'brushProperty'))) {
			properties.set(String(nsAttr(property, 'name') ?? ''), {
				value: nsAttr(property, 'value'),
				units: nsAttr(property, 'units'),
			});
		}
		const size = properties.get('width') ?? properties.get('height');
		const width = size
			? inkLengthToPx(Number(size.value), size.units === undefined ? undefined : String(size.units))
			: Number.NaN;
		const id = String(nsAttr(brush, 'id') ?? '');
		brushes.set(id, {
			color: String(properties.get('color')?.value ?? DEFAULT_BRUSH.color),
			width: Number.isFinite(width) && width > 0 ? width : DEFAULT_BRUSH.width,
			opacity: brushOpacity(properties),
		});
	}
	return brushes;
}

/**
 * Stroke alpha. The library's own authored parts carry a direct `opacity`
 * (0..1); PowerPoint instead writes InkML's `transparency`, an integer where 0
 * is opaque and 255 is invisible (its highlighter pen is the usual producer).
 */
function brushOpacity(properties: Map<string, { value: unknown; units: unknown }>): number {
	const direct = Number(properties.get('opacity')?.value);
	if (Number.isFinite(direct)) {
		return Math.min(1, Math.max(0, direct));
	}
	const transparency = Number(properties.get('transparency')?.value);
	if (Number.isFinite(transparency)) {
		return 1 - Math.min(255, Math.max(0, transparency)) / 255;
	}
	return DEFAULT_BRUSH.opacity;
}

/** Build schema-shaped InkML while retaining unknown nodes from a loaded part. */
export function buildInkMlContent(
	strokes: readonly ContentPartInkStroke[],
	rawXml?: XmlObject,
): XmlObject {
	const data = rawXml ? { ...rawXml } : {};
	// A loaded PowerPoint part is keyed `inkml:ink`, not `ink:ink`. Missing that
	// wrote a SECOND root element beside PowerPoint's, producing an XML part with
	// two roots that no consumer can read.
	const existingKey = Object.keys(data).find((key) => localNameOf(key) === 'ink');
	const existingRoot = existingKey ? (data[existingKey] as XmlObject | undefined) : undefined;
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
	// The rewritten root replaces whatever prefix the source used, and the
	// source's own definitions/traces must not survive beside it.
	if (existingKey) {
		delete data[existingKey];
	}
	delete data['ink'];
	deleteStaleInkChildren(root);
	data['ink:ink'] = root;
	return data;
}

/** Drop the source part's own trace/brush/definition nodes after a rewrite. */
function deleteStaleInkChildren(root: XmlObject): void {
	for (const key of Object.keys(root)) {
		if (key.startsWith('ink:') || key.startsWith('@_') || key === '#text') {
			continue;
		}
		const local = localNameOf(key);
		if (
			local === 'trace' ||
			local === 'brush' ||
			local === 'traceGroup' ||
			local === 'definitions'
		) {
			delete root[key];
		}
	}
}

function localNameOf(key: string): string {
	const colon = key.indexOf(':');
	return colon >= 0 ? key.slice(colon + 1) : key;
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
