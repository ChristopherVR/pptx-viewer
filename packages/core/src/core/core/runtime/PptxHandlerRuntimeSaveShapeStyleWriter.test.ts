import { describe, it, expect } from 'vitest';

import type { XmlObject, ShapeStyle } from '../../types';
import { FILL_CHOICE_ELEMENTS, fillChoiceChildren } from './fill-choice-group';
import type { ShapeFillStrokeContext } from './save-shape-fill-stroke';
import { writeShapeFillAndStroke } from './save-shape-fill-stroke';

/**
 * These drive the REAL `writeShapeFillAndStroke` that
 * `PptxHandlerRuntime.applyFillAndStroke` delegates to.
 *
 * The previous version of this file declared its own copy of the production
 * logic ("we reimplemented the core fill/stroke logic to test in isolation"),
 * so it could not fail when production drifted - and it duly stayed green
 * while every fill branch emitted a schema-invalid dual fill for pattern- and
 * group-filled shapes.
 */

const EMU_PER_PX = 9525;

/** A colour resolver good enough for the preserved-XML comparisons. */
const parseColor = (node: XmlObject | undefined): string | undefined => {
	const srgb = node?.['a:srgbClr'] as XmlObject | undefined;
	return srgb?.['@_val'] ? `#${String(srgb['@_val'])}` : undefined;
};

function ctx(overrides: Partial<ShapeFillStrokeContext> = {}): ShapeFillStrokeContext {
	return { emuPerPx: EMU_PER_PX, parseColor, ...overrides };
}

function apply(
	spPr: XmlObject,
	shapeStyle: ShapeStyle,
	gradientFillXml?: XmlObject,
	lineEffectListXml?: XmlObject,
): void {
	writeShapeFillAndStroke(spPr, shapeStyle, ctx({ gradientFillXml, lineEffectListXml }));
}

// ---------------------------------------------------------------------------
// EG_FillProperties choice-group invariant (the P0)
// ---------------------------------------------------------------------------
describe('applyFillAndStroke - EG_FillProperties is a choice group', () => {
	/** A pre-existing fill child of each kind, as it would arrive on rawXml. */
	const EXISTING: Record<string, XmlObject> = {
		'a:noFill': {},
		'a:solidFill': { 'a:srgbClr': { '@_val': '112233' } },
		'a:gradFill': { 'a:gsLst': { 'a:gs': [{ '@_pos': '0' }] } },
		'a:blipFill': { 'a:blip': { '@_r:embed': 'rId9' } },
		'a:pattFill': { '@_prst': 'dkDnDiag', 'a:fgClr': { 'a:srgbClr': { '@_val': '1F4E79' } } },
		'a:grpFill': {},
	};

	/** The style that asks for each fill kind, and the child it must produce. */
	const REQUESTS: ReadonlyArray<{ name: string; expected: string; style: ShapeStyle }> = [
		{ name: 'none', expected: 'a:noFill', style: { fillMode: 'none' } },
		{
			name: 'solid',
			expected: 'a:solidFill',
			style: { fillMode: 'solid', fillColor: '#FF0000' },
		},
		{ name: 'gradient', expected: 'a:gradFill', style: { fillMode: 'gradient' } },
		{
			name: 'pattern',
			expected: 'a:pattFill',
			style: { fillMode: 'pattern', fillPatternPreset: 'dkDnDiag', fillColor: '#1F4E79' },
		},
		{ name: 'group', expected: 'a:grpFill', style: { fillMode: 'group' } },
	];

	const gradient: XmlObject = { 'a:gsLst': { 'a:gs': [{ '@_pos': '100000' }] } };

	for (const request of REQUESTS) {
		for (const existing of FILL_CHOICE_ELEMENTS) {
			it(`writes exactly one fill child when ${request.name} replaces ${existing}`, () => {
				const spPr: XmlObject = {
					'a:prstGeom': { '@_prst': 'rect' },
					[existing]: EXISTING[existing],
				};

				writeShapeFillAndStroke(spPr, request.style, ctx({ gradientFillXml: gradient }));

				expect(fillChoiceChildren(spPr)).toStrictEqual([request.expected]);
				// The rest of spPr is untouched.
				expect(spPr['a:prstGeom']).toStrictEqual({ '@_prst': 'rect' });
			});
		}
	}

	it('leaves a useBgFill shape alone rather than baking in the resolved fill', () => {
		const spPr: XmlObject = { 'a:grpFill': {} };
		apply(spPr, { useBackgroundFill: true, fillMode: 'solid', fillColor: '#FF0000' });
		expect(fillChoiceChildren(spPr)).toStrictEqual(['a:grpFill']);
	});

	it('never leaves a pattFill beside a solidFill (the reported P0)', () => {
		const spPr: XmlObject = {
			'a:pattFill': {
				'@_prst': 'dkDnDiag',
				'a:fgClr': { 'a:srgbClr': { '@_val': '1F4E79' } },
				'a:bgClr': { 'a:srgbClr': { '@_val': 'FFF2CC' } },
			},
		};
		apply(spPr, { fillMode: 'solid', fillColor: '#FF0000' });
		expect(spPr['a:pattFill']).toBeUndefined();
		expect(fillChoiceChildren(spPr)).toStrictEqual(['a:solidFill']);
	});

	it('never leaves a grpFill beside a noFill', () => {
		const spPr: XmlObject = { 'a:grpFill': {} };
		apply(spPr, { fillMode: 'none' });
		expect(fillChoiceChildren(spPr)).toStrictEqual(['a:noFill']);
	});
});

