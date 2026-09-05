import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import {
	applySmartArtLayoutNodeShape,
	parseSmartArtLayoutNodeShape,
	parseSmartArtLkTxEntry,
	parseSmartArtLkTxEntryFromLayoutNode,
} from './smartart-layout-node-shape';

const localName = (key: string): string => key.split(':').pop() ?? key;

// `dgm:shape` shapes exactly as they appear in real PowerPoint-authored
// layout definitions (`e2e/fixtures/animation-builds-color.pptx` and
// `packages/core/src/__tests__/fixtures/corpus/smartart-chart-table-mix.pptx`,
// `ppt/diagrams/layout1.xml`/`layout2.xml`/`layout4.xml`). `layout4.xml`
// (a pyramid/composite diagram) carries THREE different preset geometries
// across its item templates in the SAME layout - proof this is real, common
// authoring, not a hypothetical.
function realShapeXml(prst: string): XmlObject {
	return {
		'dgm:shape': {
			'@_type': prst,
			'@_xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
			'@_r:blip': '',
			'dgm:adjLst': '',
		},
	};
}

describe('parseSmartArtLayoutNodeShape', () => {
	it('parses the preset geometry from a real roundRect dgm:shape (layout1.xml)', () => {
		const shape = parseSmartArtLayoutNodeShape(realShapeXml('roundRect'), localName);
		expect(shape).toStrictEqual({ presetGeometry: 'roundRect' });
	});

	it('parses ellipse (layout2.xml, a real cycle diagram)', () => {
		expect(parseSmartArtLayoutNodeShape(realShapeXml('ellipse'), localName)).toStrictEqual({
			presetGeometry: 'ellipse',
		});
	});

	it('parses trapezoid and nonIsoscelesTrapezoid (layout4.xml, a real pyramid diagram)', () => {
		expect(parseSmartArtLayoutNodeShape(realShapeXml('trapezoid'), localName)).toStrictEqual({
			presetGeometry: 'trapezoid',
		});
		expect(
			parseSmartArtLayoutNodeShape(realShapeXml('nonIsoscelesTrapezoid'), localName),
		).toStrictEqual({ presetGeometry: 'nonIsoscelesTrapezoid' });
	});

	it('returns undefined for a shapeless marker (type="conn", the connector aux shape)', () => {
		// Real fixtures ALSO carry bare `<dgm:shape .../>` (no @type) for
		// `sp`/spacer nodes; `conn` IS a real @type value but carries no
		// geometry semantics for THIS interpreter (handled by the `conn`
		// arranger, not shape rendering) - still parsed structurally, though.
		expect(parseSmartArtLayoutNodeShape(realShapeXml('conn'), localName)).toStrictEqual({
			presetGeometry: 'conn',
		});
	});

	it('returns undefined when dgm:shape has neither @type, adjLst entries, nor hideGeom', () => {
		const xml: XmlObject = { 'dgm:shape': { '@_r:blip': '' } };
		expect(parseSmartArtLayoutNodeShape(xml, localName)).toBeUndefined();
	});

	it('returns undefined when the node has no dgm:shape at all', () => {
		expect(parseSmartArtLayoutNodeShape({ '@_name': 'x' }, localName)).toBeUndefined();
	});

	it('parses adjLst adjustment values (roundRect corner radius, adj idx=1)', () => {
		const xml: XmlObject = {
			'dgm:shape': {
				'@_type': 'roundRect',
				'dgm:adjLst': { 'dgm:adj': { '@_idx': '1', '@_val': '0.15' } },
			},
		};
		expect(parseSmartArtLayoutNodeShape(xml, localName)).toStrictEqual({
			presetGeometry: 'roundRect',
			adjustments: [{ index: 1, value: 0.15 }],
		});
	});

	it('parses multiple adjLst entries', () => {
		const xml: XmlObject = {
			'dgm:shape': {
				'@_type': 'homePlate',
				'dgm:adjLst': {
					'dgm:adj': [
						{ '@_idx': '1', '@_val': '0.2' },
						{ '@_idx': '2', '@_val': '0.4' },
					],
				},
			},
		};
		expect(parseSmartArtLayoutNodeShape(xml, localName)?.adjustments).toStrictEqual([
			{ index: 1, value: 0.2 },
			{ index: 2, value: 0.4 },
		]);
	});

	it('parses hideGeom="1"', () => {
		const xml: XmlObject = { 'dgm:shape': { '@_hideGeom': '1' } };
		expect(parseSmartArtLayoutNodeShape(xml, localName)).toStrictEqual({ hideGeometry: true });
	});

	// G9: `dgm:shape/@lkTxEntry` is now threaded onto the typed model (not just
	// the standalone raw-XML reader below), so it survives parse -> edit ->
	// serialize like every other `dgm:shape` field.
	it('parses lkTxEntry="1" onto the typed model', () => {
		const xml: XmlObject = { 'dgm:shape': { '@_type': 'rect', '@_lkTxEntry': '1' } };
		expect(parseSmartArtLayoutNodeShape(xml, localName)).toStrictEqual({
			presetGeometry: 'rect',
			lkTxEntry: true,
		});
	});

	it('omits lkTxEntry from the typed model when absent or "0"', () => {
		expect(
			parseSmartArtLayoutNodeShape({ 'dgm:shape': { '@_type': 'rect' } }, localName),
		).toStrictEqual({ presetGeometry: 'rect' });
		expect(
			parseSmartArtLayoutNodeShape(
				{ 'dgm:shape': { '@_type': 'rect', '@_lkTxEntry': '0' } },
				localName,
			),
		).toStrictEqual({ presetGeometry: 'rect' });
	});
});

