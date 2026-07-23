import { describe, it, expect } from 'vitest';

import { evaluatePresetAdjustmentFormula } from './preset-avlst-fmla';

// Since these are protected methods on a deeply chained mixin, we extract
// their logic and test it directly. Implementations below are copied
// verbatim from PptxHandlerRuntimeGeometryParsing.ts.

// --- ensureArray helper (used throughout the runtime) ---
function ensureArray(val: unknown): unknown[] {
	if (val === undefined || val === null) {
		return [];
	}
	return Array.isArray(val) ? val : [val];
}

// --- Extracted from parseGeometryAdjustments ---
function parseGeometryAdjustments(
	prstGeom: Record<string, unknown> | undefined,
): Record<string, number> | undefined {
	if (!prstGeom) {
		return undefined;
	}
	const gdNodes = ensureArray(
		(prstGeom['a:avLst'] as Record<string, unknown> | undefined)?.['a:gd'],
	) as Record<string, unknown>[];
	if (gdNodes.length === 0) {
		return undefined;
	}

	const adjustments: Record<string, number> = {};
	const priorAdjustments = new Map<string, number>();
	for (const gd of gdNodes) {
		const name = String(gd?.['@_name'] || '').trim();
		if (!name) {
			continue;
		}
		let value: number | undefined;

		if (gd?.['@_val'] !== undefined) {
			const parsed = Number.parseInt(String(gd['@_val']), 10);
			if (Number.isFinite(parsed)) {
				value = parsed;
			}
		}
		if (value === undefined && gd?.['@_fmla']) {
			const formula = String(gd['@_fmla']).trim();
			const match = formula.match(/^val\s+(-?\d+)$/i);
			if (match) {
				const parsed = Number.parseInt(match[1], 10);
				if (Number.isFinite(parsed)) {
					value = parsed;
				}
			} else {
				value = evaluatePresetAdjustmentFormula(formula, name, priorAdjustments);
			}
		}

		if (value !== undefined) {
			adjustments[name] = value;
			priorAdjustments.set(name, value);
		}
	}

	return Object.keys(adjustments).length > 0 ? adjustments : undefined;
}

// --- Extracted from parseCropFraction ---
function parseCropFraction(value: unknown): number | undefined {
	const raw = Number.parseInt(String(value ?? ''), 10);
	if (!Number.isFinite(raw)) {
		return undefined;
	}
	const normalized = Math.max(0, Math.min(100000, raw)) / 100000;
	return normalized;
}

// --- Extracted from readImageCropFromBlipFill ---
function readImageCropFromBlipFill(blipFill: Record<string, unknown> | undefined): {
	cropLeft?: number;
	cropTop?: number;
	cropRight?: number;
	cropBottom?: number;
} {
	// Primary crop source: a:srcRect
	const sourceRect = blipFill?.['a:srcRect'] as Record<string, unknown> | undefined;
	if (sourceRect) {
		const cropLeft = parseCropFraction(sourceRect['@_l']);
		const cropTop = parseCropFraction(sourceRect['@_t']);
		const cropRight = parseCropFraction(sourceRect['@_r']);
		const cropBottom = parseCropFraction(sourceRect['@_b']);
		return { cropLeft, cropTop, cropRight, cropBottom };
	}

	// Fallback: a:stretch/a:fillRect with non-zero margins also acts as crop
	const stretchNode = blipFill?.['a:stretch'] as Record<string, unknown> | undefined;
	const fillRect = stretchNode?.['a:fillRect'] as Record<string, unknown> | undefined;
	if (fillRect) {
		const l = parseCropFraction(fillRect['@_l']);
		const t = parseCropFraction(fillRect['@_t']);
		const r = parseCropFraction(fillRect['@_r']);
		const b = parseCropFraction(fillRect['@_b']);
		if (l !== undefined || t !== undefined || r !== undefined || b !== undefined) {
			return { cropLeft: l, cropTop: t, cropRight: r, cropBottom: b };
		}
	}

	return {};
}

