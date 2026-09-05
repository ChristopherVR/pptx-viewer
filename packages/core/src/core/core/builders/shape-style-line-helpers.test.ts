import { describe, it, expect } from 'vitest';

import type { ConnectorArrowType, ShapeStyle, StrokeDashType, XmlObject } from '../../types';
import { applyLineProperties } from './shape-style-line-helpers';
import type { ShapeLineStyleContext } from './shape-style-line-helpers';

function makeStyle(overrides: Partial<ShapeStyle> = {}): ShapeStyle {
	return { ...overrides } as ShapeStyle;
}

function makeContext(overrides: Partial<ShapeLineStyleContext> = {}): ShapeLineStyleContext {
	return {
		emuPerPx: 9525,
		parseColor: (colorNode: XmlObject | undefined) => {
			if (!colorNode) {
				return undefined;
			}
			const srgb = colorNode['a:srgbClr'] as XmlObject | undefined;
			if (srgb) {
				return `#${srgb['@_val']}`;
			}
			return undefined;
		},
		extractColorOpacity: () => undefined,
		extractGradientFillColor: () => undefined,
		extractGradientOpacity: () => undefined,
		extractGradientStops: () => [],
		extractGradientAngle: () => 0,
		extractGradientType: () => 'linear',
		extractGradientPathType: () => undefined,
		normalizeStrokeDashType: (value: unknown): StrokeDashType | undefined => {
			const valid: StrokeDashType[] = [
				'solid',
				'dot',
				'dash',
				'lgDash',
				'dashDot',
				'lgDashDot',
				'lgDashDotDot',
				'sysDot',
				'sysDash',
				'sysDashDot',
				'sysDashDotDot',
			];
			return valid.includes(value as StrokeDashType) ? (value as StrokeDashType) : undefined;
		},
		normalizeConnectorArrowType: (value: unknown): ConnectorArrowType | undefined => {
			const valid: ConnectorArrowType[] = [
				'none',
				'triangle',
				'stealth',
				'diamond',
				'oval',
				'arrow',
			];
			return valid.includes(value as ConnectorArrowType)
				? (value as ConnectorArrowType)
				: undefined;
		},
		ensureArray: (value: unknown): unknown[] => {
			if (Array.isArray(value)) {
				return value;
			}
			if (value === undefined || value === null) {
				return [];
			}
			return [value];
		},
		...overrides,
	};
}

// A no-op resolveHiddenLine helper (returns undefined — no hidden line).

// ---------------------------------------------------------------------------
// applyLineProperties — noFill
// ---------------------------------------------------------------------------

describe('applyLineProperties — noFill', () => {
	it('returns true and sets strokeWidth=0, strokeColor=transparent when noFill', () => {
		const lineNode: XmlObject = { 'a:noFill': {} };
		const style = makeStyle();
		const result = applyLineProperties(lineNode, style, makeContext());
		expect(result).toBeTruthy();
		expect(style.strokeWidth).toBe(0);
		expect(style.strokeColor).toBe('transparent');
	});

	// `<a:noFill/>` is an EMPTY element, so fast-xml-parser yields the empty
	// string rather than an object. A truthiness test therefore missed it and a
	// width on the same `a:ln` became a real stroke.
	it('detects a noFill that parsed as an empty string, width and all', () => {
		const lineNode: XmlObject = { '@_w': '3175', 'a:noFill': '' } as unknown as XmlObject;
		const style = makeStyle();
		const result = applyLineProperties(lineNode, style, makeContext());
		expect(result).toBeTruthy();
		expect(style.strokeWidth).toBe(0);
		expect(style.strokeColor).toBe('transparent');
		expect(style.strokeFillMode).toBe('none');
	});

	// `a14:hiddenLine` records the outline to restore if the user switches the
	// outline back on; PowerPoint reports `Shape.Line.Visible = 0` for these, so
	// it must not be painted.
	it('does not revive a hidden line stored in the extension list', () => {
		const lineNode: XmlObject = { 'a:noFill': {} };
		const style = makeStyle();
		const result = applyLineProperties(lineNode, style, makeContext());
		expect(result).toBeTruthy();
		expect(style.strokeWidth).toBe(0);
		expect(style.strokeColor).toBe('transparent');
	});
});

// ---------------------------------------------------------------------------
// applyLineProperties — line width
// ---------------------------------------------------------------------------

