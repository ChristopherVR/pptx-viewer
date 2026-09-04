import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { applyCustomGeometryGuideOverrides } from './custom-geometry-guide-writeback';

describe('applyCustomGeometryGuideOverrides', () => {
	it('returns the input unchanged when there are no overrides', () => {
		const custGeom: XmlObject = {
			'a:avLst': { 'a:gd': { '@_name': 'adj1', '@_fmla': 'val 25000' } },
		};
		expect(applyCustomGeometryGuideOverrides(custGeom, undefined)).toBe(custGeom);
		expect(applyCustomGeometryGuideOverrides(custGeom, {})).toBe(custGeom);
	});

	it('patches an existing a:gd/@_fmla to the dragged value', () => {
		const custGeom: XmlObject = {
			'a:avLst': { 'a:gd': { '@_name': 'adj1', '@_fmla': 'val 25000' } },
		};
		const patched = applyCustomGeometryGuideOverrides(custGeom, { adj1: 40000 });
		expect(patched['a:avLst']).toStrictEqual({
			'a:gd': { '@_name': 'adj1', '@_fmla': 'val 40000' },
		});
	});

	it('preserves every OTHER a:gd entry when patching one of several', () => {
		const custGeom: XmlObject = {
			'a:avLst': {
				'a:gd': [
					{ '@_name': 'adj1', '@_fmla': 'val 25000' },
					{ '@_name': 'adj2', '@_fmla': 'val 50000' },
				],
			},
		};
		const patched = applyCustomGeometryGuideOverrides(custGeom, { adj2: 10000 });
		expect(patched['a:avLst']).toStrictEqual({
			'a:gd': [
				{ '@_name': 'adj1', '@_fmla': 'val 25000' },
				{ '@_name': 'adj2', '@_fmla': 'val 10000' },
			],
		});
	});

	it('adds a new a:gd entry for an override naming a guide not already in a:avLst', () => {
		const custGeom: XmlObject = { 'a:avLst': {} };
		const patched = applyCustomGeometryGuideOverrides(custGeom, { adj1: 12345 });
		expect(patched['a:avLst']).toStrictEqual({
			'a:gd': { '@_name': 'adj1', '@_fmla': 'val 12345' },
		});
	});

	it('ignores a non-finite override value', () => {
		const custGeom: XmlObject = {
			'a:avLst': { 'a:gd': { '@_name': 'adj1', '@_fmla': 'val 25000' } },
		};
		const patched = applyCustomGeometryGuideOverrides(custGeom, { adj1: Number.NaN });
		expect(patched).toBe(custGeom);
	});
});
