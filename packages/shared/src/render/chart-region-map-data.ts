import type { PptxChartRegionMapOptions, PptxCxValueColorPosition } from 'pptx-viewer-core';

export interface RegionMapEntry {
	sourceIndex: number;
	label: string;
	value: number;
	entityId?: string;
	code?: string;
}

type RegionCodeResolver = (label: string) => string | undefined;

function sourceIndices(indices: number[] | undefined, length: number): number[] {
	return Array.from({ length }, (_, position) => indices?.[position] ?? position);
}

function valueAtSource<T>(
	values: readonly T[],
	indices: number[],
	sourceIndex: number,
): T | undefined {
	const position = indices.indexOf(sourceIndex);
	return position >= 0 ? values[position] : undefined;
}

function cachedEntityName(cache: unknown, entityId: string): string | undefined {
	if (!cache || typeof cache !== 'object') {
		return undefined;
	}
	const record = cache as Record<string, unknown>;
	if (String(record['@_entityId'] ?? '') === entityId && record['@_entityName'] !== undefined) {
		return String(record['@_entityName']);
	}
	for (const value of Object.values(record)) {
		if (Array.isArray(value)) {
			for (const item of value) {
				const name = cachedEntityName(item, entityId);
				if (name) {
					return name;
				}
			}
		} else {
			const name = cachedEntityName(value, entityId);
			if (name) {
				return name;
			}
		}
	}
	return undefined;
}

/** Resolve provider IDs directly, by suffix, or through an authored geo cache. */
export function resolveRegionEntityCode(
	entityId: string | undefined,
	options: PptxChartRegionMapOptions | undefined,
	resolveCode: RegionCodeResolver,
): string | undefined {
	if (!entityId) {
		return undefined;
	}
	const direct = resolveCode(entityId);
	if (direct) {
		return direct;
	}
	const tokens = entityId.split(/[:/|._-]+/u).filter(Boolean);
	for (let index = tokens.length - 1; index >= 0; index--) {
		const resolved = resolveCode(tokens[index] ?? '');
		if (resolved) {
			return resolved;
		}
	}
	const cachedName = cachedEntityName(options?.geographyCache, entityId);
	return cachedName ? resolveCode(cachedName) : undefined;
}

/** Align region-map dimensions by their original `cx:pt/@idx` source indexes. */
export function buildRegionMapEntries(
	categories: readonly string[],
	values: readonly number[],
	options: PptxChartRegionMapOptions | undefined,
	resolveCode: RegionCodeResolver,
): RegionMapEntry[] {
	const entityIds = options?.entityIds ?? [];
	const categoryIndices = sourceIndices(options?.categorySourceIndices, categories.length);
	const valueIndices = sourceIndices(options?.valueSourceIndices, values.length);
	const entityIndices = sourceIndices(options?.entityIdSourceIndices, entityIds.length);
	const indices = [...new Set([...categoryIndices, ...valueIndices, ...entityIndices])].sort(
		(a, b) => a - b,
	);
	return indices.map((sourceIndex) => {
		const category = valueAtSource(categories, categoryIndices, sourceIndex) ?? '';
		const value = valueAtSource(values, valueIndices, sourceIndex) ?? 0;
		const entityId = valueAtSource(entityIds, entityIndices, sourceIndex);
		return {
			sourceIndex,
			label: category || entityId || `Region ${sourceIndex + 1}`,
			value,
			...(entityId ? { entityId } : {}),
			code: resolveRegionEntityCode(entityId, options, resolveCode) ?? resolveCode(category),
		};
	});
}

/** Office's bestFitOnly is implementation-defined; require a readable label box. */
export function shouldRenderRegionLabel(
	layout: PptxChartRegionMapOptions['regionLabelLayout'],
	projectedWidth: number,
	projectedHeight: number,
): boolean {
	if (layout === 'none') {
		return false;
	}
	if (layout === 'bestFitOnly') {
		return projectedWidth >= 18 && projectedHeight >= 10;
	}
	return true;
}

