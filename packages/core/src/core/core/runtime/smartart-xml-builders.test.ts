import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { describe, it, expect } from 'vitest';

import type { XmlObject, PptxSmartArtData } from '../../types';
import {
	addSmartArtNode,
	removeSmartArtNode,
	updateSmartArtNodeText,
	resetSmartArtEditCounter,
} from '../../utils/smartart-editing-node-ops';
import {
	buildSmartArtPointXml,
	buildSmartArtConnectionXml,
	mergeSmartArtPointXml,
	mergeSmartArtConnectionXml,
} from './smartart-xml-builders';

// ---------------------------------------------------------------------------
// buildSmartArtPointXml
// ---------------------------------------------------------------------------
describe('buildSmartArtPointXml', () => {
	it('should return an empty array for empty input', () => {
		const result = buildSmartArtPointXml([]);
		expect(result).toStrictEqual([]);
	});

	it('should build a single point with @_modelId and dgm:t', () => {
		const result = buildSmartArtPointXml([{ id: '1', text: 'Hello' }]);
		expect(result).toHaveLength(1);
		expect(result[0]['@_modelId']).toBe('1');
		expect(result[0]['dgm:t']).toBeDefined();
	});

	it('should include @_type when nodeType is set', () => {
		const result = buildSmartArtPointXml([{ id: '1', text: 'Root', nodeType: 'doc' }]);
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
		expect(aR['a:rPr']).toStrictEqual({ '@_lang': 'en-US', '@_dirty': '0' });
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
		const result = buildSmartArtPointXml([{ id: '42', text: 'Presentation', nodeType: 'pres' }]);
		expect(result[0]['@_type']).toBe('pres');
		expect(result[0]['@_modelId']).toBe('42');
	});

	it('should handle node with nodeType "asst"', () => {
		const result = buildSmartArtPointXml([{ id: '5', text: 'Assistant', nodeType: 'asst' }]);
		expect(result[0]['@_type']).toBe('asst');
	});

	it('should place @_type before dgm:t in the object', () => {
		const result = buildSmartArtPointXml([{ id: '1', text: 'Test', nodeType: 'node' }]);
		const keys = Object.keys(result[0]);
		const typeIdx = keys.indexOf('@_type');
		const dgmTIdx = keys.indexOf('dgm:t');
		expect(typeIdx).toBeLessThan(dgmTIdx);
	});

	it('should include a:bodyPr as an empty object', () => {
		const result = buildSmartArtPointXml([{ id: '1', text: 'X' }]);
		const dgmT = result[0]['dgm:t'] as Record<string, unknown>;
		expect(dgmT['a:bodyPr']).toStrictEqual({});
	});

	it('should include a:lstStyle as an empty object', () => {
		const result = buildSmartArtPointXml([{ id: '1', text: 'X' }]);
		const dgmT = result[0]['dgm:t'] as Record<string, unknown>;
		expect(dgmT['a:lstStyle']).toStrictEqual({});
	});
});

