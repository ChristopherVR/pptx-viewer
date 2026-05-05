import { describe, it, expect } from 'vitest';

import type { XmlObject, ShapeStyle } from '../../types';
import { PptxShapeEffectXmlCodec } from './PptxShapeEffectXmlCodec';

/**
 * Shared mock context for the PptxShapeEffectXmlCodec.
 * parseColor extracts the first srgbClr child and returns '#RRGGBB'.
 * extractColorOpacity reads the a:alpha child and returns 0-1.
 */
function createCodecContext() {
	return {
		emuPerPx: 9525,
		parseColor: (colorNode: XmlObject | undefined): string | undefined => {
			if (!colorNode) {
				return undefined;
			}
			const srgb = colorNode['a:srgbClr'] as XmlObject | undefined;
			if (srgb) {
				return `#${srgb['@_val']}`;
			}
			const prst = colorNode['a:prstClr'] as XmlObject | undefined;
			if (prst) {
				const val = String(prst['@_val'] || '');
				if (val === 'black') {
					return '#000000';
				}
				if (val === 'white') {
					return '#FFFFFF';
				}
				return `#prst_${val}`;
			}
			const scheme = colorNode['a:schemeClr'] as XmlObject | undefined;
			if (scheme) {
				return `#theme_${scheme['@_val']}`;
			}
			return undefined;
		},
		extractColorOpacity: (colorNode: XmlObject | undefined): number | undefined => {
			if (!colorNode) {
				return undefined;
			}
			// Look for alpha inside srgbClr, prstClr, or schemeClr
			for (const key of ['a:srgbClr', 'a:prstClr', 'a:schemeClr']) {
				const child = colorNode[key] as XmlObject | undefined;
				if (!child) {
					continue;
				}
				const alpha = child['a:alpha'] as XmlObject | undefined;
				if (alpha && alpha['@_val'] !== undefined) {
					return parseInt(String(alpha['@_val']), 10) / 100000;
				}
			}
			return undefined;
		},
		clampUnitInterval: (v: number): number => Math.max(0, Math.min(1, v)),
		ensureArray: (value: unknown): XmlObject[] => {
			if (Array.isArray(value)) {
				return value as XmlObject[];
			}
			if (value === undefined || value === null) {
				return [];
			}
			return [value as XmlObject];
		},
	};
}

