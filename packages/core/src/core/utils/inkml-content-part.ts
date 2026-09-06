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
	pointsToTilt,
	resolveChannelOrder,
	tiltChannelsFromXY,
} from './inkml-trace-decode';
import type { TiltChannels } from './inkml-trace-decode';

// Re-exported for the existing import sites (and colocated tests): the
// writer half of this module was split out to `inkml-content-part-writer.ts`
// to keep both files under this repo's file-size guideline.
export { buildInkMlContent } from './inkml-content-part-writer';

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
		// The library's own authored format encodes tilt (when the stroke has
		// any) as two trailing columns after the pressure value: `x y f <a> <b>`.
		// That is always positional (distinct from a foreign trace's declared
		// `channelOrder`-driven decode), but WHICH pair those two trailing
		// columns are (the `OTx`/`OTy` vector, or `AZIMUTH`/`ALTITUDE` degrees)
		// still has to follow the part's own declared channel names: this
		// writer's `buildInkMlContent` stamps `pva:path` on every trace
		// regardless of tilt mode, so an authored AZIMUTH/ALTITUDE part is
		// indistinguishable from a vector one by shape alone.
		const azimuthEncoded = channelOrder.includes('AZIMUTH');
		const tilt = entry.authored
			? traceTilt(entry.text, azimuthEncoded)
			: pointsToTilt(entry.points, channelOrder);
		strokes.push({
			...brush,
			path,
			...(pressures.length > 0 ? { pressures } : {}),
			...(tilt && tilt.encoding === 'azimuthAltitude'
				? {
						tiltAngles: tilt.angles,
						tiltMagnitudes: tilt.magnitudes,
						tiltEncoding: 'azimuthAltitude',
					}
				: tilt
					? { tiltAngles: tilt.angles, tiltMagnitudes: tilt.magnitudes }
					: {}),
		});
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

/**
 * Extract tilt data from this project's own authored trace text
 * (`x y pressure <a> <b>`, see the writer's `pathToTrace` in
 * `inkml-content-part-writer.ts`). Distinct from `pointsToTilt`, which
 * decodes a foreign trace via its declared `channelOrder`; the authored
 * format is always positional, so a point missing the trailing pair is
 * simply skipped.
 *
 * `azimuthEncoded` selects which pair the two trailing columns are: this
 * writer stamps its own ready-made `pva:path` on EVERY trace regardless of
 * tilt mode (see `buildInkMlContent`), so an authored part cannot be told
 * apart from its `channelOrder` shape alone; the caller passes whether the
 * part's own declared `traceFormat` includes `AZIMUTH`.
 */
function traceTilt(text: string, azimuthEncoded: boolean): TiltChannels | undefined {
	const as: number[] = [];
	const bs: number[] = [];
	for (const point of text.split(',')) {
		const values = point.trim().split(/[\s]+/u).map(Number);
		if (values.length >= 5 && Number.isFinite(values[3]) && Number.isFinite(values[4])) {
			as.push(values[3]);
			bs.push(values[4]);
		}
	}
	if (as.length === 0) {
		return undefined;
	}
	return azimuthEncoded ? azimuthAltitudeFromDegrees(as, bs) : tiltChannelsFromXY(as, bs);
}

/**
 * Authored-dialect counterpart of `inkml-trace-decode.ts`'s
 * `tiltFromAzimuthAltitude`, for the positionally-parsed `azimuths`/
 * `altitudes` pair `traceTilt` already extracted (rather than a raw
 * `channelOrder`-indexed point array).
 */
function azimuthAltitudeFromDegrees(
	azimuths: readonly number[],
	altitudes: readonly number[],
): TiltChannels {
	const angles = azimuths.map((azimuth) => (azimuth * Math.PI) / 180);
	const magnitudes = altitudes.map((altitude) => Math.max(0, Math.min(1, 1 - altitude / 90)));
	return { angles, magnitudes, encoding: 'azimuthAltitude' };
}
