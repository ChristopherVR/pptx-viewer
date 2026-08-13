import { describe, expect, it } from 'vitest';

import type { ShapeStyle, XmlObject } from '../../types';
import { PptxShapeStyleExtractor } from '../builders/PptxShapeStyleExtractor';
import type { PptxShapeStyleExtractorContext } from '../builders/PptxShapeStyleExtractor';
import { writeShapeFillAndStroke } from './save-shape-fill-stroke';

/**
 * The `<p:style>` half of the inheritance-flattening class, driven end to end
 * through the REAL extractor and the REAL writer.
 *
 * A shape that authors no `spPr` fill and no `spPr/a:ln` fill is painted by
 * `<a:fillRef>` / `<a:lnRef>` (ECMA-376 §20.1.4.2.10, §20.1.4.2.19). Before
 * this, the load pass resolved those references into the flat `ShapeStyle` and
 * the writer wrote the answer back into `spPr`, where it OUTRANKS the
 * reference: the shape then ignored Recolor, Reset and every later theme
 * change. Measured on `issue-132-hr-deck.pptx` with every slide dirty, a
 * re-serialized deck gained 81 `a:srgbClr`, lost 250 `a:schemeClr`, and 361
 * outlines acquired a `w=` the source never had.
 *
 * Both directions matter and are asserted below: an untouched shape must come
 * back reference-only, and an EDITED one must come back with its concrete
 * fill, or the edit is silently discarded.
 */

const EMU_PER_PX = 9525;

/** Resolved values our stub theme hands back for `idx="1"` / `idx="2"`. */
const THEME_FILL = '#156082';
const THEME_LINE = '#0F4761';

const parseColor = (node: XmlObject | undefined): string | undefined => {
	const srgb = node?.['a:srgbClr'] as XmlObject | undefined;
	return srgb?.['@_val'] ? `#${String(srgb['@_val'])}` : undefined;
};

/**
 * Stand-in for `PptxHandlerRuntimeThemeRefResolution`: writes the same fields
 * the real resolvers write, which is all the baseline capture depends on.
 */
function createExtractor(): PptxShapeStyleExtractor {
	const context = {
		emuPerPx: EMU_PER_PX,
		parseColor,
		extractColorOpacity: () => undefined,
		extractGradientFillColor: () => undefined,
		extractGradientOpacity: () => undefined,
		extractGradientFillCss: () => undefined,
		extractGradientStops: () => [],
		extractGradientAngle: () => 0,
		extractGradientType: () => 'linear' as const,
		extractGradientPathType: () => undefined,
		extractGradientFocalPoint: () => undefined,
		extractGradientFillToRect: () => undefined,
		extractGradientFlip: () => undefined,
		extractGradientRotWithShape: () => undefined,
		extractGradientScaled: () => undefined,
		normalizeStrokeDashType: () => undefined,
		normalizeConnectorArrowType: () => undefined,
		ensureArray: (value: unknown): unknown[] => (Array.isArray(value) ? value : [value]),
		resolveThemeFillRef: (_refNode: XmlObject, style: ShapeStyle) => {
			style.fillRefIdx = 1;
			style.fillMode = 'solid';
			style.fillColor = THEME_FILL;
		},
		resolveThemeLineRef: (_refNode: XmlObject, style: ShapeStyle) => {
			style.lnRefIdx = 2;
			style.strokeColor = THEME_LINE;
			style.strokeWidth = 2;
			style.lineCap = 'flat';
			style.compoundLine = 'sng';
			style.lineJoin = 'miter';
		},
		resolveThemeEffectRef: () => {},
		extractShadowStyle: () => ({}),
		extractInnerShadowStyle: () => ({}),
		extractGlowStyle: () => ({}),
		extractSoftEdgeStyle: () => ({}),
		extractReflectionStyle: () => ({}),
		extractBlurStyle: () => ({}),
		extractEffectDagStyle: () => ({}),
	} as unknown as PptxShapeStyleExtractorContext;
	return new PptxShapeStyleExtractor(context);
}

/** The `<p:style>` PowerPoint writes on an ordinary themed shape. */
const STYLE_NODE: XmlObject = {
	'a:lnRef': { '@_idx': '2', 'a:schemeClr': { '@_val': 'accent1' } },
	'a:fillRef': { '@_idx': '1', 'a:schemeClr': { '@_val': 'accent1' } },
};

/** Load `spPr` + `p:style`, then save the (optionally edited) style back onto it. */
function roundTrip(spPr: XmlObject, edit: (style: ShapeStyle) => void = () => {}): XmlObject {
	const style = createExtractor().extractShapeStyle(spPr, STYLE_NODE);
	edit(style);
	writeShapeFillAndStroke(spPr, style, { emuPerPx: EMU_PER_PX, parseColor });
	return spPr;
}