// ---------------------------------------------------------------------------
// Fill Tests
// ---------------------------------------------------------------------------
describe('applyFillAndStroke - fills', () => {
	it("should set noFill when fillMode is 'none'", () => {
		const spPr: XmlObject = { 'a:solidFill': {} };
		apply(spPr, { fillMode: 'none' });
		expect(spPr['a:noFill']).toStrictEqual({});
		expect(spPr['a:solidFill']).toBeUndefined();
	});

	it("should set noFill when fillColor is 'transparent'", () => {
		const spPr: XmlObject = {};
		apply(spPr, { fillColor: 'transparent' });
		expect(spPr['a:noFill']).toStrictEqual({});
	});

	it("should set gradient fill when fillMode is 'gradient'", () => {
		const spPr: XmlObject = { 'a:solidFill': {} };
		const grad: XmlObject = { 'a:gsLst': {} };
		apply(spPr, { fillMode: 'gradient' }, grad);
		expect(spPr['a:gradFill']).toBe(grad);
		expect(spPr['a:solidFill']).toBeUndefined();
		expect(spPr['a:noFill']).toBeUndefined();
	});

	it('should set pattern fill with preset', () => {
		const spPr: XmlObject = {};
		apply(spPr, {
			fillMode: 'pattern',
			fillPatternPreset: 'dkDnDiag',
			fillColor: '#000000',
			fillPatternBackgroundColor: '#FFFFFF',
		});
		const patt = spPr['a:pattFill'] as XmlObject;
		expect(patt['@_prst']).toBe('dkDnDiag');
		expect(((patt['a:fgClr'] as XmlObject)['a:srgbClr'] as XmlObject)['@_val']).toBe('000000');
		expect(((patt['a:bgClr'] as XmlObject)['a:srgbClr'] as XmlObject)['@_val']).toBe('FFFFFF');
	});

	it('should prefer fillPatternFgClrXml over fillColor for pattern', () => {
		const rawClr: XmlObject = { 'a:schemeClr': { '@_val': 'accent1' } };
		const spPr: XmlObject = {};
		apply(spPr, {
			fillMode: 'pattern',
			fillPatternFgClrXml: rawClr,
		});
		const patt = spPr['a:pattFill'] as XmlObject;
		expect(patt['a:fgClr']).toStrictEqual(rawClr);
	});

	it('should set solid fill and strip #', () => {
		const spPr: XmlObject = {};
		apply(spPr, { fillColor: '#FF5500' });
		const solidFill = spPr['a:solidFill'] as XmlObject;
		expect((solidFill['a:srgbClr'] as XmlObject)['@_val']).toBe('FF5500');
	});

	it('should include alpha for solid fill with opacity < 1', () => {
		const spPr: XmlObject = {};
		apply(spPr, { fillColor: '#FF0000', fillOpacity: 0.5 });
		const solidFill = spPr['a:solidFill'] as XmlObject;
		const srgb = solidFill['a:srgbClr'] as XmlObject;
		expect((srgb['a:alpha'] as XmlObject)['@_val']).toBe(String(Math.round(0.5 * 100000)));
	});

	it('should not include alpha when opacity is 1', () => {
		const spPr: XmlObject = {};
		apply(spPr, { fillColor: '#FF0000', fillOpacity: 1 });
		const solidFill = spPr['a:solidFill'] as XmlObject;
		const srgb = solidFill['a:srgbClr'] as XmlObject;
		expect(srgb['a:alpha']).toBeUndefined();
	});

	it('re-emits the preserved colour XML when the resolved hex still matches', () => {
		const original: XmlObject = { 'a:srgbClr': { '@_val': 'FF5500' } };
		const spPr: XmlObject = {};
		apply(spPr, { fillColor: '#FF5500', fillColorXml: original });
		expect(spPr['a:solidFill']).toBe(original);
	});
});