describe('applyLineProperties — line width', () => {
	it('extracts line width from @_w (12700 EMU = 1pt ≈ 1.33px)', () => {
		const lineNode: XmlObject = { '@_w': '12700' };
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		// 12700 / 9525 ≈ 1.333
		expect(style.strokeWidth).toBeCloseTo(1.333, 2);
	});

	it('extracts larger line width (38100 => 4px)', () => {
		const lineNode: XmlObject = { '@_w': '38100' };
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		// 38100 / 9525 = 4
		expect(style.strokeWidth).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// applyLineProperties — stroke color
// ---------------------------------------------------------------------------

describe('applyLineProperties — stroke color', () => {
	it('applies solid fill stroke color', () => {
		const lineNode: XmlObject = {
			'a:solidFill': { 'a:srgbClr': { '@_val': '0000FF' } },
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.strokeColor).toBe('#0000FF');
	});

	it('applies gradient fill stroke color via context callback', () => {
		const lineNode: XmlObject = {
			'a:gradFill': { 'a:gsLst': {} },
		};
		const style = makeStyle();
		const ctx = makeContext({
			extractGradientFillColor: () => '#AABBCC',
			extractGradientOpacity: () => 0.8,
		});
		applyLineProperties(lineNode, style, ctx);
		expect(style.strokeColor).toBe('#AABBCC');
		expect(style.strokeOpacity).toBe(0.8);
	});

	it('applies pattern fill stroke color from foreground', () => {
		const lineNode: XmlObject = {
			'a:pattFill': {
				'a:fgClr': { 'a:srgbClr': { '@_val': '112233' } },
				'a:bgClr': { 'a:srgbClr': { '@_val': '445566' } },
			},
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.strokeColor).toBe('#112233');
	});

	it('captures a typed strokeColorRef for a plain schemeClr outline', () => {
		const lineNode: XmlObject = {
			'a:solidFill': { 'a:schemeClr': { '@_val': 'accent2' } },
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.strokeColorRef).toStrictEqual({ scheme: 'accent2' });
	});

	it('does not set strokeColorRef for a plain srgbClr outline', () => {
		const lineNode: XmlObject = {
			'a:solidFill': { 'a:srgbClr': { '@_val': '0000FF' } },
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.strokeColorRef).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// applyLineProperties — outline fill kind (issue #87)
// ---------------------------------------------------------------------------

describe('applyLineProperties — outline fill kind', () => {
	it('models a solid outline as strokeFillMode "solid"', () => {
		const lineNode: XmlObject = {
			'a:solidFill': { 'a:srgbClr': { '@_val': '0000FF' } },
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.strokeFillMode).toBe('solid');
		expect(style.strokeGradientXml).toBeUndefined();
		expect(style.strokePatternXml).toBeUndefined();
	});

	it('models a gradient outline and preserves the whole a:gradFill node', () => {
		const gradFill: XmlObject = {
			'a:gsLst': {
				'a:gs': [
					{ '@_pos': '0', 'a:srgbClr': { '@_val': 'FF0000' } },
					{ '@_pos': '100000', 'a:srgbClr': { '@_val': '0000FF' } },
				],
			},
			'a:lin': { '@_ang': '5400000' },
		};
		const lineNode: XmlObject = { 'a:gradFill': gradFill };
		const style = makeStyle();
		const ctx = makeContext({ extractGradientFillColor: () => '#7F007F' });
		applyLineProperties(lineNode, style, ctx);
		expect(style.strokeFillMode).toBe('gradient');
		expect(style.strokeGradientXml).toBe(gradFill);
		// Averaged colour still available for solid-only stroke renderers.
		expect(style.strokeColor).toBe('#7F007F');
	});

	it('models a gradient outline in structured form, not just raw XML', () => {
		// The averaged `strokeColor` cannot express a two-tone or
		// fade-to-transparent outline, so renderers need resolved stops.
		const gradFill: XmlObject = { 'a:lin': { '@_ang': '5400000' } };
		const style = makeStyle();
		applyLineProperties({ 'a:gradFill': gradFill }, style, {
			...makeContext(),
			extractGradientStops: () => [
				{ color: '#FF0000', position: 0 },
				{ color: '#0000FF', position: 100, opacity: 0 },
			],
			extractGradientAngle: () => 90,
			extractGradientType: () => 'linear',
		});
		expect(style.strokeGradientStops).toStrictEqual([
			{ color: '#FF0000', position: 0 },
			{ color: '#0000FF', position: 100, opacity: 0 },
		]);
		expect(style.strokeGradientAngle).toBe(90);
		expect(style.strokeGradientType).toBe('linear');
	});

	it('leaves the structured gradient fields unset when there are no stops', () => {
		const style = makeStyle();
		applyLineProperties({ 'a:gradFill': {} }, style, makeContext());
		expect(style.strokeFillMode).toBe('gradient');
		expect(style.strokeGradientStops).toBeUndefined();
		expect(style.strokeGradientAngle).toBeUndefined();
	});

	it('models a pattern outline and preserves the whole a:pattFill node', () => {
		const pattFill: XmlObject = {
			'@_prst': 'dkDnDiag',
			'a:fgClr': { 'a:srgbClr': { '@_val': '112233' } },
			'a:bgClr': { 'a:srgbClr': { '@_val': '445566' } },
		};
		const lineNode: XmlObject = { 'a:pattFill': pattFill };
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.strokeFillMode).toBe('pattern');
		expect(style.strokePatternXml).toBe(pattFill);
		// Structured form, so a renderer can build the same tiled SVG the fill
		// side already builds from `fillPatternPreset`.
		expect(style.strokePatternPreset).toBe('dkDnDiag');
		expect(style.strokePatternBackgroundColor).toBe('#445566');
	});

	it('models a noFill outline (no hidden line) as strokeFillMode "none"', () => {
		const lineNode: XmlObject = { 'a:noFill': {} };
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.strokeFillMode).toBe('none');
	});
});

// ---------------------------------------------------------------------------
// applyLineProperties — dash patterns
// ---------------------------------------------------------------------------

describe('applyLineProperties — dash patterns', () => {
	it("applies preset dash type 'dash'", () => {
		const lineNode: XmlObject = {
			'a:prstDash': { '@_val': 'dash' },
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.strokeDash).toBe('dash');
	});

	it("applies preset dash type 'dot'", () => {
		const lineNode: XmlObject = {
			'a:prstDash': { '@_val': 'dot' },
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.strokeDash).toBe('dot');
	});

	it("applies preset dash type 'lgDash'", () => {
		const lineNode: XmlObject = {
			'a:prstDash': { '@_val': 'lgDash' },
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.strokeDash).toBe('lgDash');
	});

	it("applies preset dash type 'sysDash'", () => {
		const lineNode: XmlObject = {
			'a:prstDash': { '@_val': 'sysDash' },
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.strokeDash).toBe('sysDash');
	});

	it("applies preset dash type 'dashDot'", () => {
		const lineNode: XmlObject = {
			'a:prstDash': { '@_val': 'dashDot' },
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.strokeDash).toBe('dashDot');
	});

	it('applies custom dash segments', () => {
		const lineNode: XmlObject = {
			'a:custDash': {
				'a:ds': [
					{ '@_d': '400000', '@_sp': '200000' },
					{ '@_d': '100000', '@_sp': '200000' },
				],
			},
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.strokeDash).toBe('custom');
		expect(style.customDashSegments).toStrictEqual([
			{ dash: 400000, space: 200000 },
			{ dash: 100000, space: 200000 },
		]);
	});
});

// ---------------------------------------------------------------------------
// applyLineProperties — arrow heads
// ---------------------------------------------------------------------------

describe('applyLineProperties — arrow heads', () => {
	it("applies head end arrow type 'triangle' with size 'lg'", () => {
		const lineNode: XmlObject = {
			'a:headEnd': { '@_type': 'triangle', '@_w': 'lg', '@_len': 'lg' },
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.connectorStartArrow).toBe('triangle');
		expect(style.connectorStartArrowWidth).toBe('lg');
		expect(style.connectorStartArrowLength).toBe('lg');
	});

	it("applies tail end arrow type 'stealth' with size 'sm'", () => {
		const lineNode: XmlObject = {
			'a:tailEnd': { '@_type': 'stealth', '@_w': 'sm', '@_len': 'sm' },
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.connectorEndArrow).toBe('stealth');
		expect(style.connectorEndArrowWidth).toBe('sm');
		expect(style.connectorEndArrowLength).toBe('sm');
	});

	it('applies both head and tail arrows', () => {
		const lineNode: XmlObject = {
			'a:headEnd': { '@_type': 'diamond', '@_w': 'med', '@_len': 'med' },
			'a:tailEnd': { '@_type': 'oval', '@_w': 'lg', '@_len': 'sm' },
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.connectorStartArrow).toBe('diamond');
		expect(style.connectorStartArrowWidth).toBe('med');
		expect(style.connectorEndArrow).toBe('oval');
		expect(style.connectorEndArrowLength).toBe('sm');
	});
});

// ---------------------------------------------------------------------------
// applyLineProperties — join, cap, compound
// ---------------------------------------------------------------------------

describe('applyLineProperties — join, cap, compound', () => {
	it('applies round line join', () => {
		const lineNode: XmlObject = { 'a:round': {} };
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.lineJoin).toBe('round');
	});

	it('applies bevel line join', () => {
		const lineNode: XmlObject = { 'a:bevel': {} };
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.lineJoin).toBe('bevel');
	});

	it('applies miter line join', () => {
		const lineNode: XmlObject = { 'a:miter': {} };
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.lineJoin).toBe('miter');
		expect(style.miterLimit).toBeUndefined();
	});

	it('parses miter @_lim into miterLimit (E-H6)', () => {
		const lineNode: XmlObject = { 'a:miter': { '@_lim': '500000' } };
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.lineJoin).toBe('miter');
		expect(style.miterLimit).toBe(500000);
	});

	it("applies cap type 'rnd'", () => {
		const lineNode: XmlObject = { '@_cap': 'rnd' };
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.lineCap).toBe('rnd');
	});

	it("applies cap type 'sq'", () => {
		const lineNode: XmlObject = { '@_cap': 'sq' };
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.lineCap).toBe('sq');
	});

	it("applies cap type 'flat'", () => {
		const lineNode: XmlObject = { '@_cap': 'flat' };
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.lineCap).toBe('flat');
	});

	it("applies compound line type 'dbl'", () => {
		const lineNode: XmlObject = { '@_cmpd': 'dbl' };
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.compoundLine).toBe('dbl');
	});

	it("applies compound line type 'thickThin'", () => {
		const lineNode: XmlObject = { '@_cmpd': 'thickThin' };
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.compoundLine).toBe('thickThin');
	});

	it("applies compound line type 'tri'", () => {
		const lineNode: XmlObject = { '@_cmpd': 'tri' };
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.compoundLine).toBe('tri');
	});
});

