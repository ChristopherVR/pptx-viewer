import { describe, expect, it } from 'vitest';

import type { ShapeStyle, XmlObject } from '../../types';
import { writeLineFill } from './save-line-fill';

// A trivial colour resolver: reads a:srgbClr/@val as a hex string.
const parseColor = (node: XmlObject | undefined): string | undefined => {
	const srgb = node?.['a:srgbClr'] as XmlObject | undefined;
	return srgb?.['@_val'] ? `#${String(srgb['@_val'])}` : undefined;
};

describe('writeLineFill (issue #87 — single line fill on save)', () => {
	it('emits a single a:gradFill for a gradient outline, never a solid dual-fill', () => {
		const gradFill: XmlObject = {
			'a:gsLst': {
				'a:gs': [
					{ '@_pos': '0', 'a:srgbClr': { '@_val': 'FF0000' } },
					{ '@_pos': '100000', 'a:srgbClr': { '@_val': '0000FF' } },
				],
			},
			'a:lin': { '@_ang': '5400000' },
		};
		// Simulate a re-saved node that still carries a stale solidFill from a
		// prior write: it must be removed so the outline is not dual-filled.
		const lineNode: XmlObject = { 'a:solidFill': { 'a:srgbClr': { '@_val': '7F007F' } } };
		const style: ShapeStyle = {
			strokeFillMode: 'gradient',
			strokeGradientXml: gradFill,
			strokeColor: '#7F007F',
			strokeWidth: 2,
		};

		writeLineFill(lineNode, style, parseColor);

		expect(lineNode['a:gradFill']).toBe(gradFill);
		expect(lineNode['a:solidFill']).toBeUndefined();
		expect(lineNode['a:pattFill']).toBeUndefined();
		expect(lineNode['a:noFill']).toBeUndefined();
	});

	it('emits a single a:pattFill for a pattern outline', () => {
		const pattFill: XmlObject = {
			'@_prst': 'dkDnDiag',
			'a:fgClr': { 'a:srgbClr': { '@_val': '112233' } },
		};
		const lineNode: XmlObject = { 'a:solidFill': {} };
		const style: ShapeStyle = {
			strokeFillMode: 'pattern',
			strokePatternXml: pattFill,
			strokeColor: '#112233',
		};

		writeLineFill(lineNode, style, parseColor);

		expect(lineNode['a:pattFill']).toBe(pattFill);
		expect(lineNode['a:solidFill']).toBeUndefined();
		expect(lineNode['a:gradFill']).toBeUndefined();
	});

	it('emits a single a:solidFill for a solid outline and clears any prior gradient', () => {
		const lineNode: XmlObject = { 'a:gradFill': { 'a:gsLst': {} } };
		const style: ShapeStyle = { strokeFillMode: 'solid', strokeColor: '#333333' };

		writeLineFill(lineNode, style, parseColor);

		expect(lineNode['a:gradFill']).toBeUndefined();
		expect(lineNode['a:pattFill']).toBeUndefined();
		const solid = lineNode['a:solidFill'] as XmlObject;
		expect((solid['a:srgbClr'] as XmlObject)['@_val']).toBe('333333');
	});

	it('emits a:noFill for a transparent / zero-width outline and clears fills', () => {
		const lineNode: XmlObject = { 'a:gradFill': { 'a:gsLst': {} } };
		writeLineFill(lineNode, { strokeColor: 'transparent' }, parseColor);
		expect(lineNode['a:noFill']).toStrictEqual({});
		expect(lineNode['a:gradFill']).toBeUndefined();
		expect(lineNode['a:solidFill']).toBeUndefined();
	});
});

/**
 * `CT_LineProperties` (§20.1.2.2.24) is a SEQUENCE: the fill choice comes
 * first, then the dash group, the join, the two ends and `extLst`. Assigning
 * the fill onto a preserved `a:ln` put it last in key order, and
 * fast-xml-parser serialises in key order, so a round-tripped
 * `<a:ln><a:noFill/><a:prstDash val="dash"/></a:ln>` came back inverted.
 *
 * PowerPoint answers that by discarding the whole `a:ln`, which sends the
 * shape back to its `<a:lnRef>`: measured through COM on
 * `issue-132-hr-deck.pptx` slides 5 and 6, four shapes the author had left
 * outline-less came back with `Shape.Line.Visible = -1` and a themed border.
 */
describe('writeLineFill - CT_LineProperties child order', () => {
	const orderOf = (node: XmlObject): string[] =>
		Object.keys(node).filter((k) => !k.startsWith('@_'));

	it('keeps the fill ahead of an authored a:prstDash', () => {
		const lineNode: XmlObject = { 'a:noFill': '', 'a:prstDash': { '@_val': 'dash' } };
		writeLineFill(lineNode, { strokeColor: 'transparent' }, parseColor);
		expect(orderOf(lineNode)).toStrictEqual(['a:noFill', 'a:prstDash']);
	});

	it('keeps the fill ahead of the join and the line ends', () => {
		const lineNode: XmlObject = {
			'a:miter': { '@_lim': '800000' },
			'a:headEnd': { '@_type': 'none' },
			'a:tailEnd': { '@_type': 'triangle' },
		};
		writeLineFill(lineNode, { strokeFillMode: 'solid', strokeColor: '#333333' }, parseColor);
		expect(orderOf(lineNode)).toStrictEqual(['a:solidFill', 'a:miter', 'a:headEnd', 'a:tailEnd']);
	});

	it('appends the fill when nothing follows it', () => {
		const lineNode: XmlObject = {};
		writeLineFill(lineNode, { strokeFillMode: 'solid', strokeColor: '#333333' }, parseColor);
		expect(orderOf(lineNode)).toStrictEqual(['a:solidFill']);
	});
});