// G9: `dgm:shape/@lkTxEntry` marks a decorative shape as mirroring its paired
// content node's text. A COM sweep of all 176 built-in Office SmartArt
// gallery layouts found none that author this attribute (see the doc comment
// on `parseSmartArtLkTxEntry`); it is consumed at
// `smartart-layout-interpreter-pyramid.ts`'s `arrangePyramid` for a
// hand-authored/third-party layoutDef that does set it.
describe('parseSmartArtLkTxEntry / parseSmartArtLkTxEntryFromLayoutNode', () => {
	it('reads lkTxEntry="1" as true', () => {
		expect(parseSmartArtLkTxEntry({ '@_lkTxEntry': '1' })).toBeTruthy();
	});

	it('reads lkTxEntry="0" and an absent attribute as false', () => {
		expect(parseSmartArtLkTxEntry({ '@_lkTxEntry': '0' })).toBeFalsy();
		expect(parseSmartArtLkTxEntry({})).toBeFalsy();
		expect(parseSmartArtLkTxEntry(undefined)).toBeFalsy();
	});

	it('reads straight off a raw dgm:layoutNode element', () => {
		const node: XmlObject = { 'dgm:shape': { '@_type': 'rect', '@_lkTxEntry': '1' } };
		expect(parseSmartArtLkTxEntryFromLayoutNode(node, localName)).toBeTruthy();
	});

	it('is false for a layoutNode with no dgm:shape at all', () => {
		expect(parseSmartArtLkTxEntryFromLayoutNode({ '@_name': 'x' }, localName)).toBeFalsy();
	});
});

describe('applySmartArtLayoutNodeShape', () => {
	it('is a no-op when value is undefined', () => {
		const xml: XmlObject = { 'dgm:shape': { '@_type': 'roundRect' } };
		applySmartArtLayoutNodeShape(xml, undefined, localName);
		expect(xml).toStrictEqual({ 'dgm:shape': { '@_type': 'roundRect' } });
	});

	it('edits @type in place, preserving unknown attributes (r:blip)', () => {
		const xml: XmlObject = { 'x:shape': { '@_type': 'roundRect', '@_r:blip': 'keep' } };
		applySmartArtLayoutNodeShape(xml, { presetGeometry: 'ellipse' }, localName);
		expect(xml['x:shape']).toStrictEqual({ '@_type': 'ellipse', '@_r:blip': 'keep' });
	});

	it('creates dgm:shape when the node had none', () => {
		const xml: XmlObject = { '@_name': 'root' };
		applySmartArtLayoutNodeShape(xml, { presetGeometry: 'chevron' }, localName);
		expect(xml['dgm:shape']).toStrictEqual({ '@_type': 'chevron' });
	});

	it('writes adjLst entries back', () => {
		const xml: XmlObject = { 'dgm:shape': { '@_type': 'roundRect' } };
		applySmartArtLayoutNodeShape(
			xml,
			{ presetGeometry: 'roundRect', adjustments: [{ index: 1, value: 0.25 }] },
			localName,
		);
		expect(xml['dgm:shape']).toStrictEqual({
			'@_type': 'roundRect',
			'dgm:adjLst': { 'dgm:adj': [{ '@_idx': '1', '@_val': '0.25' }] },
		});
	});

	it('round-trips a parsed real shape unchanged', () => {
		const original = realShapeXml('trapezoid');
		const parsed = parseSmartArtLayoutNodeShape(original, localName);
		const target: XmlObject = { 'dgm:shape': { '@_type': 'trapezoid' } };
		applySmartArtLayoutNodeShape(target, parsed, localName);
		expect(target['dgm:shape']).toStrictEqual({ '@_type': 'trapezoid' });
	});

	it('writes @lkTxEntry="1" back and removes it when cleared', () => {
		const xml: XmlObject = { 'dgm:shape': { '@_type': 'rect' } };
		applySmartArtLayoutNodeShape(xml, { presetGeometry: 'rect', lkTxEntry: true }, localName);
		expect(xml['dgm:shape']).toStrictEqual({ '@_type': 'rect', '@_lkTxEntry': '1' });

		applySmartArtLayoutNodeShape(xml, { presetGeometry: 'rect' }, localName);
		expect(xml['dgm:shape']).toStrictEqual({ '@_type': 'rect' });
	});

	it('round-trips a parsed lkTxEntry shape unchanged', () => {
		const original: XmlObject = { 'dgm:shape': { '@_type': 'rect', '@_lkTxEntry': '1' } };
		const parsed = parseSmartArtLayoutNodeShape(original, localName);
		const target: XmlObject = { 'dgm:shape': { '@_type': 'rect', '@_lkTxEntry': '1' } };
		applySmartArtLayoutNodeShape(target, parsed, localName);
		expect(target['dgm:shape']).toStrictEqual({ '@_type': 'rect', '@_lkTxEntry': '1' });
	});
});
