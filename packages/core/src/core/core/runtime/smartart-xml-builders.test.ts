import { describe, it, expect } from 'vitest';
import {
	buildSmartArtPointXml,
	buildSmartArtConnectionXml,
} from './smartart-xml-builders';

// ---------------------------------------------------------------------------
// buildSmartArtPointXml
// ---------------------------------------------------------------------------
describe('buildSmartArtPointXml', () => {
	it('should return an empty array for empty input', () => {
		const result = buildSmartArtPointXml([]);
		expect(result).toEqual([]);
	});

	it('should build a single point with @_modelId and dgm:t', () => {
		const result = buildSmartArtPointXml([{ id: '1', text: 'Hello' }]);
		expect(result).toHaveLength(1);
		expect(result[0]['@_modelId']).toBe('1');
		expect(result[0]['dgm:t']).toBeDefined();
	});

	it('should include @_type when nodeType is set', () => {
		const result = buildSmartArtPointXml([
			{ id: '1', text: 'Root', nodeType: 'doc' },
		]);
		expect(result[0]['@_type']).toBe('doc');
	});

	it('should not include @_type when nodeType is undefined', () => {
		const result = buildSmartArtPointXml([{ id: '1', text: 'Hello' }]);
		expect(result[0]).not.toHaveProperty('@_type');
	});

	it('should produce correct nested dgm:t → a:bodyPr, a:lstStyle, a:p', () => {
		const result = buildSmartArtPointXml([{ id: '1', text: 'Test' }]);
		const dgmT = result[0]['dgm:t'] as Record<string, unknown>;
		expect(dgmT).toHaveProperty('a:bodyPr');
		expect(dgmT).toHaveProperty('a:lstStyle');
		expect(dgmT).toHaveProperty('a:p');
	});

	it('should produce correct a:p → a:r → a:rPr, a:t structure', () => {
		const result = buildSmartArtPointXml([{ id: '1', text: 'Content' }]);
		const dgmT = result[0]['dgm:t'] as Record<string, unknown>;
		const aP = dgmT['a:p'] as Record<string, unknown>;
		const aR = aP['a:r'] as Record<string, unknown>;
		expect(aR['a:rPr']).toEqual({ '@_lang': 'en-US', '@_dirty': '0' });
		expect(aR['a:t']).toBe('Content');
	});

	it('should handle multiple nodes', () => {
		const nodes = [
			{ id: '1', text: 'First' },
			{ id: '2', text: 'Second' },
			{ id: '3', text: 'Third' },
		];
		const result = buildSmartArtPointXml(nodes);
		expect(result).toHaveLength(3);
		expect(result[0]['@_modelId']).toBe('1');
		expect(result[1]['@_modelId']).toBe('2');
		expect(result[2]['@_modelId']).toBe('3');
	});

	it('should preserve the text of each node accurately', () => {
		const nodes = [
			{ id: '1', text: 'Alpha' },
			{ id: '2', text: 'Beta' },
		];
		const result = buildSmartArtPointXml(nodes);
		const getText = (pt: Record<string, unknown>) => {
			const dgmT = pt['dgm:t'] as Record<string, unknown>;
			const aP = dgmT['a:p'] as Record<string, unknown>;
			const aR = aP['a:r'] as Record<string, unknown>;
			return aR['a:t'];
		};
		expect(getText(result[0])).toBe('Alpha');
		expect(getText(result[1])).toBe('Beta');
	});

	it('should handle empty text', () => {
		const result = buildSmartArtPointXml([{ id: '1', text: '' }]);
		const dgmT = result[0]['dgm:t'] as Record<string, unknown>;
		const aP = dgmT['a:p'] as Record<string, unknown>;
		const aR = aP['a:r'] as Record<string, unknown>;
		expect(aR['a:t']).toBe('');
	});

	it('should handle node with nodeType "pres"', () => {
		const result = buildSmartArtPointXml([
			{ id: '42', text: 'Presentation', nodeType: 'pres' },
		]);
		expect(result[0]['@_type']).toBe('pres');
		expect(result[0]['@_modelId']).toBe('42');
	});

	it('should handle node with nodeType "asst"', () => {
		const result = buildSmartArtPointXml([
			{ id: '5', text: 'Assistant', nodeType: 'asst' },
		]);
		expect(result[0]['@_type']).toBe('asst');
	});

	it('should place @_type before dgm:t in the object', () => {
		const result = buildSmartArtPointXml([
			{ id: '1', text: 'Test', nodeType: 'node' },
		]);
		const keys = Object.keys(result[0]);
		const typeIdx = keys.indexOf('@_type');
		const dgmTIdx = keys.indexOf('dgm:t');
		expect(typeIdx).toBeLessThan(dgmTIdx);
	});

	it('should include a:bodyPr as an empty object', () => {
		const result = buildSmartArtPointXml([{ id: '1', text: 'X' }]);
		const dgmT = result[0]['dgm:t'] as Record<string, unknown>;
		expect(dgmT['a:bodyPr']).toEqual({});
	});

	it('should include a:lstStyle as an empty object', () => {
		const result = buildSmartArtPointXml([{ id: '1', text: 'X' }]);
		const dgmT = result[0]['dgm:t'] as Record<string, unknown>;
		expect(dgmT['a:lstStyle']).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// buildSmartArtConnectionXml
// ---------------------------------------------------------------------------
describe('buildSmartArtConnectionXml', () => {
	it('should return an empty array for empty input', () => {
		const result = buildSmartArtConnectionXml([]);
		expect(result).toEqual([]);
	});

	it('should build a connection with @_srcId and @_destId', () => {
		const result = buildSmartArtConnectionXml([
			{ sourceId: 'src1', destId: 'dst1' },
		]);
		expect(result).toHaveLength(1);
		expect(result[0]['@_srcId']).toBe('src1');
		expect(result[0]['@_destId']).toBe('dst1');
	});

	it('should include @_type when type is set', () => {
		const result = buildSmartArtConnectionXml([
			{ sourceId: 'a', destId: 'b', type: 'parOf' },
		]);
		expect(result[0]['@_type']).toBe('parOf');
	});

	it('should not include @_type when type is undefined', () => {
		const result = buildSmartArtConnectionXml([
			{ sourceId: 'a', destId: 'b' },
		]);
		expect(result[0]).not.toHaveProperty('@_type');
	});

	it('should stringify srcOrd as @_srcOrd', () => {
		const result = buildSmartArtConnectionXml([
			{ sourceId: 'a', destId: 'b', srcOrd: 0 },
		]);
		expect(result[0]['@_srcOrd']).toBe('0');
	});

	it('should stringify destOrd as @_destOrd', () => {
		const result = buildSmartArtConnectionXml([
			{ sourceId: 'a', destId: 'b', destOrd: 3 },
		]);
		expect(result[0]['@_destOrd']).toBe('3');
	});

	it('should not include @_srcOrd when srcOrd is undefined', () => {
		const result = buildSmartArtConnectionXml([
			{ sourceId: 'a', destId: 'b' },
		]);
		expect(result[0]).not.toHaveProperty('@_srcOrd');
	});

	it('should not include @_destOrd when destOrd is undefined', () => {
		const result = buildSmartArtConnectionXml([
			{ sourceId: 'a', destId: 'b' },
		]);
		expect(result[0]).not.toHaveProperty('@_destOrd');
	});

	it('should build multiple connections in order', () => {
		const conns = [
			{ sourceId: '1', destId: '2' },
			{ sourceId: '2', destId: '3' },
			{ sourceId: '3', destId: '4' },
		];
		const result = buildSmartArtConnectionXml(conns);
		expect(result).toHaveLength(3);
		expect(result[0]['@_srcId']).toBe('1');
		expect(result[1]['@_srcId']).toBe('2');
		expect(result[2]['@_srcId']).toBe('3');
	});

	it('should include all attributes when fully specified', () => {
		const result = buildSmartArtConnectionXml([
			{
				sourceId: 'src',
				destId: 'dst',
				type: 'sibTrans',
				srcOrd: 1,
				destOrd: 2,
			},
		]);
		expect(result[0]).toEqual({
			'@_srcId': 'src',
			'@_destId': 'dst',
			'@_type': 'sibTrans',
			'@_srcOrd': '1',
			'@_destOrd': '2',
		});
	});

	it('should handle connection type "presOf"', () => {
		const result = buildSmartArtConnectionXml([
			{ sourceId: 'a', destId: 'b', type: 'presOf' },
		]);
		expect(result[0]['@_type']).toBe('presOf');
	});

	it('should handle srcOrd of 0 as string "0"', () => {
		const result = buildSmartArtConnectionXml([
			{ sourceId: 'a', destId: 'b', srcOrd: 0, destOrd: 0 },
		]);
		expect(result[0]['@_srcOrd']).toBe('0');
		expect(result[0]['@_destOrd']).toBe('0');
	});
});