describe('pptxShapeEffectXmlCodec', () => {
	const codec = new PptxShapeEffectXmlCodec(createCodecContext());
	const EMU_PER_PX = 9525;

	// ── Outer Shadow extraction ──

	describe('extractShadowStyle (outerShdw)', () => {
		it('should parse blurRad, dist, dir, and color from a:outerShdw', () => {
			const shapeProps: XmlObject = {
				'a:effectLst': {
					'a:outerShdw': {
						'@_blurRad': '50800',
						'@_dist': '38100',
						'@_dir': '5400000',
						'a:srgbClr': {
							'@_val': '000000',
							'a:alpha': { '@_val': '43000' },
						},
					},
				},
			};
			const result = codec.extractShadowStyle(shapeProps);
			expect(result.shadowColor).toBe('#000000');
			expect(result.shadowOpacity).toBeCloseTo(0.43, 2);
			// blurRad 50800 / 9525 ~= 5.33 px
			expect(result.shadowBlur).toBeCloseTo(50800 / EMU_PER_PX, 1);
			// dist 38100 / 9525 = 4 px
			expect(result.shadowDistance).toBeCloseTo(38100 / EMU_PER_PX, 1);
			// dir 5400000 / 60000 = 90 degrees
			expect(result.shadowAngle).toBeCloseTo(90, 1);
		});

		it('should parse alignment/rotWithShape from a:outerShdw', () => {
			const shapeProps: XmlObject = {
				'a:effectLst': {
					'a:outerShdw': {
						'@_blurRad': '50800',
						'@_dist': '38100',
						'@_dir': '5400000',
						'@_algn': 'tl',
						'@_rotWithShape': '0',
						'@_sx': '90000',
						'@_sy': '90000',
						'@_kx': '60000',
						'@_ky': '60000',
						'a:srgbClr': {
							'@_val': '000000',
							'a:alpha': { '@_val': '43000' },
						},
					},
				},
			};
			const result = codec.extractShadowStyle(shapeProps);
			// '@_rotWithShape': '0' parses to false (CT_OuterShadowEffect §20.1.8.45).
			expect(result.shadowRotateWithShape).toBeFalsy();
			expect(result.shadowAlignment).toBe('tl');
			expect(result.shadowScaleX).toBe(90000);
			expect(result.shadowScaleY).toBe(90000);
			expect(result.shadowSkewX).toBe(60000);
			expect(result.shadowSkewY).toBe(60000);
		});

		it('should compute shadowOffsetX/Y from distance and direction', () => {
			// dir = 0 => purely rightward offset
			const shapeProps: XmlObject = {
				'a:effectLst': {
					'a:outerShdw': {
						'@_blurRad': '0',
						'@_dist': '95250', // 10 px
						'@_dir': '0',
						'a:srgbClr': { '@_val': 'FF0000' },
					},
				},
			};
			const result = codec.extractShadowStyle(shapeProps);
			expect(result.shadowOffsetX).toBeCloseTo(10, 0);
			expect(result.shadowOffsetY).toBeCloseTo(0, 0);
		});

		it('should return empty object when no effectLst exists', () => {
			const result = codec.extractShadowStyle({});
			expect(result).toStrictEqual({});
		});
	});

	// ── Inner Shadow extraction ──

	describe('extractInnerShadowStyle', () => {
		it('should parse innerShdw with blurRad, dist, dir, and prstClr', () => {
			const shapeProps: XmlObject = {
				'a:effectLst': {
					'a:innerShdw': {
						'@_blurRad': '63500',
						'@_dist': '25400',
						'@_dir': '16200000',
						'a:prstClr': {
							'@_val': 'black',
							'a:alpha': { '@_val': '50000' },
						},
					},
				},
			};
			const result = codec.extractInnerShadowStyle(shapeProps);
			expect(result.innerShadowColor).toBe('#000000');
			expect(result.innerShadowOpacity).toBeCloseTo(0.5, 2);
			expect(result.innerShadowBlur).toBeCloseTo(63500 / EMU_PER_PX, 1);
			// dir = 16200000 / 60000 = 270 degrees => offsetX ~= 0, offsetY ~= -dist
		});

		it('should return empty object when no innerShdw exists', () => {
			const shapeProps: XmlObject = { 'a:effectLst': {} };
			const result = codec.extractInnerShadowStyle(shapeProps);
			expect(result).toStrictEqual({});
		});
	});

	// ── Glow extraction ──

	describe('extractGlowStyle', () => {
		it('should parse glow rad and schemeClr with alpha', () => {
			const shapeProps: XmlObject = {
				'a:effectLst': {
					'a:glow': {
						'@_rad': '101600',
						'a:schemeClr': {
							'@_val': 'accent1',
							'a:alpha': { '@_val': '40000' },
						},
					},
				},
			};
			const result = codec.extractGlowStyle(shapeProps);
			expect(result.glowColor).toBe('#theme_accent1');
			expect(result.glowOpacity).toBeCloseTo(0.4, 2);
			expect(result.glowRadius).toBeCloseTo(101600 / EMU_PER_PX, 1);
		});

		it('should return empty object when no glow exists', () => {
			const result = codec.extractGlowStyle({ 'a:effectLst': {} });
			expect(result).toStrictEqual({});
		});
	});

	// ── Reflection extraction ──

	describe('extractReflectionStyle', () => {
		it('should parse all reflection attributes (stA, endA, endPos, sy, dist, dir)', () => {
			const shapeProps: XmlObject = {
				'a:effectLst': {
					'a:reflection': {
						'@_blurRad': '6350',
						'@_stA': '52000',
						'@_endA': '300',
						'@_endPos': '35000',
						'@_dist': '0',
						'@_dir': '5400000',
						'@_sy': '-100000',
						'@_algn': 'bl',
						'@_rotWithShape': '0',
					},
				},
			};
			const result = codec.extractReflectionStyle(shapeProps);
			// blurRad 6350 / 9525 ~= 0.667 px
			expect(result.reflectionBlurRadius).toBeCloseTo(6350 / EMU_PER_PX, 2);
			// stA 52000 / 100000 = 0.52
			expect(result.reflectionStartOpacity).toBeCloseTo(0.52, 3);
			// endA 300 / 100000 = 0.003
			expect(result.reflectionEndOpacity).toBeCloseTo(0.003, 4);
			// endPos 35000 / 100000 = 0.35
			expect(result.reflectionEndPosition).toBeCloseTo(0.35, 3);
			// dir 5400000 / 60000 = 90 deg
			expect(result.reflectionDirection).toBeCloseTo(90, 1);
		});

		it('should return empty object when no reflection exists', () => {
			const result = codec.extractReflectionStyle({});
			expect(result).toStrictEqual({});
		});
	});

	// ── Soft Edge extraction ──

	describe('extractSoftEdgeStyle', () => {
		it('should parse softEdge radius in EMU and convert to px', () => {
			const shapeProps: XmlObject = {
				'a:effectLst': {
					'a:softEdge': { '@_rad': '12700' },
				},
			};
			const result = codec.extractSoftEdgeStyle(shapeProps);
			// 12700 / 9525 ~= 1.333 px
			expect(result.softEdgeRadius).toBeCloseTo(12700 / EMU_PER_PX, 2);
		});

		it('should return empty object when no softEdge exists', () => {
			const result = codec.extractSoftEdgeStyle({});
			expect(result).toStrictEqual({});
		});
	});

	// ── Preset Shadow extraction ──

	describe('extractShadowStyle — preset shadow fallback', () => {
		it('should parse prstShdw with preset name, dist, and dir', () => {
			const shapeProps: XmlObject = {
				'a:effectLst': {
					'a:prstShdw': {
						'@_prst': 'shdw14',
						'@_dist': '38100',
						'@_dir': '5400000',
						'a:srgbClr': {
							'@_val': '000000',
							'a:alpha': { '@_val': '35000' },
						},
					},
				},
			};
			const result = codec.extractShadowStyle(shapeProps);
			expect(result.presetShadowName).toBe('shdw14');
			expect(result.shadowColor).toBe('#000000');
			expect(result.shadowOpacity).toBeCloseTo(0.35, 2);
			// shdw14 has preset blur of 5 from the map
			expect(result.shadowBlur).toBe(5);
		});
	});

	// ── Blur extraction ──

	describe('extractBlurStyle', () => {
		it('should parse blur radius and grow flag', () => {
			const shapeProps: XmlObject = {
				'a:effectLst': {
					'a:blur': {
						'@_rad': '50800',
						'@_grow': '1',
					},
				},
			};
			const result = codec.extractBlurStyle(shapeProps);
			expect(result.blurRadius).toBeCloseTo(50800 / EMU_PER_PX, 1);
			expect(result.blurGrow).toBeTruthy();
		});

		it('should return undefined blurGrow when grow is 0', () => {
			const shapeProps: XmlObject = {
				'a:effectLst': {
					'a:blur': {
						'@_rad': '25400',
						'@_grow': '0',
					},
				},
			};
			const result = codec.extractBlurStyle(shapeProps);
			expect(result.blurRadius).toBeCloseTo(25400 / EMU_PER_PX, 1);
			expect(result.blurGrow).toBeUndefined();
		});
	});

	// ── Build round-trip: outerShadow ──

	describe('buildOuterShadowXml', () => {
		it('should build outerShdw XML with correct EMU values', () => {
			const style: ShapeStyle = {
				shadowColor: '#000000',
				shadowOpacity: 0.43,
				shadowBlur: 4,
				shadowAngle: 90,
				shadowDistance: 4,
			};
			const xml = codec.buildOuterShadowXml(style);
			expect(xml).toBeDefined();
			// blurRad = 4 * 9525 = 38100
			expect(xml!['@_blurRad']).toBe(String(Math.round(4 * EMU_PER_PX)));
			// dist = 4 * 9525 = 38100
			expect(xml!['@_dist']).toBe(String(Math.round(4 * EMU_PER_PX)));
			// dir = 90 * 60000 = 5400000
			expect(xml!['@_dir']).toBe(String(Math.round(90 * 60000)));
			// color
			const srgb = xml!['a:srgbClr'] as XmlObject;
			expect(srgb['@_val']).toBe('000000');
			// alpha = 0.43 * 100000 = 43000
			const alpha = srgb['a:alpha'] as XmlObject;
			expect(alpha['@_val']).toBe(String(Math.round(0.43 * 100000)));
		});

		it('should return undefined for transparent shadow', () => {
			const style: ShapeStyle = { shadowColor: 'transparent' };
			expect(codec.buildOuterShadowXml(style)).toBeUndefined();
		});

		it('should return undefined when shadowColor is empty', () => {
			const style: ShapeStyle = { shadowColor: '' };
			expect(codec.buildOuterShadowXml(style)).toBeUndefined();
		});

		it('should include rotWithShape when explicitly set', () => {
			const style: ShapeStyle = {
				shadowColor: '#333333',
				shadowOpacity: 0.5,
				shadowRotateWithShape: false,
			};
			const xml = codec.buildOuterShadowXml(style);
			expect(xml).toBeDefined();
			expect(xml!['@_rotWithShape']).toBe('0');
		});
	});

	// ── Build round-trip: innerShadow ──

	describe('buildInnerShadowXml', () => {
		it('should build innerShdw XML from style properties', () => {
			const style: ShapeStyle = {
				innerShadowColor: '#0000FF',
				innerShadowOpacity: 0.5,
				innerShadowBlur: 6,
				innerShadowOffsetX: 0,
				innerShadowOffsetY: 3,
			};
			const xml = codec.buildInnerShadowXml(style);
			expect(xml).toBeDefined();
			expect(xml!['@_blurRad']).toBe(String(Math.round(6 * EMU_PER_PX)));
			const srgb = xml!['a:srgbClr'] as XmlObject;
			expect(srgb['@_val']).toBe('0000FF');
		});

		it('should return undefined for missing inner shadow color', () => {
			expect(codec.buildInnerShadowXml({} as ShapeStyle)).toBeUndefined();
		});
	});

	// ── Build round-trip: glow ──

	describe('buildGlowXml', () => {
		it('should build glow XML with rad and alpha', () => {
			const style: ShapeStyle = {
				glowColor: '#FF6600',
				glowRadius: 8,
				glowOpacity: 0.4,
			};
			const xml = codec.buildGlowXml(style);
			expect(xml).toBeDefined();
			expect(xml!['@_rad']).toBe(String(Math.round(8 * EMU_PER_PX)));
			const srgb = xml!['a:srgbClr'] as XmlObject;
			expect(srgb['@_val']).toBe('FF6600');
			const alpha = srgb['a:alpha'] as XmlObject;
			expect(alpha['@_val']).toBe(String(Math.round(0.4 * 100000)));
		});

		it('should return undefined when glowRadius is 0', () => {
			const style: ShapeStyle = {
				glowColor: '#FF0000',
				glowRadius: 0,
			};
			expect(codec.buildGlowXml(style)).toBeUndefined();
		});
	});

	// ── Build round-trip: softEdge ──

	describe('buildSoftEdgeXml', () => {
		it('should build softEdge XML with rad in EMU', () => {
			const style: ShapeStyle = { softEdgeRadius: 2 };
			const xml = codec.buildSoftEdgeXml(style);
			expect(xml).toBeDefined();
			expect(xml!['@_rad']).toBe(String(Math.round(2 * EMU_PER_PX)));
		});

		it('should return undefined when softEdgeRadius is undefined', () => {
			expect(codec.buildSoftEdgeXml({} as ShapeStyle)).toBeUndefined();
		});
	});

	// ── Build round-trip: reflection ──

	describe('buildReflectionXml', () => {
		it('should build reflection XML with stA, endA, endPos, dir, dist', () => {
			const style: ShapeStyle = {
				reflectionBlurRadius: 1,
				reflectionStartOpacity: 0.52,
				reflectionEndOpacity: 0.003,
				reflectionEndPosition: 0.35,
				reflectionDirection: 90,
				reflectionDistance: 2,
			};
			const xml = codec.buildReflectionXml(style);
			expect(xml).toBeDefined();
			expect(xml!['@_blurRad']).toBe(String(Math.round(Number(EMU_PER_PX))));
			expect(xml!['@_stA']).toBe(String(Math.round(0.52 * 100000)));
			expect(xml!['@_endA']).toBe(String(Math.round(0.003 * 100000)));
			expect(xml!['@_endPos']).toBe(String(Math.round(0.35 * 100000)));
			expect(xml!['@_dir']).toBe(String(Math.round(90 * 60000)));
			expect(xml!['@_dist']).toBe(String(Math.round(2 * EMU_PER_PX)));
		});

		it('should return undefined when no reflection properties are set', () => {
			expect(codec.buildReflectionXml({} as ShapeStyle)).toBeUndefined();
		});
	});

	// ── EffectDag extraction ──

	describe('extractEffectDagStyle', () => {
		it('should extract outerShdw from effectDag', () => {
			const shapeProps: XmlObject = {
				'a:effectDag': {
					'a:outerShdw': {
						'@_blurRad': '50800',
						'@_dist': '38100',
						'@_dir': '5400000',
						'a:srgbClr': {
							'@_val': 'FF0000',
							'a:alpha': { '@_val': '60000' },
						},
					},
				},
			};
			const result = codec.extractEffectDagStyle(shapeProps);
			expect(result.shadowColor).toBe('#FF0000');
			expect(result.shadowOpacity).toBeCloseTo(0.6, 2);
			expect(result.effectDagXml).toBeDefined();
		});

		it('should extract grayscale flag from effectDag', () => {
			const shapeProps: XmlObject = {
				'a:effectDag': {
					'a:grayscl': {},
				},
			};
			const result = codec.extractEffectDagStyle(shapeProps);
			expect(result.dagGrayscale).toBeTruthy();
		});

		it('should extract biLevel threshold from effectDag', () => {
			const shapeProps: XmlObject = {
				'a:effectDag': {
					'a:biLevel': { '@_thresh': '50000' },
				},
			};
			const result = codec.extractEffectDagStyle(shapeProps);
			expect(result.dagBiLevel).toBe(50);
		});

		it('should return empty object when no effectDag exists', () => {
			const result = codec.extractEffectDagStyle({});
			expect(result).toStrictEqual({});
		});
	});

	// ── Build round-trip: line effect list ──

	describe('buildLineEffectListXml', () => {
		it('should build line shadow and glow in effectLst', () => {
			const style: ShapeStyle = {
				lineShadowColor: '#333333',
				lineShadowOpacity: 0.35,
				lineShadowBlur: 4,
				lineShadowOffsetX: 2,
				lineShadowOffsetY: 2,
				lineGlowColor: '#FF0000',
				lineGlowRadius: 5,
				lineGlowOpacity: 0.4,
			};
			const xml = codec.buildLineEffectListXml(style);
			expect(xml).toBeDefined();
			expect(xml!['a:outerShdw']).toBeDefined();
			expect(xml!['a:glow']).toBeDefined();
		});

		it('should return undefined when no line effects are defined', () => {
			expect(codec.buildLineEffectListXml({} as ShapeStyle)).toBeUndefined();
		});
	});

	// ---------------------------------------------------------------------
	// Phase 5 Stream A item 1 — additional shadow/reflection attrs (E-H4)
	// ---------------------------------------------------------------------
	describe('shadow/reflection extra attributes (E-H4)', () => {
		it('round-trips outerShdw sx/sy/kx/ky/algn', () => {
			const shapeProps: XmlObject = {
				'a:effectLst': {
					'a:outerShdw': {
						'@_blurRad': '50800',
						'@_dist': '38100',
						'@_dir': '0',
						'@_sx': '90000',
						'@_sy': '110000',
						'@_kx': '60000',
						'@_ky': '120000',
						'@_algn': 'br',
						'a:srgbClr': { '@_val': '000000' },
					},
				},
			};
			const parsed = codec.extractShadowStyle(shapeProps);
			expect(parsed.shadowScaleX).toBe(90000);
			expect(parsed.shadowScaleY).toBe(110000);
			expect(parsed.shadowSkewX).toBe(60000);
			expect(parsed.shadowSkewY).toBe(120000);
			expect(parsed.shadowAlignment).toBe('br');

			// Round-trip emit
			const xml = codec.buildOuterShadowXml({
				shadowColor: '#000000',
				shadowAngle: 0,
				shadowDistance: 4,
				shadowScaleX: 90000,
				shadowScaleY: 110000,
				shadowSkewX: 60000,
				shadowSkewY: 120000,
				shadowAlignment: 'br',
			} as ShapeStyle);
			expect(xml).toBeDefined();
			expect(xml!['@_sx']).toBe('90000');
			expect(xml!['@_sy']).toBe('110000');
			expect(xml!['@_kx']).toBe('60000');
			expect(xml!['@_ky']).toBe('120000');
			expect(xml!['@_algn']).toBe('br');
		});

		it('round-trips innerShdw rotWithShape', () => {
			const shapeProps: XmlObject = {
				'a:effectLst': {
					'a:innerShdw': {
						'@_blurRad': '50800',
						'@_dist': '0',
						'@_dir': '0',
						'@_rotWithShape': '0',
						'a:srgbClr': { '@_val': '000000' },
					},
				},
			};
			const parsed = codec.extractInnerShadowStyle(shapeProps);
			expect(parsed.innerShadowRotateWithShape).toBeFalsy();

			const xml = codec.buildInnerShadowXml({
				innerShadowColor: '#000000',
				innerShadowOffsetX: 0,
				innerShadowOffsetY: 0,
				innerShadowBlur: 6,
				innerShadowOpacity: 0.5,
				innerShadowRotateWithShape: false,
			} as ShapeStyle);
			expect(xml).toBeDefined();
			expect(xml!['@_rotWithShape']).toBe('0');
		});

		it('round-trips reflection fadeDir/sx/sy/kx/ky/algn/rotWithShape/stPos', () => {
			const shapeProps: XmlObject = {
				'a:effectLst': {
					'a:reflection': {
						'@_blurRad': '6350',
						'@_stA': '60000',
						'@_endA': '300',
						'@_endPos': '60000',
						'@_dist': '5000',
						'@_dir': '5400000',
						'@_fadeDir': '5400000',
						'@_sx': '100000',
						'@_sy': '-100000',
						'@_kx': '0',
						'@_ky': '0',
						'@_algn': 'bl',
						'@_rotWithShape': '0',
						'@_stPos': '0',
					},
				},
			};
			const parsed = codec.extractReflectionStyle(shapeProps);
			expect(parsed.reflectionFadeDirection).toBe(90);
			expect(parsed.reflectionScaleX).toBe(100000);
			expect(parsed.reflectionScaleY).toBe(-100000);
			expect(parsed.reflectionSkewX).toBe(0);
			expect(parsed.reflectionSkewY).toBe(0);
			expect(parsed.reflectionAlignment).toBe('bl');
			expect(parsed.reflectionRotateWithShape).toBeFalsy();
			expect(parsed.reflectionStartPosition).toBe(0);

			const xml = codec.buildReflectionXml({
				reflectionBlurRadius: 0.5,
				reflectionStartOpacity: 0.6,
				reflectionEndOpacity: 0.003,
				reflectionEndPosition: 0.6,
				reflectionDistance: 0.5,
				reflectionDirection: 90,
				reflectionFadeDirection: 90,
				reflectionScaleX: 100000,
				reflectionScaleY: -100000,
				reflectionSkewX: 0,
				reflectionSkewY: 0,
				reflectionAlignment: 'bl',
				reflectionRotateWithShape: false,
				reflectionStartPosition: 0,
			} as ShapeStyle);
			expect(xml).toBeDefined();
			expect(xml!['@_fadeDir']).toBe('5400000');
			expect(xml!['@_sx']).toBe('100000');
			expect(xml!['@_sy']).toBe('-100000');
			expect(xml!['@_kx']).toBe('0');
			expect(xml!['@_ky']).toBe('0');
			expect(xml!['@_algn']).toBe('bl');
			expect(xml!['@_rotWithShape']).toBe('0');
			expect(xml!['@_stPos']).toBe('0');
		});
	});

	// ---------------------------------------------------------------------
	// Phase 5 Stream A item 2 — prstShdw writer (E-H5)
	// ---------------------------------------------------------------------
	describe('buildPresetShadowXml (E-H5)', () => {
		it('emits a:prstShdw with @prst, @dist, @dir and color', () => {
			const xml = codec.buildPresetShadowXml({
				presetShadowName: 'shdw3',
				shadowColor: '#FF0000',
				shadowOpacity: 0.5,
				shadowAngle: 90,
				shadowDistance: 4,
			} as ShapeStyle);
			expect(xml).toBeDefined();
			expect(xml!['@_prst']).toBe('shdw3');
			expect(xml!['@_dir']).toBe('5400000');
			expect(xml!['@_dist']).toBe('38100'); // 4 * 9525
			const srgb = xml!['a:srgbClr'] as XmlObject;
			expect(srgb['@_val']).toBe('FF0000');
		});

		it('returns undefined when presetShadowName is not set', () => {
			expect(codec.buildPresetShadowXml({} as ShapeStyle)).toBeUndefined();
		});
	});
});