// ---------------------------------------------------------------------------
// Stroke Tests
// ---------------------------------------------------------------------------
describe('applyFillAndStroke - stroke', () => {
	it('should set stroke width in EMU and solid fill', () => {
		const spPr: XmlObject = {};
		apply(spPr, { strokeColor: '#333333', strokeWidth: 2 });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['@_w']).toBe(String(Math.round(2 * EMU_PER_PX)));
		const fill = ln['a:solidFill'] as XmlObject;
		expect((fill['a:srgbClr'] as XmlObject)['@_val']).toBe('333333');
	});

	it('should set noFill for transparent stroke', () => {
		const spPr: XmlObject = {};
		apply(spPr, { strokeColor: 'transparent' });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:noFill']).toStrictEqual({});
		expect(ln['a:solidFill']).toBeUndefined();
	});

	it('should set noFill when strokeWidth is 0', () => {
		const spPr: XmlObject = {};
		apply(spPr, { strokeColor: '#000', strokeWidth: 0 });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:noFill']).toStrictEqual({});
	});

	it('should include stroke alpha when opacity < 1', () => {
		const spPr: XmlObject = {};
		apply(spPr, { strokeColor: '#000', strokeOpacity: 0.3 });
		const ln = spPr['a:ln'] as XmlObject;
		const fill = ln['a:solidFill'] as XmlObject;
		const srgb = fill['a:srgbClr'] as XmlObject;
		expect(srgb['a:alpha']).toBeDefined();
	});

	it('emits a single a:ln fill for a gradient outline over a stale solid', () => {
		const grad: XmlObject = { 'a:gsLst': {} };
		const spPr: XmlObject = { 'a:ln': { 'a:solidFill': { 'a:srgbClr': { '@_val': '000000' } } } };
		apply(spPr, { strokeFillMode: 'gradient', strokeGradientXml: grad, strokeColor: '#000000' });
		const ln = spPr['a:ln'] as XmlObject;
		expect(fillChoiceChildren(ln)).toStrictEqual(['a:gradFill']);
	});
});

// ---------------------------------------------------------------------------
// Dash Tests
// ---------------------------------------------------------------------------
describe('applyFillAndStroke - dash patterns', () => {
	it("should remove dash styles when dash is 'solid'", () => {
		const spPr: XmlObject = { 'a:ln': { 'a:prstDash': { '@_val': 'dash' } } };
		apply(spPr, { strokeDash: 'solid' });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:prstDash']).toBeUndefined();
		expect(ln['a:custDash']).toBeUndefined();
	});

	it('should set preset dash', () => {
		const spPr: XmlObject = {};
		apply(spPr, { strokeDash: 'dash' });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:prstDash']).toStrictEqual({ '@_val': 'dash' });
	});

	it('should set custom dash with segments', () => {
		const spPr: XmlObject = {};
		apply(spPr, {
			strokeDash: 'custom',
			customDashSegments: [
				{ dash: 300000, space: 100000 },
				{ dash: 100000, space: 100000 },
			],
		});
		const ln = spPr['a:ln'] as XmlObject;
		const custDash = ln['a:custDash'] as XmlObject;
		const ds = custDash['a:ds'] as XmlObject[];
		expect(ds).toHaveLength(2);
		expect(ds[0]['@_d']).toBe('300000');
		expect(ds[0]['@_sp']).toBe('100000');
	});

	it('should set default custom dash when segments are empty', () => {
		const spPr: XmlObject = {};
		apply(spPr, { strokeDash: 'custom' });
		const ln = spPr['a:ln'] as XmlObject;
		const custDash = ln['a:custDash'] as XmlObject;
		expect(custDash['a:ds']).toStrictEqual({ '@_d': '200000', '@_sp': '200000' });
	});
});

// ---------------------------------------------------------------------------
// Arrow Tests
// ---------------------------------------------------------------------------
describe('applyFillAndStroke - arrows', () => {
	it('should set tail end arrow with width and length', () => {
		const spPr: XmlObject = { 'a:ln': {} };
		apply(spPr, {
			connectorEndArrow: 'triangle',
			connectorEndArrowWidth: 'lg',
			connectorEndArrowLength: 'sm',
		});
		const ln = spPr['a:ln'] as XmlObject;
		const tail = ln['a:tailEnd'] as XmlObject;
		expect(tail['@_type']).toBe('triangle');
		expect(tail['@_w']).toBe('lg');
		expect(tail['@_len']).toBe('sm');
	});

	it("should remove tailEnd when endArrow is 'none'", () => {
		const spPr: XmlObject = { 'a:ln': { 'a:tailEnd': { '@_type': 'triangle' } } };
		apply(spPr, { connectorEndArrow: 'none' });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:tailEnd']).toBeUndefined();
	});

	it('should set head end arrow', () => {
		const spPr: XmlObject = { 'a:ln': {} };
		apply(spPr, { connectorStartArrow: 'arrow' });
		const ln = spPr['a:ln'] as XmlObject;
		expect((ln['a:headEnd'] as XmlObject)['@_type']).toBe('arrow');
	});
});

