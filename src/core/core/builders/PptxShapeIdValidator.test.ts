import { describe, it, expect } from 'vitest';
import { PptxShapeIdValidator } from './PptxShapeIdValidator';
import type { XmlObject } from '../../types';

const ensureArray = (value: unknown): unknown[] => {
	if (Array.isArray(value)) return value;
	if (value === undefined || value === null) return [];
	return [value];
};

describe('PptxShapeIdValidator', () => {
	const validator = new PptxShapeIdValidator();

	it('should return 0 when all IDs are unique', () => {
		const spTree: XmlObject = {
			'p:sp': [
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '2', '@_name': 'Shape 1' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '3', '@_name': 'Shape 2' } } },
			],
		};
		const result = validator.validateAndDeduplicateIds(spTree, ensureArray);
		expect(result).toBe(0);
	});

	it('should reassign duplicate IDs', () => {
		const spTree: XmlObject = {
			'p:sp': [
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '2', '@_name': 'Shape 1' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '2', '@_name': 'Shape 2' } } },
			],
		};
		const result = validator.validateAndDeduplicateIds(spTree, ensureArray);
		expect(result).toBe(1);

		const shapes = spTree['p:sp'] as XmlObject[];
		const id1 = (shapes[0]['p:nvSpPr'] as XmlObject)['p:cNvPr']['@_id'];
		const id2 = (shapes[1]['p:nvSpPr'] as XmlObject)['p:cNvPr']['@_id'];
		expect(id1).not.toBe(id2);
	});

	it('should reassign zero IDs', () => {
		const spTree: XmlObject = {
			'p:sp': [
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '0', '@_name': 'Shape 1' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '5', '@_name': 'Shape 2' } } },
			],
		};
		const result = validator.validateAndDeduplicateIds(spTree, ensureArray);
		expect(result).toBe(1);

		const shapes = spTree['p:sp'] as XmlObject[];
		const id1 = (shapes[0]['p:nvSpPr'] as XmlObject)['p:cNvPr']['@_id'];
		expect(id1).toBe('6');
	});

	it('should handle mixed element types (shapes, pics, connectors)', () => {
		const spTree: XmlObject = {
			'p:sp': { 'p:nvSpPr': { 'p:cNvPr': { '@_id': '2', '@_name': 'Shape' } } },
			'p:pic': { 'p:nvPicPr': { 'p:cNvPr': { '@_id': '2', '@_name': 'Pic' } } },
			'p:cxnSp': { 'p:nvCxnSpPr': { 'p:cNvPr': { '@_id': '2', '@_name': 'Connector' } } },
		};
		const result = validator.validateAndDeduplicateIds(spTree, ensureArray);
		expect(result).toBe(2);
	});

	it('should handle nested group shapes', () => {
		const spTree: XmlObject = {
			'p:grpSp': {
				'p:nvGrpSpPr': { 'p:cNvPr': { '@_id': '2', '@_name': 'Group' } },
				'p:sp': [
					{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '2', '@_name': 'Child1' } } },
					{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '3', '@_name': 'Child2' } } },
				],
			},
		};
		const result = validator.validateAndDeduplicateIds(spTree, ensureArray);
		expect(result).toBe(1);
	});

	it('should return 0 for empty spTree', () => {
		const spTree: XmlObject = {};
		const result = validator.validateAndDeduplicateIds(spTree, ensureArray);
		expect(result).toBe(0);
	});

	it('should handle cloned shapes with all duplicate IDs', () => {
		const spTree: XmlObject = {
			'p:sp': [
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '5', '@_name': 'Original' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '5', '@_name': 'Clone 1' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '5', '@_name': 'Clone 2' } } },
			],
		};
		const result = validator.validateAndDeduplicateIds(spTree, ensureArray);
		expect(result).toBe(2);

		const shapes = spTree['p:sp'] as XmlObject[];
		const ids = shapes.map(
			(s) => (s['p:nvSpPr'] as XmlObject)['p:cNvPr']['@_id'],
		);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(3);
	});
});
