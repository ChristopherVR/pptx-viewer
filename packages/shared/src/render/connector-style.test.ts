import { describe, expect, it } from 'vitest';

import {
	connectorKind,
	connectorNeedsPath,
	getCompoundLineOffsets,
	getCompoundLineWidths,
	svgLineCap,
} from './connector-style';

// ── connectorKind ──────────────────────────────────────────────────────────

describe('connectorKind', () => {
	it('classifies straight connectors', () => {
		expect(connectorKind('straightConnector1')).toBe('straight');
		expect(connectorKind('line')).toBe('straight');
		expect(connectorKind(undefined)).toBe('straight');
	});

	it('classifies bent connectors', () => {
		expect(connectorKind('bentConnector3')).toBe('bent');
	});

	it('classifies curved connectors', () => {
		expect(connectorKind('curvedConnector2')).toBe('curved');
	});
});

// ── connectorNeedsPath ──────────────────────────────────────────────────────

describe('connectorNeedsPath', () => {
	it('returns false for straight connectors', () => {
		expect(connectorNeedsPath('straightConnector1')).toBeFalsy();
		expect(connectorNeedsPath('line')).toBeFalsy();
		expect(connectorNeedsPath(undefined)).toBeFalsy();
	});

	it('returns true for bentConnector* variants', () => {
		expect(connectorNeedsPath('bentConnector2')).toBeTruthy();
		expect(connectorNeedsPath('bentConnector5')).toBeTruthy();
	});

	it('returns true for curvedConnector* variants', () => {
		expect(connectorNeedsPath('curvedConnector2')).toBeTruthy();
		expect(connectorNeedsPath('curvedConnector5')).toBeTruthy();
	});

	it('is case-insensitive', () => {
		expect(connectorNeedsPath('BentConnector3')).toBeTruthy();
		expect(connectorNeedsPath('CURVEDCONNECTOR2')).toBeTruthy();
	});
});

// ── getCompoundLineOffsets ──────────────────────────────────────────────────

describe('getCompoundLineOffsets', () => {
	it('returns [0] for single / undefined compound line', () => {
		expect(getCompoundLineOffsets(undefined, 2)).toStrictEqual([0]);
		expect(getCompoundLineOffsets('sng', 2)).toStrictEqual([0]);
	});

	it('returns 2 offsets for dbl, symmetric around centre', () => {
		const offsets = getCompoundLineOffsets('dbl', 4);
		expect(offsets).toHaveLength(2);
		expect(offsets[0]).toBeLessThan(0);
		expect(offsets[1]).toBeGreaterThan(0);
		expect(Math.abs(offsets[0]!)).toBeCloseTo(Math.abs(offsets[1]!));
	});

	it('returns 2 offsets for thickThin and thinThick', () => {
		expect(getCompoundLineOffsets('thickThin', 4)).toHaveLength(2);
		expect(getCompoundLineOffsets('thinThick', 4)).toHaveLength(2);
	});

	it('returns 3 offsets for tri', () => {
		const offsets = getCompoundLineOffsets('tri', 4);
		expect(offsets).toHaveLength(3);
		expect(offsets[1]).toBe(0); // centre line
	});

	it('uses a minimum gap of 1.5 regardless of thin strokeWidth', () => {
		const offsets = getCompoundLineOffsets('dbl', 0.1);
		expect(Math.abs(offsets[0]!)).toBeGreaterThanOrEqual(1.5);
	});
});

// ── getCompoundLineWidths ────────────────────────────────────────────────────

describe('getCompoundLineWidths', () => {
	it('returns [base] for single / undefined compound line', () => {
		expect(getCompoundLineWidths(undefined, 4)).toStrictEqual([4]);
		expect(getCompoundLineWidths('sng', 4)).toStrictEqual([4]);
	});

	it('returns 2 widths summing to base for dbl', () => {
		const widths = getCompoundLineWidths('dbl', 4);
		expect(widths).toHaveLength(2);
		const sum = widths.reduce((a, b) => a + b, 0);
		expect(sum).toBeCloseTo(4);
	});

	it('returns 2 widths for thickThin and thinThick, ordered correctly', () => {
		const tt = getCompoundLineWidths('thickThin', 10);
		expect(tt[0]!).toBeGreaterThan(tt[1]!);
		const tn = getCompoundLineWidths('thinThick', 10);
		expect(tn[0]!).toBeLessThan(tn[1]!);
	});

	it('returns 3 widths for tri', () => {
		expect(getCompoundLineWidths('tri', 4)).toHaveLength(3);
	});

	it('enforces minimum base of 1 when strokeWidth is 0', () => {
		const widths = getCompoundLineWidths('sng', 0);
		expect(widths[0]).toBe(1);
	});
});

// ── svgLineCap ───────────────────────────────────────────────────────────────

describe('svgLineCap', () => {
	it('maps OOXML cap tokens to SVG stroke-linecap values', () => {
		expect(svgLineCap('flat')).toBe('butt');
		expect(svgLineCap('sq')).toBe('square');
		expect(svgLineCap('rnd')).toBe('round');
	});

	it('falls back to round for an unset cap', () => {
		expect(svgLineCap(undefined)).toBe('round');
	});
});