// ---------------------------------------------------------------------------
// buildSmartArtConnectionXml
// ---------------------------------------------------------------------------
describe('buildSmartArtConnectionXml', () => {
	it('should return an empty array for empty input', () => {
		const result = buildSmartArtConnectionXml([]);
		expect(result).toStrictEqual([]);
	});

	it('should build a connection with @_srcId and @_destId', () => {
		const result = buildSmartArtConnectionXml([{ sourceId: 'src1', destId: 'dst1' }]);
		expect(result).toHaveLength(1);
		expect(result[0]['@_srcId']).toBe('src1');
		expect(result[0]['@_destId']).toBe('dst1');
	});

	it('should always include a unique @_modelId (required by CT_Connection)', () => {
		const result = buildSmartArtConnectionXml([
			{ sourceId: 'a', destId: 'b' },
			{ sourceId: 'b', destId: 'c' },
		]);
		expect(result[0]['@_modelId']).toMatch(/^\{[0-9A-F-]{36}\}$/u);
		expect(result[1]['@_modelId']).toMatch(/^\{[0-9A-F-]{36}\}$/u);
		expect(result[0]['@_modelId']).not.toBe(result[1]['@_modelId']);
	});

	it('should include @_type when type is set', () => {
		const result = buildSmartArtConnectionXml([{ sourceId: 'a', destId: 'b', type: 'parOf' }]);
		expect(result[0]['@_type']).toBe('parOf');
	});

	it('should not include @_type when type is undefined', () => {
		const result = buildSmartArtConnectionXml([{ sourceId: 'a', destId: 'b' }]);
		expect(result[0]).not.toHaveProperty('@_type');
	});

	it('should stringify srcOrd as @_srcOrd', () => {
		const result = buildSmartArtConnectionXml([{ sourceId: 'a', destId: 'b', srcOrd: 0 }]);
		expect(result[0]['@_srcOrd']).toBe('0');
	});

	it('should stringify destOrd as @_destOrd', () => {
		const result = buildSmartArtConnectionXml([{ sourceId: 'a', destId: 'b', destOrd: 3 }]);
		expect(result[0]['@_destOrd']).toBe('3');
	});

	it('should not include @_srcOrd when srcOrd is undefined', () => {
		const result = buildSmartArtConnectionXml([{ sourceId: 'a', destId: 'b' }]);
		expect(result[0]).not.toHaveProperty('@_srcOrd');
	});

	it('should not include @_destOrd when destOrd is undefined', () => {
		const result = buildSmartArtConnectionXml([{ sourceId: 'a', destId: 'b' }]);
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
		expect(result[0]).toMatchObject({
			'@_srcId': 'src',
			'@_destId': 'dst',
			'@_type': 'sibTrans',
			'@_srcOrd': '1',
			'@_destOrd': '2',
		});
		expect(result[0]['@_modelId']).toMatch(/^\{[0-9A-F-]{36}\}$/u);
	});

	it('should handle connection type "presOf"', () => {
		const result = buildSmartArtConnectionXml([{ sourceId: 'a', destId: 'b', type: 'presOf' }]);
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

// ---------------------------------------------------------------------------
// mergeSmartArtPointXml: surgical round-trip merge
// ---------------------------------------------------------------------------

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	parseAttributeValue: false,
	parseTagValue: false,
	processEntities: false,
});
const builder = new XMLBuilder({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	format: false,
});

/**
 * A realistic dgm:ptLst as PowerPoint emits it: a doc point, two content
 * points (each carrying prSet / spPr / extLst), a parent transition point,
 * and a presentation point. Mirrors the structure the loader preserves.
 */
const SAMPLE_PT_LST = `<dgm:ptLst xmlns:dgm="urn:dgm" xmlns:a="urn:a">
  <dgm:pt modelId="0" type="doc">
    <dgm:prSet loTypeId="urn:layout"/>
    <dgm:spPr/>
  </dgm:pt>
  <dgm:pt modelId="100">
    <dgm:prSet phldrT="[Text]" custT="1"/>
    <dgm:spPr><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></dgm:spPr>
    <dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>First</a:t></a:r></a:p></dgm:t>
    <dgm:extLst><a:ext uri="{guid-1}"/></dgm:extLst>
  </dgm:pt>
  <dgm:pt modelId="200">
    <dgm:prSet phldrT="[Text]"/>
    <dgm:spPr/>
    <dgm:t><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Second</a:t></a:r></a:p></dgm:t>
  </dgm:pt>
  <dgm:pt modelId="100-trans" type="parTrans" cxnId="1"><dgm:spPr/></dgm:pt>
  <dgm:pt modelId="pres-1" type="pres"><dgm:prSet presAssocID="100" presName="node"/><dgm:spPr/></dgm:pt>
</dgm:ptLst>`;

/** Parse the sample ptLst into the array of dgm:pt objects. */
function parseSamplePts(): XmlObject[] {
	const parsed = parser.parse(SAMPLE_PT_LST) as XmlObject;
	const ptLst = parsed['dgm:ptLst'] as XmlObject;
	const pts = ptLst['dgm:pt'];
	return (Array.isArray(pts) ? pts : [pts]) as XmlObject[];
}

/** Pull the run text from a parsed dgm:pt, or undefined when absent. */
function textOf(pt: XmlObject): string | undefined {
	const t = pt['dgm:t'] as XmlObject | undefined;
	const p = t?.['a:p'] as XmlObject | undefined;
	const r = p?.['a:r'] as XmlObject | undefined;
	const value = r?.['a:t'];
	return typeof value === 'string' ? value : undefined;
}

/** Find a parsed dgm:pt by modelId. */
function ptById(pts: XmlObject[], id: string): XmlObject | undefined {
	return pts.find((pt) => String(pt['@_modelId']) === id);
}

describe('mergeSmartArtPointXml', () => {
	it('preserves doc / pres / parTrans points untouched', () => {
		const existing = parseSamplePts();
		const nodes = [
			{ id: '100', text: 'First' },
			{ id: '200', text: 'Second' },
		];

		const merged = mergeSmartArtPointXml(existing, nodes);

		expect(ptById(merged, '0')).toBeDefined();
		expect(ptById(merged, '0')?.['@_type']).toBe('doc');
		expect(ptById(merged, 'pres-1')?.['@_type']).toBe('pres');
		expect(ptById(merged, '100-trans')?.['@_type']).toBe('parTrans');
	});

	it('preserves prSet / spPr / extLst on content points', () => {
		const existing = parseSamplePts();
		const merged = mergeSmartArtPointXml(existing, [
			{ id: '100', text: 'Changed' },
			{ id: '200', text: 'Second' },
		]);

		const pt100 = ptById(merged, '100')!;
		expect(pt100['dgm:prSet']).toBeDefined();
		expect((pt100['dgm:prSet'] as XmlObject)['@_custT']).toBe('1');
		expect(pt100['dgm:spPr']).toBeDefined();
		expect(pt100['dgm:extLst']).toBeDefined();
		// Text mutated, structure preserved.
		expect(textOf(pt100)).toBe('Changed');
	});

	it('updates existing content text matched by modelId', () => {
		const existing = parseSamplePts();
		const merged = mergeSmartArtPointXml(existing, [
			{ id: '100', text: 'Alpha' },
			{ id: '200', text: 'Beta' },
		]);
		expect(textOf(ptById(merged, '100')!)).toBe('Alpha');
		expect(textOf(ptById(merged, '200')!)).toBe('Beta');
	});

	it('appends newly added content points', () => {
		const existing = parseSamplePts();
		const merged = mergeSmartArtPointXml(existing, [
			{ id: '100', text: 'First' },
			{ id: '200', text: 'Second' },
			{ id: '300', text: 'Third' },
		]);
		const pt300 = ptById(merged, '300');
		expect(pt300).toBeDefined();
		expect(textOf(pt300!)).toBe('Third');
		// New content points carry no spurious non-content type.
		expect(pt300!['@_type']).toBeUndefined();
	});

	it('removes content points whose modelId was deleted', () => {
		const existing = parseSamplePts();
		const merged = mergeSmartArtPointXml(existing, [{ id: '100', text: 'First' }]);
		expect(ptById(merged, '200')).toBeUndefined();
		// Structural points remain.
		expect(ptById(merged, '0')).toBeDefined();
		expect(ptById(merged, 'pres-1')).toBeDefined();
	});

	it('does not append a non-content type onto a new node', () => {
		const merged = mergeSmartArtPointXml([], [{ id: 'x', text: 'Y', nodeType: 'pres' }]);
		// "pres" is non-content and must not be written as a content point type.
		expect(merged[0]['@_type']).toBeUndefined();
	});

	it('preserves a content node nodeType such as "asst"', () => {
		const merged = mergeSmartArtPointXml([], [{ id: 'x', text: 'Y', nodeType: 'asst' }]);
		expect(merged[0]['@_type']).toBe('asst');
	});

	it('rebuilds multiple runs when joined run text still equals node text', () => {
		const existing = parseSamplePts();
		const merged = mergeSmartArtPointXml(existing, [
			{
				id: '100',
				text: 'Bold Normal',
				runs: [
					{ text: 'Bold ', rPr: { '@_b': '1', '@_lang': 'en-US' } },
					{ text: 'Normal', rPr: { '@_lang': 'en-US' } },
				],
			},
			{ id: '200', text: 'Second' },
		]);

		const pt100 = ptById(merged, '100')!;
		const t = pt100['dgm:t'] as XmlObject;
		const p = t['a:p'] as XmlObject;
		const runs = p['a:r'] as XmlObject[];
		expect(runs).toHaveLength(2);
		expect((runs[0]['a:rPr'] as XmlObject)['@_b']).toBe('1');
		expect(runs[0]['a:t']).toBe('Bold ');
		expect(runs[1]['a:t']).toBe('Normal');
		// prSet preserved through the run rebuild.
		expect(pt100['dgm:prSet']).toBeDefined();
	});

	it('preserves a single run rPr when text is unchanged', () => {
		const existing = parseSamplePts();
		const merged = mergeSmartArtPointXml(existing, [
			{ id: '100', text: 'First', runs: [{ text: 'First', rPr: { '@_sz': '1800' } }] },
			{ id: '200', text: 'Second' },
		]);
		const pt100 = ptById(merged, '100')!;
		const t = pt100['dgm:t'] as XmlObject;
		const p = t['a:p'] as XmlObject;
		const r = p['a:r'] as XmlObject;
		expect((r['a:rPr'] as XmlObject)['@_sz']).toBe('1800');
		expect(r['a:t']).toBe('First');
	});

	it('falls back to single-run text when an edit diverges from preserved runs', () => {
		const existing = parseSamplePts();
		const merged = mergeSmartArtPointXml(existing, [
			{
				id: '100',
				text: 'Edited text', // diverges from joined run text
				runs: [{ text: 'Bold', rPr: { '@_b': '1' } }, { text: 'Normal' }],
			},
			{ id: '200', text: 'Second' },
		]);
		const pt100 = ptById(merged, '100')!;
		// Stale runs must not be resurrected: a single run carries the edited text.
		expect(textOf(pt100)).toBe('Edited text');
	});

	it('round-trips through build -> parse without corrupting structural points', () => {
		const existing = parseSamplePts();
		const merged = mergeSmartArtPointXml(existing, [
			{ id: '100', text: 'Edited' },
			{ id: '200', text: 'Second' },
		]);

		// Serialise the merged ptLst and parse it back, as the save pipeline does.
		const xml = builder.build({ 'dgm:ptLst': { 'dgm:pt': merged } });
		const reparsed = parser.parse(xml) as XmlObject;
		const ptLst = reparsed['dgm:ptLst'] as XmlObject;
		const pts = (ptLst['dgm:pt'] as XmlObject[]).filter(Boolean);

		expect(ptById(pts, '0')?.['@_type']).toBe('doc');
		expect(ptById(pts, 'pres-1')?.['@_type']).toBe('pres');
		expect(textOf(ptById(pts, '100')!)).toBe('Edited');
		expect(ptById(pts, '100')?.['dgm:extLst']).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// mergeSmartArtConnectionXml: surgical round-trip merge
// ---------------------------------------------------------------------------

describe('mergeSmartArtConnectionXml', () => {
	/** A realistic dgm:cxn, as PowerPoint emits it: modelId + parTransId + sibTransId. */
	const EXISTING_CXNS: XmlObject[] = [
		{
			'@_modelId': '{cxn-A}',
			'@_srcId': 'doc',
			'@_destId': '100',
			'@_srcOrd': '0',
			'@_destOrd': '0',
			'@_parTransId': '{par-A}',
			'@_sibTransId': '{sib-A}',
		},
		{
			'@_modelId': '{cxn-B}',
			'@_type': 'presOf',
			'@_srcId': 'doc',
			'@_destId': 'pres-1',
			'@_srcOrd': '0',
			'@_destOrd': '0',
			'@_presId': 'urn:layout/default',
		},
	];

	it('preserves an unchanged connection verbatim, including @_modelId', () => {
		const merged = mergeSmartArtConnectionXml(EXISTING_CXNS, [
			{ sourceId: 'doc', destId: '100', srcOrd: 0, destOrd: 0 },
			{ sourceId: 'doc', destId: 'pres-1', type: 'presOf', srcOrd: 0, destOrd: 0 },
		]);
		expect(merged[0]).toBe(EXISTING_CXNS[0]);
		expect(merged[0]['@_modelId']).toBe('{cxn-A}');
		expect(merged[0]['@_parTransId']).toBe('{par-A}');
		expect(merged[1]['@_modelId']).toBe('{cxn-B}');
		expect(merged[1]['@_presId']).toBe('urn:layout/default');
	});

	it('drops a connection whose identity is no longer in the desired list', () => {
		const merged = mergeSmartArtConnectionXml(EXISTING_CXNS, [
			{ sourceId: 'doc', destId: '100', srcOrd: 0, destOrd: 0 },
		]);
		expect(merged).toHaveLength(1);
		expect(merged[0]['@_modelId']).toBe('{cxn-A}');
	});

	it('synthesises a fresh @_modelId for a genuinely new connection', () => {
		const merged = mergeSmartArtConnectionXml(EXISTING_CXNS, [
			{ sourceId: 'doc', destId: '100', srcOrd: 0, destOrd: 0 },
			{ sourceId: 'doc', destId: 'pres-1', type: 'presOf', srcOrd: 0, destOrd: 0 },
			{ sourceId: '100', destId: '200', type: 'parOf', srcOrd: 0, destOrd: 0 },
		]);
		expect(merged).toHaveLength(3);
		expect(merged[2]['@_modelId']).toMatch(/^\{[0-9A-F-]{36}\}$/u);
		expect(merged[2]['@_srcId']).toBe('100');
		expect(merged[2]['@_destId']).toBe('200');
	});

	it('round-trips through build -> parse without losing required attributes', () => {
		const merged = mergeSmartArtConnectionXml(EXISTING_CXNS, [
			{ sourceId: 'doc', destId: '100', srcOrd: 0, destOrd: 0 },
			{ sourceId: 'doc', destId: 'pres-1', type: 'presOf', srcOrd: 0, destOrd: 0 },
		]);
		const xml = builder.build({ 'dgm:cxnLst': { 'dgm:cxn': merged } });
		const reparsed = parser.parse(xml) as XmlObject;
		const cxnLst = reparsed['dgm:cxnLst'] as XmlObject;
		const cxns = cxnLst['dgm:cxn'] as XmlObject[];
		expect(cxns.every((c) => Boolean(c['@_modelId']))).toBeTruthy();
		expect(cxns[0]['@_parTransId']).toBe('{par-A}');
	});
});

// ---------------------------------------------------------------------------
// Full editing round-trip: parse ptLst -> node-ops -> merge -> assert
// ---------------------------------------------------------------------------

describe('smartArt editing round-trip via node-ops + merge', () => {
	it('reflects add / edit / remove while preserving structural points', () => {
		resetSmartArtEditCounter();
		const existingPts = parseSamplePts();

		// In-memory model parsed from the same data: two content nodes.
		let data: PptxSmartArtData = {
			nodes: [
				{ id: '100', text: 'First' },
				{ id: '200', text: 'Second' },
			],
		};

		// Mutate via the real editing operations.
		data = updateSmartArtNodeText(data, '100', 'First (edited)');
		data = addSmartArtNode(data, 'Third');
		data = removeSmartArtNode(data, '200');

		const merged = mergeSmartArtPointXml(existingPts, data.nodes);

		// Structural points survive every operation.
		expect(ptById(merged, '0')?.['@_type']).toBe('doc');
		expect(ptById(merged, 'pres-1')?.['@_type']).toBe('pres');
		expect(ptById(merged, '100-trans')?.['@_type']).toBe('parTrans');

		// Content reflects the edits.
		expect(textOf(ptById(merged, '100')!)).toBe('First (edited)');
		expect(ptById(merged, '200')).toBeUndefined();

		// prSet on the surviving original content point is intact.
		expect(ptById(merged, '100')?.['dgm:prSet']).toBeDefined();

		// The newly added node appears with its text under a freshly generated id.
		const added = merged.find(
			(pt) => textOf(pt) === 'Third' && pt['@_modelId'] !== '100' && pt['@_modelId'] !== '200',
		);
		expect(added).toBeDefined();
		expect(added?.['@_modelId']).toMatch(/^\{[0-9A-F-]{36}\}$/u);
	});
});
