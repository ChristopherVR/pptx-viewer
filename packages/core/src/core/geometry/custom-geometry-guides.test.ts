import { describe, expect, it } from 'vitest';

import type { CustomGeometryRawData } from '../types';
import {
	resolveCustomGeometryGuideContext,
	resolveCustomGeometryToken,
} from './custom-geometry-guides';

describe('resolveCustomGeometryGuideContext', () => {
	it('evaluates a:avLst defaults into the guide map', () => {
		const rawData: CustomGeometryRawData = {
			avLstXml: { 'a:gd': [{ '@_name': 'adj1', '@_fmla': 'val 25000' }] },
		};
		const vars = resolveCustomGeometryGuideContext(rawData, 200, 100);
		expect(vars.get('adj1')).toBe(25000);
	});

	it('overrides win over the a:avLst default (a live drag patch)', () => {
		const rawData: CustomGeometryRawData = {
			avLstXml: { 'a:gd': [{ '@_name': 'adj1', '@_fmla': 'val 25000' }] },
		};
		const vars = resolveCustomGeometryGuideContext(rawData, 200, 100, { adj1: 40000 });
		expect(vars.get('adj1')).toBe(40000);
	});

	it('evaluates a:gdLst formulas that reference the adjustment and builtins', () => {
		const rawData: CustomGeometryRawData = {
			avLstXml: { 'a:gd': { '@_name': 'adj1', '@_fmla': 'val 25000' } },
			gdLstXml: { 'a:gd': { '@_name': 'x1', '@_fmla': '*/ w adj1 100000' } },
		};
		const vars = resolveCustomGeometryGuideContext(rawData, 200, 100);
		// x1 = w * adj1 / 100000 = 200 * 25000 / 100000 = 50
		expect(vars.get('x1')).toBe(50);
	});

	it('returns just the builtins when rawData is undefined', () => {
		const vars = resolveCustomGeometryGuideContext(undefined, 200, 100);
		expect(vars.get('w')).toBe(200);
		expect(vars.get('hc')).toBe(100);
	});
});

describe('resolveCustomGeometryToken', () => {
	it('resolves a numeric literal token', () => {
		expect(resolveCustomGeometryToken('42', new Map(), 0)).toBe(42);
	});

	it('resolves a guide-name token from the variable map', () => {
		const vars = new Map([['adj1', 30000]]);
		expect(resolveCustomGeometryToken('adj1', vars, 0)).toBe(30000);
	});

	it('resolves a multi-token inline formula', () => {
		const vars = new Map([['w', 200]]);
		expect(resolveCustomGeometryToken('*/ w 1 2', vars, 0)).toBe(100);
	});

	it('falls back when the token is undefined', () => {
		expect(resolveCustomGeometryToken(undefined, new Map(), 7)).toBe(7);
	});
});
