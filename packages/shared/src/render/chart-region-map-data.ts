import type { PptxChartRegionMapOptions } from 'pptx-viewer-core';

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