// ---------------------------------------------------------------------------
// Line Join, Cap, Compound, Alignment
// ---------------------------------------------------------------------------
describe('applyFillAndStroke - line join, cap, compound, alignment', () => {
	it('should set round join', () => {
		const spPr: XmlObject = {};
		apply(spPr, { lineJoin: 'round' });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:round']).toStrictEqual({});
		expect(ln['a:bevel']).toBeUndefined();
	});

	it('should set bevel join', () => {
		const spPr: XmlObject = {};
		apply(spPr, { lineJoin: 'bevel' });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:bevel']).toStrictEqual({});
	});

	it('omits @lim on a miter join at the 800000 default', () => {
		const spPr: XmlObject = {};
		apply(spPr, { lineJoin: 'miter' });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:miter']).toStrictEqual({});
	});

	it('emits @lim on a miter join with a non-default limit', () => {
		const spPr: XmlObject = {};
		apply(spPr, { lineJoin: 'miter', miterLimit: 400000 });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:miter']).toStrictEqual({ '@_lim': '400000' });
	});

	it('should set line cap', () => {
		const spPr: XmlObject = {};
		apply(spPr, { lineCap: 'rnd' });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['@_cap']).toBe('rnd');
	});

	it('should set compound line type', () => {
		const spPr: XmlObject = {};
		apply(spPr, { compoundLine: 'dbl' });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['@_cmpd']).toBe('dbl');
	});

	it('should set line alignment', () => {
		const spPr: XmlObject = {};
		apply(spPr, { lineAlignment: 'ctr' });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['@_algn']).toBe('ctr');
	});

	it('should add line-level effectLst', () => {
		const spPr: XmlObject = { 'a:ln': {} };
		const lineEffect: XmlObject = { 'a:outerShdw': {} };
		apply(spPr, {}, undefined, lineEffect);
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:effectLst']).toBe(lineEffect);
	});
});

// ---------------------------------------------------------------------------
// Theme colour refs win over a preserved/canonical colour choice on save
// ---------------------------------------------------------------------------
describe('applyFillAndStroke - fillColorRef / strokeColorRef win on save', () => {
	it('emits a:schemeClr from fillColorRef even when fillColorXml is a plain srgbClr', () => {
		const spPr: XmlObject = {};
		apply(spPr, {
			fillMode: 'solid',
			fillColor: '#4472C4',
			fillColorXml: { 'a:srgbClr': { '@_val': '4472C4' } },
			fillColorRef: { scheme: 'accent1', lumMod: 0.6, lumOff: 0.4 },
		});
		expect(spPr['a:solidFill']).toStrictEqual({
			'a:schemeClr': {
				'@_val': 'accent1',
				'a:lumMod': { '@_val': '60000' },
				'a:lumOff': { '@_val': '40000' },
			},
		});
	});

	it('falls back to the existing hex/XML path when no fillColorRef is set', () => {
		const spPr: XmlObject = {};
		apply(spPr, { fillMode: 'solid', fillColor: '#FF0000' });
		expect(spPr['a:solidFill']).toStrictEqual({ 'a:srgbClr': { '@_val': 'FF0000' } });
	});

	it('emits a:schemeClr from strokeColorRef for the outline', () => {
		const spPr: XmlObject = {};
		apply(spPr, {
			strokeColor: '#ED7D31',
			strokeColorRef: { scheme: 'accent2' },
		});
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:solidFill']).toStrictEqual({ 'a:schemeClr': { '@_val': 'accent2' } });
	});

	it('folds fillOpacity into the ref alpha when the ref has no alpha of its own', () => {
		const spPr: XmlObject = {};
		apply(spPr, {
			fillMode: 'solid',
			fillColor: '#4472C4',
			fillColorRef: { scheme: 'accent1' },
			fillOpacity: 0.5,
		});
		expect(spPr['a:solidFill']).toStrictEqual({
			'a:schemeClr': { '@_val': 'accent1', 'a:alpha': { '@_val': '50000' } },
		});
	});
});