describe('style-matrix references survive a save', () => {
	it('leaves spPr fill-less when a:fillRef alone paints the shape', () => {
		const spPr = roundTrip({ 'a:prstGeom': { '@_prst': 'rect' } });
		expect(spPr['a:solidFill']).toBeUndefined();
		expect(spPr['a:noFill']).toBeUndefined();
	});

	it('writes the concrete fill once the shape is recoloured', () => {
		const spPr = roundTrip({}, (style) => {
			style.fillColor = '#FF0000';
		});
		const fill = spPr['a:solidFill'] as XmlObject;
		expect((fill['a:srgbClr'] as XmlObject)['@_val']).toBe('FF0000');
	});

	it('writes an explicit no-fill when the shape is cleared', () => {
		const spPr = roundTrip({}, (style) => {
			style.fillMode = 'none';
			style.fillColor = 'transparent';
		});
		expect(spPr['a:noFill']).toStrictEqual({});
	});

	it('still writes the fill of a shape that authored one itself', () => {
		// `a:solidFill` on `spPr` means the extractor never consults `a:fillRef`,
		// so no baseline is recorded and the writer behaves exactly as before.
		const spPr = roundTrip({ 'a:solidFill': { 'a:srgbClr': { '@_val': '00FF00' } } });
		const fill = spPr['a:solidFill'] as XmlObject;
		expect((fill['a:srgbClr'] as XmlObject)['@_val']).toBe('00FF00');
	});

	it('does not invent an a:ln for an outline that comes from a:lnRef', () => {
		const spPr = roundTrip({ 'a:prstGeom': { '@_prst': 'rect' } });
		expect(spPr['a:ln']).toBeUndefined();
	});

	it('keeps an authored a:ln free of the theme width, colour, cap and join', () => {
		// The connector shape PowerPoint writes: arrow ends on `a:ln`, colour and
		// width from `a:lnRef`. Only the arrows are this shape's own.
		const spPr = roundTrip({ 'a:ln': { 'a:tailEnd': { '@_type': 'triangle' } } });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:tailEnd']).toBeDefined();
		expect(ln['@_w']).toBeUndefined();
		expect(ln['a:solidFill']).toBeUndefined();
		expect(ln['@_cap']).toBeUndefined();
		expect(ln['@_cmpd']).toBeUndefined();
		expect(ln['a:miter']).toBeUndefined();
	});

	it('writes width and colour once the outline is edited', () => {
		const spPr = roundTrip({}, (style) => {
			style.strokeColor = '#123456';
			style.strokeWidth = 4;
		});
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['@_w']).toBe(String(4 * EMU_PER_PX));
		expect(((ln['a:solidFill'] as XmlObject)['a:srgbClr'] as XmlObject)['@_val']).toBe('123456');
	});

	it('keeps an outline property the shape authored on top of the reference', () => {
		// `a:ln/@cap="rnd"` disagrees with the theme's `flat`, so it is the
		// shape's own and must be written back.
		const spPr = roundTrip({ 'a:ln': { '@_cap': 'rnd' } });
		expect((spPr['a:ln'] as XmlObject)['@_cap']).toBe('rnd');
	});

	it('does not fabricate a width for an a:ln that only says noFill', () => {
		// `<a:ln><a:noFill/></a:ln>` parses to width 0; the `|| 1` fallback used
		// to turn that into `w="9525"`, a 0.75pt outline waiting to reappear.
		const spPr: XmlObject = { 'a:ln': { 'a:noFill': '' } };
		const style = createExtractor().extractShapeStyle(spPr, STYLE_NODE);
		writeShapeFillAndStroke(spPr, style, { emuPerPx: EMU_PER_PX, parseColor });
		const ln = spPr['a:ln'] as XmlObject;
		expect(ln['a:noFill']).toStrictEqual({});
		expect(ln['@_w']).toBeUndefined();
	});

	it('writes everything for a shape with no p:style at all', () => {
		const spPr: XmlObject = {};
		const style = createExtractor().extractShapeStyle(spPr);
		style.fillColor = '#ABCDEF';
		style.fillMode = 'solid';
		style.strokeColor = '#111111';
		style.strokeWidth = 1;
		writeShapeFillAndStroke(spPr, style, { emuPerPx: EMU_PER_PX, parseColor });
		expect(((spPr['a:solidFill'] as XmlObject)['a:srgbClr'] as XmlObject)['@_val']).toBe('ABCDEF');
		expect((spPr['a:ln'] as XmlObject)['@_w']).toBe(String(EMU_PER_PX));
	});
});
