/**
 * Regression coverage for {@link parseTableStyleBorders}, in particular the
 * `a:tcBdr` anti-diagonal side: ECMA-376's `CT_TableCellBorderStyle` sequence
 * is left/right/top/bottom/insideH/insideV/tl2br/tr2bl (confirmed against
 * this repo's own generated schema inventory, which lists `drawing:element:
 * tr2bl` and never `bl2tr`). The parser used to read the wrong key (`a:bl2tr`)
 * and silently drop every real-world `<a:tr2bl>` diagonal (issue G4).
 */
import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import { parseTableStyleBorders, parseTableStyleSectionCell3D } from './table-style-border-parse';

function tcStyleWithBorder(borderXml: XmlObject): XmlObject {
	return { 'a:tcBdr': borderXml };
}

function lineNode(hex: string, widthEmu = 12700): XmlObject {
	return {
		'a:ln': {
			'@_w': String(widthEmu),
			'a:solidFill': { 'a:srgbClr': { '@_val': hex } },
		},
	};
}

describe('parseTableStyleBorders - anti-diagonal (a:tr2bl)', () => {
	it('parses a real <a:tr2bl> node into the tr2bl field', () => {
		const result = parseTableStyleBorders(tcStyleWithBorder({ 'a:tr2bl': lineNode('0000FF') }));
		expect(result?.tr2bl).toBeDefined();
		expect(result?.tr2bl?.color).toBe('#0000FF');
		expect(result?.tr2bl?.width).toBe(1);
	});

	it('also accepts a legacy a:bl2tr node as a lenient alias for files this app previously wrote', () => {
		const result = parseTableStyleBorders(tcStyleWithBorder({ 'a:bl2tr': lineNode('FF00FF') }));
		expect(result?.tr2bl).toBeDefined();
		expect(result?.tr2bl?.color).toBe('#FF00FF');
	});

	it('prefers a real a:tr2bl node over a stray legacy a:bl2tr sibling', () => {
		const result = parseTableStyleBorders(
			tcStyleWithBorder({
				'a:tr2bl': lineNode('00FF00'),
				'a:bl2tr': lineNode('FF0000'),
			}),
		);
		expect(result?.tr2bl?.color).toBe('#00FF00');
	});

	it('still parses tl2br (the other diagonal) alongside tr2bl', () => {
		const result = parseTableStyleBorders(
			tcStyleWithBorder({
				'a:tl2br': lineNode('111111'),
				'a:tr2bl': lineNode('222222'),
			}),
		);
		expect(result?.tl2br?.color).toBe('#111111');
		expect(result?.tr2bl?.color).toBe('#222222');
	});

	it('returns undefined when a:tcBdr has neither diagonal', () => {
		const result = parseTableStyleBorders(tcStyleWithBorder({ 'a:left': lineNode('333333') }));
		expect(result?.tr2bl).toBeUndefined();
	});
});

describe('parseTableStyleSectionCell3D (issue G5)', () => {
	it('returns undefined when a:tcStyle has no a:cell3D', () => {
		expect(parseTableStyleSectionCell3D({})).toBeUndefined();
		expect(parseTableStyleSectionCell3D(undefined)).toBeUndefined();
	});

	it('parses material, bevel, and light rig from a:tcStyle/a:cell3D', () => {
		const result = parseTableStyleSectionCell3D({
			'a:cell3D': {
				'@_prstMaterial': 'plastic',
				'a:bevel': { '@_w': '38100', '@_h': '25400', '@_prst': 'circle' },
				'a:lightRig': { '@_rig': 'threePt', '@_dir': 'tl' },
			},
		});
		expect(result).toStrictEqual({
			material: 'plastic',
			bevelWidth: 4,
			bevelHeight: 3,
			bevelPreset: 'circle',
			lightRig: 'threePt',
			lightRigDirection: 'tl',
		});
	});

	it('returns undefined for an empty a:cell3D node', () => {
		expect(parseTableStyleSectionCell3D({ 'a:cell3D': {} })).toBeUndefined();
	});
});