// ---------------------------------------------------------------------------
// parseGeometryAdjustments
// ---------------------------------------------------------------------------
describe('parseGeometryAdjustments', () => {
	it('should return undefined for undefined input', () => {
		expect(parseGeometryAdjustments(undefined)).toBeUndefined();
	});

	it('should return undefined when a:avLst is missing', () => {
		expect(parseGeometryAdjustments({})).toBeUndefined();
	});

	it('should return undefined when a:avLst has no a:gd children', () => {
		expect(parseGeometryAdjustments({ 'a:avLst': {} })).toBeUndefined();
	});

	it('should return undefined when a:avLst a:gd is an empty array', () => {
		expect(parseGeometryAdjustments({ 'a:avLst': { 'a:gd': [] } })).toBeUndefined();
	});

	it('should parse a single adjustment with @_val', () => {
		const result = parseGeometryAdjustments({
			'a:avLst': {
				'a:gd': { '@_name': 'adj', '@_val': '50000' },
			},
		});
		expect(result).toStrictEqual({ adj: 50000 });
	});

	it('should parse multiple adjustments from an array', () => {
		const result = parseGeometryAdjustments({
			'a:avLst': {
				'a:gd': [
					{ '@_name': 'adj1', '@_val': '25000' },
					{ '@_name': 'adj2', '@_val': '75000' },
				],
			},
		});
		expect(result).toStrictEqual({ adj1: 25000, adj2: 75000 });
	});

	it('should parse adjustment from val formula', () => {
		const result = parseGeometryAdjustments({
			'a:avLst': {
				'a:gd': { '@_name': 'adj', '@_fmla': 'val 12345' },
			},
		});
		expect(result).toStrictEqual({ adj: 12345 });
	});

	it('should parse negative value from val formula', () => {
		const result = parseGeometryAdjustments({
			'a:avLst': {
				'a:gd': { '@_name': 'adj', '@_fmla': 'val -5000' },
			},
		});
		expect(result).toStrictEqual({ adj: -5000 });
	});

	it('should prefer @_val over @_fmla', () => {
		const result = parseGeometryAdjustments({
			'a:avLst': {
				'a:gd': {
					'@_name': 'adj',
					'@_val': '100',
					'@_fmla': 'val 200',
				},
			},
		});
		expect(result).toStrictEqual({ adj: 100 });
	});

	it('should skip entries with empty name', () => {
		const result = parseGeometryAdjustments({
			'a:avLst': {
				'a:gd': [
					{ '@_name': '', '@_val': '100' },
					{ '@_name': 'adj', '@_val': '200' },
				],
			},
		});
		expect(result).toStrictEqual({ adj: 200 });
	});

	it('should return undefined when all entries have invalid values', () => {
		const result = parseGeometryAdjustments({
			'a:avLst': {
				'a:gd': { '@_name': 'adj', '@_val': 'notanumber' },
			},
		});
		expect(result).toBeUndefined();
	});

	it('should defer entries referencing an unresolvable guide', () => {
		const result = parseGeometryAdjustments({
			'a:avLst': {
				'a:gd': { '@_name': 'adj', '@_fmla': '*/2 adj 100000' },
			},
		});
		expect(result).toBeUndefined();
	});

	it('should evaluate a non-literal arithmetic fmla over literals', () => {
		const result = parseGeometryAdjustments({
			'a:avLst': {
				// (100000 * 1) / 2 = 50000
				'a:gd': { '@_name': 'adj', '@_fmla': '*/ 100000 1 2' },
			},
		});
		expect(result).toStrictEqual({ adj: 50000 });
	});

	it('should evaluate a +- fmla over literals', () => {
		const result = parseGeometryAdjustments({
			'a:avLst': {
				// 50000 + 10000 - 20000 = 40000
				'a:gd': { '@_name': 'adj', '@_fmla': '+- 50000 10000 20000' },
			},
		});
		expect(result).toStrictEqual({ adj: 40000 });
	});

	it('should evaluate a pin (clamp) fmla over literals', () => {
		const result = parseGeometryAdjustments({
			'a:avLst': {
				// clamp 60000 between 0 and 100000 = 60000
				'a:gd': { '@_name': 'adj', '@_fmla': 'pin 0 60000 100000' },
			},
		});
		expect(result).toStrictEqual({ adj: 60000 });
	});

	it('should evaluate a fmla that references an earlier adjustment', () => {
		const result = parseGeometryAdjustments({
			'a:avLst': {
				'a:gd': [
					{ '@_name': 'adj1', '@_val': '20000' },
					// (adj1 * 2) / 1 = 40000
					{ '@_name': 'adj2', '@_fmla': '*/ adj1 2 1' },
				],
			},
		});
		expect(result).toStrictEqual({ adj1: 20000, adj2: 40000 });
	});

	it('should defer a geometry-dependent fmla (needs shape width/height)', () => {
		const result = parseGeometryAdjustments({
			'a:avLst': {
				// references `w`: cannot resolve without geometry at parse time
				'a:gd': { '@_name': 'adj', '@_fmla': '*/ w 1 2' },
			},
		});
		expect(result).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// evaluatePresetAdjustmentFormula
// ---------------------------------------------------------------------------
describe('evaluatePresetAdjustmentFormula', () => {
	const noPrior = new Map<string, number>();

	it('evaluates arithmetic over numeric literals', () => {
		expect(evaluatePresetAdjustmentFormula('*/ 100000 1 2', 'adj', noPrior)).toBe(50000);
		expect(evaluatePresetAdjustmentFormula('+/ 40000 20000 2', 'adj', noPrior)).toBe(30000);
		expect(evaluatePresetAdjustmentFormula('min 30000 70000', 'adj', noPrior)).toBe(30000);
		expect(evaluatePresetAdjustmentFormula('max 30000 70000', 'adj', noPrior)).toBe(70000);
	});

	it('resolves references to prior adjustments', () => {
		const prior = new Map<string, number>([['adj1', 25000]]);
		expect(evaluatePresetAdjustmentFormula('*/ adj1 2 1', 'adj2', prior)).toBe(50000);
	});

	it('resolves the always-zero l/t constants', () => {
		expect(evaluatePresetAdjustmentFormula('+- l 12345 0', 'adj', noPrior)).toBe(12345);
	});

	it('defers formulas that reference geometry-dependent built-ins', () => {
		expect(evaluatePresetAdjustmentFormula('*/ w 1 2', 'adj', noPrior)).toBeUndefined();
		expect(evaluatePresetAdjustmentFormula('*/ h 1 2', 'adj', noPrior)).toBeUndefined();
		expect(evaluatePresetAdjustmentFormula('+- hc 0 0', 'adj', noPrior)).toBeUndefined();
	});

	it('defers formulas referencing an unknown/external guide', () => {
		expect(evaluatePresetAdjustmentFormula('*/ someGuide 1 2', 'adj', noPrior)).toBeUndefined();
	});

	it('returns undefined for an empty formula', () => {
		expect(evaluatePresetAdjustmentFormula('   ', 'adj', noPrior)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// parseCropFraction
// ---------------------------------------------------------------------------
describe('parseCropFraction', () => {
	it('should return undefined for undefined input', () => {
		expect(parseCropFraction(undefined)).toBeUndefined();
	});

	it('should return undefined for empty string', () => {
		expect(parseCropFraction('')).toBeUndefined();
	});

	it('should return undefined for non-numeric string', () => {
		expect(parseCropFraction('abc')).toBeUndefined();
	});

	it("should return 0 for '0'", () => {
		expect(parseCropFraction('0')).toBe(0);
	});

	it("should return 1 for '100000'", () => {
		expect(parseCropFraction('100000')).toBe(1);
	});

	it("should return 0.5 for '50000'", () => {
		expect(parseCropFraction('50000')).toBe(0.5);
	});

	it('should clamp negative values to 0', () => {
		expect(parseCropFraction('-5000')).toBe(0);
	});

	it('should clamp values above 100000 to 1', () => {
		expect(parseCropFraction('200000')).toBe(1);
	});

	it('should handle numeric input (not just strings)', () => {
		expect(parseCropFraction(25000)).toBe(0.25);
	});
});

// ---------------------------------------------------------------------------
// readImageCropFromBlipFill
// ---------------------------------------------------------------------------
describe('readImageCropFromBlipFill', () => {
	it('should return empty object for undefined input', () => {
		expect(readImageCropFromBlipFill(undefined)).toStrictEqual({});
	});

	it('should return empty object when no crop info is present', () => {
		expect(readImageCropFromBlipFill({})).toStrictEqual({});
	});

	it('should parse crop from a:srcRect', () => {
		const result = readImageCropFromBlipFill({
			'a:srcRect': {
				'@_l': '10000',
				'@_t': '20000',
				'@_r': '30000',
				'@_b': '40000',
			},
		});
		expect(result).toStrictEqual({
			cropLeft: 0.1,
			cropTop: 0.2,
			cropRight: 0.3,
			cropBottom: 0.4,
		});
	});

	it('should return undefined crop values when a:srcRect attrs are missing', () => {
		const result = readImageCropFromBlipFill({
			'a:srcRect': {},
		});
		expect(result).toStrictEqual({
			cropLeft: undefined,
			cropTop: undefined,
			cropRight: undefined,
			cropBottom: undefined,
		});
	});

	it('should parse partial crop from a:srcRect (only left and right)', () => {
		const result = readImageCropFromBlipFill({
			'a:srcRect': {
				'@_l': '5000',
				'@_r': '5000',
			},
		});
		expect(result).toStrictEqual({
			cropLeft: 0.05,
			cropTop: undefined,
			cropRight: 0.05,
			cropBottom: undefined,
		});
	});

	it('should use a:stretch/a:fillRect as fallback', () => {
		const result = readImageCropFromBlipFill({
			'a:stretch': {
				'a:fillRect': {
					'@_l': '10000',
					'@_t': '10000',
					'@_r': '10000',
					'@_b': '10000',
				},
			},
		});
		expect(result).toStrictEqual({
			cropLeft: 0.1,
			cropTop: 0.1,
			cropRight: 0.1,
			cropBottom: 0.1,
		});
	});

	it('should prefer a:srcRect over a:stretch/a:fillRect', () => {
		const result = readImageCropFromBlipFill({
			'a:srcRect': { '@_l': '20000' },
			'a:stretch': {
				'a:fillRect': { '@_l': '50000' },
			},
		});
		expect(result.cropLeft).toBe(0.2);
	});

	it('should return empty object when a:stretch/a:fillRect has no values', () => {
		const result = readImageCropFromBlipFill({
			'a:stretch': {
				'a:fillRect': {},
			},
		});
		expect(result).toStrictEqual({});
	});
});