// ---------------------------------------------------------------------------
// applyLineProperties — line effects (shadow and glow)
// ---------------------------------------------------------------------------

describe('applyLineProperties — line effects', () => {
	it('applies line shadow from a:effectLst/a:outerShdw', () => {
		const lineNode: XmlObject = {
			'a:effectLst': {
				'a:outerShdw': {
					'@_blurRad': '38100',
					'@_dist': '19050',
					'@_dir': '2700000',
					'a:srgbClr': { '@_val': '000000' },
				},
			},
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.lineShadowColor).toBe('#000000');
		// 38100 / 9525 = 4
		expect(style.lineShadowBlur).toBe(4);
		// dist = 19050 / 9525 = 2
		// dir = 2700000 / 60000 = 45 degrees
		expect(style.lineShadowOffsetX).toBeCloseTo(
			Math.round(Math.cos((45 * Math.PI) / 180) * 2 * 100) / 100,
			2,
		);
		expect(style.lineShadowOffsetY).toBeCloseTo(
			Math.round(Math.sin((45 * Math.PI) / 180) * 2 * 100) / 100,
			2,
		);
	});

	it('applies line glow from a:effectLst/a:glow', () => {
		const lineNode: XmlObject = {
			'a:effectLst': {
				'a:glow': {
					'@_rad': '57150',
					'a:srgbClr': { '@_val': 'FFFF00' },
				},
			},
		};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.lineGlowColor).toBe('#FFFF00');
		// 57150 / 9525 = 6
		expect(style.lineGlowRadius).toBe(6);
	});

	it('does not set line effects when a:effectLst is absent', () => {
		const lineNode: XmlObject = {};
		const style = makeStyle();
		applyLineProperties(lineNode, style, makeContext());
		expect(style.lineShadowColor).toBeUndefined();
		expect(style.lineGlowColor).toBeUndefined();
	});
});
