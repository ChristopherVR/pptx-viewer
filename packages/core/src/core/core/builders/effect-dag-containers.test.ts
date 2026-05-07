import { describe, expect, it } from 'vitest';

import type {
	EffectDagBlend,
	EffectDagContainer,
	EffectDagRawLeaf,
	EffectDagRelOff,
	EffectDagXfrm,
	XmlObject,
} from '../../types';
import {
	buildEffectDagTreeFromXml,
	parseEffectDagContainer,
	serializeEffectDagContainer,
} from './effect-dag-containers';

// ---------------------------------------------------------------------------
// Parsing — single container nodes
// ---------------------------------------------------------------------------

describe('parseEffectDagContainer', () => {
	it('parses a:cont with @type=sib', () => {
		const xml: XmlObject = { '@_type': 'sib' };
		const tree = parseEffectDagContainer(xml);
		expect(tree).toBeDefined();
		expect(tree!.kind).toBe('cont');
		expect(tree!.type).toBe('sib');
		expect(tree!.children).toStrictEqual([]);
	});

	it('parses a:cont with @type=tree and @name', () => {
		const xml: XmlObject = { '@_type': 'tree', '@_name': 'frosted-glass' };
		const tree = parseEffectDagContainer(xml);
		expect(tree!.type).toBe('tree');
		expect(tree!.name).toBe('frosted-glass');
	});

	it('falls back to @type=sib when attribute is missing or invalid', () => {
		expect(parseEffectDagContainer({})!.type).toBe('sib');
		expect(parseEffectDagContainer({ '@_type': 'bogus' })!.type).toBe('sib');
	});

	it('returns undefined for nullish input', () => {
		expect(parseEffectDagContainer(undefined)).toBeUndefined();
		expect(parseEffectDagContainer(null)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Parsing — children
// ---------------------------------------------------------------------------

describe('parseEffectDagContainer — children', () => {
	it('parses a:blend with @blend=mult and a child a:cont', () => {
		const xml: XmlObject = {
			'@_type': 'sib',
			'a:blend': {
				'@_blend': 'mult',
				'a:cont': { '@_type': 'tree' },
			},
		};
		const tree = parseEffectDagContainer(xml)!;
		expect(tree.children).toHaveLength(1);
		const blend = tree.children[0] as EffectDagBlend;
		expect(blend.kind).toBe('blend');
		expect(blend.mode).toBe('mult');
		expect(blend.container.kind).toBe('cont');
		expect(blend.container.type).toBe('tree');
	});

	it('clamps unknown blend modes to the schema default of "over"', () => {
		const xml: XmlObject = {
			'a:blend': { '@_blend': 'pumpkin', 'a:cont': {} },
		};
		const tree = parseEffectDagContainer(xml)!;
		expect((tree.children[0] as EffectDagBlend).mode).toBe('over');
	});

	it('parses a:xfrmEffect with all attributes', () => {
		const xml: XmlObject = {
			'a:xfrmEffect': {
				'@_sx': '120000',
				'@_sy': '95000',
				'@_kx': '60000',
				'@_ky': '-30000',
				'@_tx': '914400',
				'@_ty': '-457200',
			},
		};
		const tree = parseEffectDagContainer(xml)!;
		const xfrm = tree.children[0] as EffectDagXfrm;
		expect(xfrm).toMatchObject({
			kind: 'xfrmEffect',
			sx: 120000,
			sy: 95000,
			kx: 60000,
			ky: -30000,
			tx: 914400,
			ty: -457200,
		});
	});

	it('parses a:relOff with @tx and @ty', () => {
		const xml: XmlObject = {
			'a:relOff': { '@_tx': '50000', '@_ty': '-12500' },
		};
		const tree = parseEffectDagContainer(xml)!;
		const relOff = tree.children[0] as EffectDagRelOff;
		expect(relOff).toStrictEqual({ kind: 'relOff', tx: 50000, ty: -12500 });
	});

	it('preserves non-structural leaves verbatim as raw XML', () => {
		const outerShdwXml = {
			'@_blurRad': '50800',
			'@_dist': '38100',
			'a:srgbClr': { '@_val': '000000' },
		};
		const xml: XmlObject = { 'a:outerShdw': outerShdwXml };
		const tree = parseEffectDagContainer(xml)!;
		const leaf = tree.children[0] as EffectDagRawLeaf;
		expect(leaf.kind).toBe('raw');
		expect(leaf.tag).toBe('outerShdw');
		expect(leaf.xml).toBe(outerShdwXml);
	});

	it('recurses through nested cont -> blend -> inner leaf', () => {
		const xml: XmlObject = {
			'@_type': 'sib',
			'a:cont': {
				'@_type': 'tree',
				'a:blend': {
					'@_blend': 'screen',
					'a:cont': {
						'@_type': 'sib',
						'a:glow': { '@_rad': '63500', 'a:srgbClr': { '@_val': 'ff0000' } },
					},
				},
			},
		};
		const tree = parseEffectDagContainer(xml)!;
		const inner = tree.children[0] as EffectDagContainer;
		const blend = inner.children[0] as EffectDagBlend;
		const glow = blend.container.children[0] as EffectDagRawLeaf;
		expect(blend.mode).toBe('screen');
		expect(glow.kind).toBe('raw');
		expect(glow.tag).toBe('glow');
		expect(glow.xml['@_rad']).toBe('63500');
	});

	it('handles arrays of repeated children (e.g. multiple xfrmEffect)', () => {
		const xml: XmlObject = {
			'a:xfrmEffect': [{ '@_sx': '50000' }, { '@_sx': '100000' }],
		};
		const tree = parseEffectDagContainer(xml)!;
		expect(tree.children).toHaveLength(2);
		expect((tree.children[0] as EffectDagXfrm).sx).toBe(50000);
		expect((tree.children[1] as EffectDagXfrm).sx).toBe(100000);
	});
});

// ---------------------------------------------------------------------------
// Round-trip: parse → serialise → parse again
// ---------------------------------------------------------------------------

describe('effectDag round-trip', () => {
	it('round-trips cont@type=sib', () => {
		const input: XmlObject = { '@_type': 'sib' };
		const tree = parseEffectDagContainer(input)!;
		const xml = serializeEffectDagContainer(tree)!;
		expect(xml['@_type']).toBe('sib');
		expect(parseEffectDagContainer(xml)).toStrictEqual(tree);
	});

	it('round-trips cont@type=tree with @name', () => {
		const input: XmlObject = { '@_type': 'tree', '@_name': 'preset' };
		const tree = parseEffectDagContainer(input)!;
		const xml = serializeEffectDagContainer(tree)!;
		expect(xml['@_type']).toBe('tree');
		expect(xml['@_name']).toBe('preset');
		expect(parseEffectDagContainer(xml)).toStrictEqual(tree);
	});

	it('round-trips blend@mode=mult with a wrapped cont', () => {
		const input: XmlObject = {
			'@_type': 'sib',
			'a:blend': { '@_blend': 'mult', 'a:cont': { '@_type': 'tree' } },
		};
		const tree = parseEffectDagContainer(input)!;
		const xml = serializeEffectDagContainer(tree)!;
		expect(xml['a:blend']).toBeDefined();
		expect(parseEffectDagContainer(xml)).toStrictEqual(tree);
	});

	it('round-trips xfrmEffect', () => {
		const input: XmlObject = {
			'a:xfrmEffect': {
				'@_sx': '110000',
				'@_sy': '110000',
				'@_kx': '0',
				'@_ky': '0',
				'@_tx': '914400',
				'@_ty': '0',
			},
		};
		const tree = parseEffectDagContainer(input)!;
		const xml = serializeEffectDagContainer(tree)!;
		expect(parseEffectDagContainer(xml)).toStrictEqual(tree);
	});

	it('round-trips relOff', () => {
		const input: XmlObject = { 'a:relOff': { '@_tx': '50000', '@_ty': '-25000' } };
		const tree = parseEffectDagContainer(input)!;
		const xml = serializeEffectDagContainer(tree)!;
		expect(parseEffectDagContainer(xml)).toStrictEqual(tree);
	});

	it('round-trips nested cont -> blend -> inner leaf', () => {
		const input: XmlObject = {
			'@_type': 'sib',
			'a:cont': {
				'@_type': 'tree',
				'a:blend': {
					'@_blend': 'screen',
					'a:cont': {
						'@_type': 'sib',
						'a:outerShdw': { '@_blurRad': '50800', 'a:srgbClr': { '@_val': '000000' } },
					},
				},
			},
		};
		const tree = parseEffectDagContainer(input)!;
		const xml = serializeEffectDagContainer(tree)!;
		const reparsed = parseEffectDagContainer(xml);
		expect(reparsed).toStrictEqual(tree);
	});

	it('preserves leaf raw XML through serialise/parse cycle', () => {
		const input: XmlObject = {
			'@_type': 'sib',
			'a:alphaInv': { 'a:schemeClr': { '@_val': 'phClr' } },
		};
		const tree = parseEffectDagContainer(input)!;
		const xml = serializeEffectDagContainer(tree)!;
		const alphaInvOut = xml['a:alphaInv'] as XmlObject;
		expect(alphaInvOut).toBeDefined();
		expect(alphaInvOut['a:schemeClr']).toStrictEqual({ '@_val': 'phClr' });
	});
});

// ---------------------------------------------------------------------------
// buildEffectDagTreeFromXml — convenience wrapper
// ---------------------------------------------------------------------------

describe('buildEffectDagTreeFromXml', () => {
	it('returns undefined for missing input', () => {
		expect(buildEffectDagTreeFromXml(undefined)).toBeUndefined();
	});

	it('builds a typed tree for a typical preset effect graph', () => {
		const xml: XmlObject = {
			'@_type': 'sib',
			'a:cont': {
				'@_type': 'tree',
				'a:relOff': { '@_tx': '50000' },
			},
		};
		const tree = buildEffectDagTreeFromXml(xml)!;
		expect(tree.type).toBe('sib');
		const inner = tree.children[0] as EffectDagContainer;
		expect(inner.kind).toBe('cont');
		expect((inner.children[0] as EffectDagRelOff).tx).toBe(50000);
	});
});
