import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../types';
import { extractSetAnimations } from './native-animation-set-components';

describe('extractSetAnimations', () => {
	it('returns undefined when childTnList is absent', () => {
		expect(extractSetAnimations(undefined)).toBeUndefined();
	});

	it('returns undefined when there is no p:set sibling', () => {
		expect(extractSetAnimations({ 'p:anim': {} })).toBeUndefined();
	});

	it('extracts a string p:to value with attrName lowercased', () => {
		const childTnList: XmlObject = {
			'p:set': {
				'p:cBhvr': {
					'p:cTn': { '@_dur': '1' },
					'p:attrNameLst': { 'p:attrName': 'style.fontWeight' },
				},
				'p:to': { 'p:strVal': { '@_val': 'bold' } },
			},
		};
		expect(extractSetAnimations(childTnList)).toStrictEqual([
			{
				attrName: 'style.fontweight',
				value: 'bold',
				valueType: 'str',
				durationMs: 1,
				delayMs: undefined,
			},
		]);
	});

	it('extracts multiple sibling p:set nodes', () => {
		const childTnList: XmlObject = {
			'p:set': [
				{
					'p:cBhvr': { 'p:attrNameLst': { 'p:attrName': 'style.fontWeight' } },
					'p:to': { 'p:strVal': { '@_val': 'bold' } },
				},
				{
					'p:cBhvr': { 'p:attrNameLst': { 'p:attrName': 'style.fontStyle' } },
					'p:to': { 'p:strVal': { '@_val': 'italic' } },
				},
			],
		};
		const result = extractSetAnimations(childTnList);
		expect(result).toHaveLength(2);
		expect(result?.[0]?.attrName).toBe('style.fontweight');
		expect(result?.[1]?.attrName).toBe('style.fontstyle');
	});

	it('skips a p:set with no attrName', () => {
		const childTnList: XmlObject = {
			'p:set': {
				'p:cBhvr': {},
				'p:to': { 'p:strVal': { '@_val': 'bold' } },
			},
		};
		expect(extractSetAnimations(childTnList)).toBeUndefined();
	});

	it('skips a p:set with no p:to', () => {
		const childTnList: XmlObject = {
			'p:set': {
				'p:cBhvr': { 'p:attrNameLst': { 'p:attrName': 'style.fontWeight' } },
			},
		};
		expect(extractSetAnimations(childTnList)).toBeUndefined();
	});

	it('decodes a numeric p:intVal p:to (e.g. Change Font Size)', () => {
		const childTnList: XmlObject = {
			'p:set': {
				'p:cBhvr': { 'p:attrNameLst': { 'p:attrName': 'style.fontSize' } },
				'p:to': { 'p:intVal': { '@_val': '44' } },
			},
		};
		expect(extractSetAnimations(childTnList)).toStrictEqual([
			{
				attrName: 'style.fontsize',
				value: 44,
				valueType: 'int',
				durationMs: undefined,
				delayMs: undefined,
			},
		]);
	});
});
