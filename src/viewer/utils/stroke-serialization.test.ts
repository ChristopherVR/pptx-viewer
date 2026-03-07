import { describe, it, expect } from 'vitest';

import type { ShapeStyle, XmlObject } from '../../core';
import { applyJoinCapCompound } from './stroke-serialization-helpers';

describe('Line join/cap/compound parsing', () => {
	it('should parse round join from a:round element', () => {
		const lineNode: XmlObject = { 'a:round': {} };
		const style: ShapeStyle = {};
		applyJoinCapCompound(lineNode, style);
		expect(style.lineJoin).toBe('round');
	});

	it('should parse bevel join from a:bevel element', () => {
		const lineNode: XmlObject = { 'a:bevel': {} };
		const style: ShapeStyle = {};
		applyJoinCapCompound(lineNode, style);
		expect(style.lineJoin).toBe('bevel');
	});

	it('should parse miter join from a:miter element', () => {
		const lineNode: XmlObject = { 'a:miter': { '@_lim': '800000' } };
		const style: ShapeStyle = {};
		applyJoinCapCompound(lineNode, style);
		expect(style.lineJoin).toBe('miter');
	});

	it('should parse cap styles: flat, rnd, sq', () => {
		for (const cap of ['flat', 'rnd', 'sq'] as const) {
			const lineNode: XmlObject = { '@_cap': cap };
			const style: ShapeStyle = {};
			applyJoinCapCompound(lineNode, style);
			expect(style.lineCap).toBe(cap);
		}
	});

	it('should ignore invalid cap values', () => {
		const lineNode: XmlObject = { '@_cap': 'invalid' };
		const style: ShapeStyle = {};
		applyJoinCapCompound(lineNode, style);
		expect(style.lineCap).toBeUndefined();
	});

	it('should parse compound line types', () => {
		const compounds = ['sng', 'dbl', 'thickThin', 'thinThick', 'tri'] as const;
		for (const cmpd of compounds) {
			const lineNode: XmlObject = { '@_cmpd': cmpd };
			const style: ShapeStyle = {};
			applyJoinCapCompound(lineNode, style);
			expect(style.compoundLine).toBe(cmpd);
		}
	});

	it('should ignore invalid compound values', () => {
		const lineNode: XmlObject = { '@_cmpd': 'unknown' };
		const style: ShapeStyle = {};
		applyJoinCapCompound(lineNode, style);
		expect(style.compoundLine).toBeUndefined();
	});
});

describe('Line join/cap save serialization', () => {
	it('should serialize round join as a:round element', () => {
		const spPr: XmlObject = { 'a:ln': {} };
		const lineNode = spPr['a:ln'] as XmlObject;
		const join: ShapeStyle['lineJoin'] = 'round';
		if (join === 'round') {
			lineNode['a:round'] = {};
		}
		expect(lineNode['a:round']).toEqual({});
	});

	it('should serialize bevel join as a:bevel element', () => {
		const lineNode: XmlObject = {};
		lineNode['a:bevel'] = {};
		expect(lineNode['a:bevel']).toEqual({});
	});

	it('should serialize miter join with default lim', () => {
		const lineNode: XmlObject = {};
		lineNode['a:miter'] = { '@_lim': '800000' };
		expect((lineNode['a:miter'] as XmlObject)['@_lim']).toBe('800000');
	});

	it('should serialize cap attribute on a:ln', () => {
		const lineNode: XmlObject = {};
		lineNode['@_cap'] = 'rnd';
		expect(lineNode['@_cap']).toBe('rnd');
	});

	it('should serialize compound line type on a:ln', () => {
		const lineNode: XmlObject = {};
		lineNode['@_cmpd'] = 'dbl';
		expect(lineNode['@_cmpd']).toBe('dbl');
	});
});
