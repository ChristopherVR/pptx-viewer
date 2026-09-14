import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import { PptxShapeIdValidator } from './PptxShapeIdValidator';

const ensureArray = (value: unknown): unknown[] => {
	if (Array.isArray(value)) {
		return value;
	}
	if (value === undefined || value === null) {
		return [];
	}
	return [value];
};

describe('pptxShapeIdValidator', () => {
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

	it('deduplicates content-part and fallback ids inside AlternateContent', () => {
		const spTree: XmlObject = {
			'p:sp': {
				'p:nvSpPr': { 'p:cNvPr': { '@_id': '2', '@_name': 'Existing shape' } },
			},
			'mc:AlternateContent': {
				'mc:Choice': {
					'p:contentPart': {
						'p:nvContentPartPr': {
							'p:cNvPr': { '@_id': '2', '@_name': 'Ink content' },
						},
					},
				},
				'mc:Fallback': {
					'p:sp': {
						'p:nvSpPr': { 'p:cNvPr': { '@_id': '0', '@_name': 'Ink fallback' } },
					},
				},
			},
		};
		const result = validator.validateAndDeduplicateIds(spTree, ensureArray);
		expect(result).toBe(2);

		const alternate = spTree['mc:AlternateContent'] as XmlObject;
		const choice = alternate['mc:Choice'] as XmlObject;
		const contentPart = choice['p:contentPart'] as XmlObject;
		const contentNv = contentPart['p:nvContentPartPr'] as XmlObject;
		const fallback = alternate['mc:Fallback'] as XmlObject;
		const fallbackShape = fallback['p:sp'] as XmlObject;
		const fallbackNv = fallbackShape['p:nvSpPr'] as XmlObject;
		const ids = [
			'2',
			String((contentNv['p:cNvPr'] as XmlObject)['@_id']),
			String((fallbackNv['p:cNvPr'] as XmlObject)['@_id']),
		];
		expect(new Set(ids).size).toBe(3);
		expect(ids).not.toContain('0');
	});

	it('deduplicates a p14-qualified content-part id against an ordinary shape', () => {
		// A real (and this project's own authored) `p:contentPart`'s non-visual
		// id lives at `p14:nvContentPartPr/p14:cNvPr`, not the `p:`-qualified
		// path. Missing that made this id invisible to the validator, so a
		// freshly authored content part could silently collide with another
		// shape's id and produce a package real PowerPoint's own reader
		// rejects as corrupted (0x80070570).
		const spTree: XmlObject = {
			'p:sp': {
				'p:nvSpPr': { 'p:cNvPr': { '@_id': '2', '@_name': 'Rectangle 1' } },
			},
			'mc:AlternateContent': {
				'mc:Choice': {
					'p:contentPart': {
						'p14:nvContentPartPr': {
							'p14:cNvPr': { '@_id': '2', '@_name': 'Ink 1' },
						},
					},
				},
				'mc:Fallback': {
					'p:sp': {
						'p:nvSpPr': { 'p:cNvPr': { '@_id': '3', '@_name': 'Ink fallback' } },
					},
				},
			},
		};
		const result = validator.validateAndDeduplicateIds(spTree, ensureArray);
		expect(result).toBe(1);

		const alternate = spTree['mc:AlternateContent'] as XmlObject;
		const choice = alternate['mc:Choice'] as XmlObject;
		const contentPart = choice['p:contentPart'] as XmlObject;
		const contentNv = contentPart['p14:nvContentPartPr'] as XmlObject;
		const contentPartId = String((contentNv['p14:cNvPr'] as XmlObject)['@_id']);
		// The ordinary shape (id 2) keeps its id; the content part's colliding
		// id is the one reassigned.
		expect(contentPartId).not.toBe('2');
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
		const ids = shapes.map((s) => (s['p:nvSpPr'] as XmlObject)['p:cNvPr']['@_id']);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(3);
	});

	it('remaps a connector endpoint bound to a reassigned duplicate id', () => {
		// Pasting a shape together with a connector that targets it clones both
		// with the same id. Deduplicating the shape without also updating the
		// connector's `a:stCxn`/`a:endCxn` reference detaches the connector's
		// endpoint from the very shape it was pasted with.
		const spTree: XmlObject = {
			'p:sp': [
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '2', '@_name': 'Shape 1' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '2', '@_name': 'Pasted shape' } } },
			],
			'p:cxnSp': {
				'p:nvCxnSpPr': {
					'p:cNvPr': { '@_id': '3', '@_name': 'Connector 1' },
					'p:cNvCxnSpPr': {
						'a:stCxn': { '@_id': '2', '@_idx': '0' },
						'a:endCxn': { '@_id': '99', '@_idx': '2' },
					},
				},
			},
		};
		const result = validator.validateAndDeduplicateIds(spTree, ensureArray);
		expect(result).toBe(1);

		const shapes = spTree['p:sp'] as XmlObject[];
		const reassignedId = (shapes[1]['p:nvSpPr'] as XmlObject)['p:cNvPr']['@_id'];
		expect(reassignedId).not.toBe('2');

		const cxnSp = spTree['p:cxnSp'] as XmlObject;
		const cNvCxnSpPr = (cxnSp['p:nvCxnSpPr'] as XmlObject)['p:cNvCxnSpPr'] as XmlObject;
		// The connector was pasted alongside the duplicate, so its stCxn
		// reference follows the reassignment; the untouched endCxn (bound to an
		// id no shape in this tree carries) is left alone.
		expect((cNvCxnSpPr['a:stCxn'] as XmlObject)['@_id']).toBe(reassignedId);
		expect((cNvCxnSpPr['a:endCxn'] as XmlObject)['@_id']).toBe('99');
	});

	const idsOf = (spTree: XmlObject): string[] =>
		(spTree['p:sp'] as XmlObject[]).map((s) =>
			String((s['p:nvSpPr'] as XmlObject)['p:cNvPr']['@_id']),
		);

	it('treats an out-of-range id as invalid rather than as the running maximum', () => {
		// `ST_DrawingElementId` is a UInt32. A timestamp-sized id used to be
		// accepted as the "max so far" and every later reassignment was
		// incremented from it, writing more schema-invalid ids.
		const spTree: XmlObject = {
			'p:sp': [
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '1788524999615', '@_name': 'Stamped' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '4', '@_name': 'Fine' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '4', '@_name': 'Duplicate' } } },
			],
		};
		expect(validator.validateAndDeduplicateIds(spTree, ensureArray)).toBe(2);
		expect(idsOf(spTree)).toStrictEqual(['5', '4', '6']);
	});

	it('reassigns non-integer, negative, decimal and 4294967296 ids', () => {
		const spTree: XmlObject = {
			'p:sp': [
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': 'abc' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '-3' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '2.5' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '4294967296' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '7' } } },
			],
		};
		expect(validator.validateAndDeduplicateIds(spTree, ensureArray)).toBe(4);
		expect(idsOf(spTree)).toStrictEqual(['8', '9', '10', '11', '7']);
	});

	it('keeps the UInt32 ceiling and wraps into free gaps once it is reached', () => {
		const spTree: XmlObject = {
			'p:sp': [
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '4294967295' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '4294967295' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '1' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '0' } } },
			],
		};
		expect(validator.validateAndDeduplicateIds(spTree, ensureArray)).toBe(2);
		expect(idsOf(spTree)).toStrictEqual(['4294967295', '2', '1', '3']);
	});

	it('returns the reassignment map and remaps timing targets under the reference root', () => {
		const spTree: XmlObject = {
			'p:sp': [
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '2' } } },
				{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '2' } } },
			],
		};
		const root: XmlObject = {
			'p:cSld': { 'p:spTree': spTree },
			'p:timing': { 'p:tgtEl': { 'p:spTgt': { '@_spid': '2' } }, 'p:cTn': { '@_id': '2' } },
		};
		const result = validator.repairShapeIds(spTree, ensureArray, root);
		expect(result.reassigned).toBe(1);
		expect(Array.from(result.ids.entries())).toStrictEqual([['2', '3']]);
		const timing = root['p:timing'] as XmlObject;
		expect(((timing['p:tgtEl'] as XmlObject)['p:spTgt'] as XmlObject)['@_spid']).toBe('3');
		expect((timing['p:cTn'] as XmlObject)['@_id']).toBe('2');
	});

	it('does not record a missing id as a remappable key', () => {
		const spTree: XmlObject = { 'p:sp': [{ 'p:nvSpPr': { 'p:cNvPr': { '@_name': 'No id' } } }] };
		const result = validator.repairShapeIds(spTree, ensureArray);
		expect(result.reassigned).toBe(1);
		expect(result.ids.size).toBe(0);
	});
});