/** Format geographic values using the authored culture when it is valid. */
export function formatRegionMapValue(value: number, cultureLanguage: string | undefined): string {
	if (!cultureLanguage) {
		return String(value);
	}
	try {
		return new Intl.NumberFormat(cultureLanguage, { maximumFractionDigits: 2 }).format(value);
	} catch {
		return String(value);
	}
}

/** Interpolate between two `#RRGGBB` hex colours by ratio `t` in [0, 1]. */
export function lerpColor(a: string, b: string, t: number): string {
	const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v))),
		ha = a.replace('#', ''),
		hb = b.replace('#', ''),
		r1 = parseInt(ha.substring(0, 2), 16),
		g1 = parseInt(ha.substring(2, 4), 16),
		b1 = parseInt(ha.substring(4, 6), 16),
		r2 = parseInt(hb.substring(0, 2), 16),
		g2 = parseInt(hb.substring(2, 4), 16),
		b2 = parseInt(hb.substring(4, 6), 16),
		r = clamp(r1 + (r2 - r1) * t),
		g = clamp(g1 + (g2 - g1) * t),
		bl = clamp(b1 + (b2 - b1) * t),
		toHex = (n: number): string => n.toString(16).padStart(2, '0');
	return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

/** One resolved `cx:valueColors` gradient stop: a colour at a normalised [0, 1] position. */
export interface RegionMapColorStop {
	position: number;
	color: string;
}

/**
 * Resolve `cx:valueColors` (2-3 hex stops) + `cx:valueColorPositions` (their
 * breakpoints) into normalised [0, 1] gradient stops, or `undefined` when the
 * chart authors no value-color scale (the categorical/sequential palette
 * applies instead).
 *
 * `cx:colorPosition/@type` breakpoints: `min`/`max` pin to the data extremes;
 * `number` is an absolute value re-normalised against `minVal`/`maxVal`;
 * `percent` is already a 0-100 fraction of the range. A stop with no
 * authored position falls back to an even split across the stop count,
 * matching PowerPoint's own default (min/mid/max for 3 stops).
 */
export function resolveValueColorStops(
	valueColors: readonly string[] | undefined,
	valueColorPositions: readonly PptxCxValueColorPosition[] | undefined,
	minVal: number,
	maxVal: number,
): RegionMapColorStop[] | undefined {
	if (!valueColors || valueColors.length < 2) {
		return undefined;
	}
	const span = maxVal - minVal || 1,
		count = valueColors.length,
		resolvePosition = (position: PptxCxValueColorPosition | undefined, index: number): number => {
			if (position?.kind === 'min') {
				return 0;
			}
			if (position?.kind === 'max') {
				return 1;
			}
			if (position?.kind === 'number' && position.value !== undefined) {
				return Math.min(1, Math.max(0, (position.value - minVal) / span));
			}
			if (position?.kind === 'percent' && position.value !== undefined) {
				return Math.min(1, Math.max(0, position.value / 100));
			}
			return count === 1 ? 0 : index / (count - 1);
		};
	return valueColors.map((color, index) => ({
		color,
		position: resolvePosition(valueColorPositions?.[index], index),
	}));
}

/**
 * Build a colour-scale function from resolved gradient stops: linearly
 * interpolates between the two stops bracketing `t`, clamping to the nearest
 * stop outside the authored range.
 */
export function buildValueColorScale(stops: readonly RegionMapColorStop[]): (t: number) => string {
	const sorted = [...stops].sort((a, b) => a.position - b.position);
	return (t: number): string => {
		const clamped = Math.max(0, Math.min(1, t)),
			first = sorted[0];
		if (!first) {
			return '#94a3b8';
		}
		if (sorted.length === 1) {
			return first.color;
		}
		for (let i = 0; i < sorted.length - 1; i++) {
			const a = sorted[i],
				b = sorted[i + 1];
			if (clamped >= a.position && clamped <= b.position) {
				return lerpColor(a.color, b.color, (clamped - a.position) / (b.position - a.position || 1));
			}
		}
		const last = sorted[sorted.length - 1] ?? first;
		return clamped <= first.position ? first.color : last.color;
	};
}
