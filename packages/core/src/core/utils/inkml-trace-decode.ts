import type { XmlObject } from '../types';

/** Channel names in trace-column order (upper-cased), e.g. ["X", "Y", "F"]. */
export type ChannelOrder = string[];

/**
 * Determine the trace channel order from the first `<inkml:traceFormat>` found
 * anywhere under the ink root (it may sit on the root itself, or nested under
 * `<definitions>/<context>/<inkSource>`). InkML's own default is "X Y", so we
 * fall back to that when no explicit traceFormat is present.
 */
export function resolveChannelOrder(root: XmlObject): ChannelOrder {
	const traceFormat = findFirstByLocalName(root, 'traceFormat');
	if (!traceFormat) {
		return ['X', 'Y'];
	}
	const channels = ensureArray(nsGet(traceFormat, 'channel'));
	const names = channels
		.map((channel) =>
			String(nsAttr(channel, 'name') ?? '')
				.trim()
				.toUpperCase(),
		)
		.filter((name) => name.length > 0);
	return names.length > 0 ? names : ['X', 'Y'];
}

/**
 * Decode a raw InkML trace string into per-point channel values.
 *
 * Points are comma-separated; the channel values within a point are
 * whitespace-separated and positionally map to `channelOrder`. InkML also
 * permits value prefixes that switch a channel into a difference encoding:
 * `!` explicit (absolute), `'` single difference (delta from the previous
 * point), `"` second difference (delta of the delta). The mode is sticky per
 * channel until another prefix appears. Absolute traces (the common Office
 * case, no prefixes) decode exactly; difference forms are reconstructed by
 * accumulation, and the second-difference case is a best-effort approximation.
 */
export function decodeTracePoints(text: string, channelOrder: ChannelOrder): number[][] {
	const points: number[][] = [];
	const modes: DiffMode[] = channelOrder.map(() => 'explicit');
	const lastValue: number[] = channelOrder.map(() => 0);
	const lastVelocity: number[] = channelOrder.map(() => 0);
	for (const rawPoint of text.split(',')) {
		const tokens = rawPoint
			.trim()
			.split(/\s+/u)
			.filter((token) => token.length > 0);
		if (tokens.length === 0) {
			continue;
		}
		const decoded: number[] = [];
		for (let i = 0; i < tokens.length && i < channelOrder.length; i++) {
			const parsed = parseValueToken(tokens[i], modes[i]);
			if (parsed === undefined) {
				decoded.push(lastValue[i]);
				continue;
			}
			modes[i] = parsed.mode;
			const value = applyDiffMode(parsed, i, lastValue, lastVelocity);
			decoded.push(value);
		}
		if (decoded.length >= 2) {
			points.push(decoded);
		}
	}
	return points;
}

type DiffMode = 'explicit' | 'single' | 'double';

interface ParsedToken {
	value: number;
	mode: DiffMode;
}

/** Parse one whitespace-delimited channel token, honouring InkML mode prefixes. */
function parseValueToken(token: string, currentMode: DiffMode): ParsedToken | undefined {
	let mode = currentMode;
	let body = token;
	const prefix = token[0];
	if (prefix === '!') {
		mode = 'explicit';
		body = token.slice(1);
	} else if (prefix === "'") {
		mode = 'single';
		body = token.slice(1);
	} else if (prefix === '"') {
		mode = 'double';
		body = token.slice(1);
	}
	if (body.length === 0) {
		return undefined;
	}
	const value = Number(body);
	return Number.isFinite(value) ? { value, mode } : undefined;
}

/** Fold a parsed token into an absolute value using its (sticky) difference mode. */
function applyDiffMode(
	parsed: ParsedToken,
	index: number,
	lastValue: number[],
	lastVelocity: number[],
): number {
	if (parsed.mode === 'single') {
		lastVelocity[index] = parsed.value;
		lastValue[index] += parsed.value;
	} else if (parsed.mode === 'double') {
		lastVelocity[index] += parsed.value;
		lastValue[index] += lastVelocity[index];
	} else {
		lastValue[index] = parsed.value;
		lastVelocity[index] = 0;
	}
	return lastValue[index];
}

/** Build an SVG path (`M x y L x y ...`) from decoded points and channel order. */
export function pointsToSvgPath(points: number[][], channelOrder: ChannelOrder): string {
	const xi = channelOrder.indexOf('X');
	const yi = channelOrder.indexOf('Y');
	const xIndex = xi >= 0 ? xi : 0;
	const yIndex = yi >= 0 ? yi : 1;
	const segments: string[] = [];
	for (const point of points) {
		const x = point[xIndex];
		const y = point[yIndex];
		if (!Number.isFinite(x) || !Number.isFinite(y)) {
			continue;
		}
		segments.push(`${segments.length === 0 ? 'M' : 'L'} ${x} ${y}`);
	}
	return segments.join(' ');
}

/** Extract normalised (0-1) pressure values from the F channel, when present. */
export function pointsToPressures(points: number[][], channelOrder: ChannelOrder): number[] {
	const fIndex = channelOrder.indexOf('F');
	if (fIndex < 0) {
		return [];
	}
	const pressures: number[] = [];
	for (const point of points) {
		const raw = point[fIndex];
		if (Number.isFinite(raw)) {
			// InkML force is commonly integer-encoded (0..32767); clamp to 0-1
			// for the renderer, normalising the typical integer range.
			const normalised = raw > 1 ? raw / 32767 : raw;
			pressures.push(Math.max(0, Math.min(1, normalised)));
		}
	}
	return pressures;
}

/** Read a child value by local element name, ignoring any XML namespace prefix. */
export function nsGet(obj: XmlObject, localName: string): unknown {
	if (localName in obj) {
		return obj[localName];
	}
	for (const key of Object.keys(obj)) {
		if (localNameOf(key) === localName && !key.startsWith('@_')) {
			return obj[key];
		}
	}
	return undefined;
}

/** Read an attribute value by local name, ignoring the `@_` prefix and any ns. */
export function nsAttr(obj: XmlObject, localName: string): unknown {
	const direct = obj[`@_${localName}`];
	if (direct !== undefined) {
		return direct;
	}
	for (const key of Object.keys(obj)) {
		if (key.startsWith('@_') && localNameOf(key.slice(2)) === localName) {
			return obj[key];
		}
	}
	return undefined;
}

/** Strip a leading `prefix:` namespace qualifier from an element/attribute key. */
function localNameOf(key: string): string {
	const colon = key.indexOf(':');
	return colon >= 0 ? key.slice(colon + 1) : key;
}

/** Depth-first search for the first descendant element with the given local name. */
function findFirstByLocalName(node: XmlObject, localName: string): XmlObject | undefined {
	const direct = nsGet(node, localName);
	if (direct && typeof direct === 'object') {
		return (Array.isArray(direct) ? direct[0] : direct) as XmlObject;
	}
	for (const key of Object.keys(node)) {
		if (key.startsWith('@_') || key === '#text') {
			continue;
		}
		for (const child of ensureArray(node[key])) {
			if (typeof child !== 'object') {
				continue;
			}
			const found = findFirstByLocalName(child, localName);
			if (found) {
				return found;
			}
		}
	}
	return undefined;
}

/** Coerce a possibly-single XML node (or absent value) into an array. */
export function ensureArray(value: unknown): XmlObject[] {
	if (value === undefined || value === null) {
		return [];
	}
	return (Array.isArray(value) ? value : [value]) as XmlObject[];
}
