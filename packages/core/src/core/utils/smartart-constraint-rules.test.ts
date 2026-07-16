import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode, XmlObject } from '../types';
import {
	applySmartArtConstraintRules,
	parseSmartArtConstraintRules,
	validateSmartArtConstraintRules,
} from './smartart-constraint-rules';
import {
	applySmartArtLayoutDefinition,
	parseSmartArtLayoutDefinition,
} from './smartart-layout-definition';

const localName = (key: string): string => key.split(':').at(-1)!;

describe('diagramML constraint and rule codec', () => {
	it('parses arbitrary prefixes and XML Schema double lexical values', () => {
		const parsed = parseSmartArtConstraintRules(
			{
				'x:constrLst': {
					'x:constr': {
						'@_type': 'w',
						'@_for': 'ch',
						'@_refType': 'h',
						'@_op': 'gte',
						'@_val': 'INF',
						'@_fact': '-INF',
					},
				},
				'x:ruleLst': {
					'x:rule': { '@_type': 'primFontSz', '@_val': '5', '@_fact': 'NaN', '@_max': 'NaN' },
				},
			},
			localName,
		);
		expect(parsed.constraints?.[0]).toMatchObject({
			type: 'w',
			for: 'ch',
			referenceType: 'h',
			operator: 'gte',
			value: Number.POSITIVE_INFINITY,
			factor: Number.NEGATIVE_INFINITY,
		});
		expect(parsed.rules?.[0].type).toBe('primFontSz');
		expect(Number.isNaN(parsed.rules?.[0].factor)).toBeTruthy();
		expect(Number.isNaN(parsed.rules?.[0].max)).toBeTruthy();
	});

	it('applies typed edits while preserving foreign attributes and extensions', () => {
		const node: XmlObject = {
			'x:constrLst': {
				'@_foreign': 'list',
				'x:constr': {
					'@_type': 'w',
					'@_val': '1',
					'@_foreign': 'item',
					'x:extLst': { 'x:ext': { '@_uri': 'keep' } },
				},
			},
			'x:ruleLst': { 'x:rule': { '@_type': 'primFontSz', '@_fact': 'NaN' } },
		};
		const value = parseSmartArtConstraintRules(node, localName);
		value.constraints![0].value = 42;
		value.constraints![0].referenceFor = 'des';
		value.rules![0].max = Number.POSITIVE_INFINITY;
		expect(applySmartArtConstraintRules(node, value, localName)).toBeTruthy();
		const constraint = (node['x:constrLst'] as XmlObject)['x:constr'] as XmlObject[];
		expect(constraint[0]).toMatchObject({
			'@_val': '42',
			'@_refFor': 'des',
			'@_foreign': 'item',
			'x:extLst': { 'x:ext': { '@_uri': 'keep' } },
		});
		const rule = (node['x:ruleLst'] as XmlObject)['x:rule'] as XmlObject[];
		expect(rule[0]['@_max']).toBe('INF');
		expect((node['x:constrLst'] as XmlObject)['@_foreign']).toBe('list');
	});

	it('validates required schema enums without rejecting valid non-finite doubles', () => {
		const value: PptxSmartArtLayoutNode = {
			constraints: [
				{
					type: 'not-a-type',
					for: 'invalid' as 'self',
					operator: 'bad' as 'equ',
					value: Number.NaN,
				},
			],
			rules: [{ type: 'w', max: Number.POSITIVE_INFINITY }],
		};
		expect(validateSmartArtConstraintRules(value)).toStrictEqual([
			'constraints[0].type is invalid',
			'constraints[0].for is invalid',
			'constraints[0].operator is invalid',
		]);
	});

	it('round-trips constraints through the editable layout-definition model', () => {
		const xml: XmlObject = {
			'x:layoutDef': {
				'x:layoutNode': {
					'@_name': 'root',
					'x:constrLst': { 'x:constr': { '@_type': 'h', '@_val': '10' } },
					'x:ruleLst': { 'x:rule': { '@_type': 'primFontSz', '@_max': '20' } },
				},
			},
		};
		const layout = parseSmartArtLayoutDefinition(xml['x:layoutDef'] as XmlObject, localName)!;
		layout.rootNode.constraints![0].value = 25;
		layout.rootNode.rules![0].factor = 0.5;
		expect(
			applySmartArtLayoutDefinition(xml['x:layoutDef'] as XmlObject, layout, localName),
		).toBeTruthy();
		const reparsed = parseSmartArtLayoutDefinition(xml['x:layoutDef'] as XmlObject, localName)!;
		expect(reparsed.rootNode.constraints?.[0].value).toBe(25);
		expect(reparsed.rootNode.rules?.[0].factor).toBe(0.5);
	});
});
