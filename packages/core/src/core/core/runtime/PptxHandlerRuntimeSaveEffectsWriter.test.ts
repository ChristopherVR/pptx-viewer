import { describe, it, expect } from 'vitest';

import type { Pptx3DScene, XmlObject, ShapeStyle } from '../../types';
import { applyScene3dStyle, applyShape3dStyle } from '../builders/shape-style-3d-helpers';

/**
 * The `applyEffectsAndThreeD` method is protected and calls several
 * delegated build methods. We test the effect assembly and 3D scene/shape
 * serialization logic by reimplementing the core aggregation from the source.
 */

// ---------------------------------------------------------------------------
// applyEffectsAndThreeD — reimplemented from source (effect + 3D portions)
// ---------------------------------------------------------------------------

// Faithful copies of the module-private scene3d save helpers from
// PptxHandlerRuntimeSaveEffectsWriter (that module cannot be imported here: its
// mixin chain crashes on load, which is why this suite reimplements the writer).
function buildSphereRot(
	lat: number | undefined,
	lon: number | undefined,
	rev: number | undefined,
): XmlObject | undefined {
	if (lat === undefined && lon === undefined && rev === undefined) {
		return undefined;
	}
	const rot: XmlObject = {};
	if (lat !== undefined) {
		rot['@_lat'] = String(lat);
	}
	if (lon !== undefined) {
		rot['@_lon'] = String(lon);
	}
	if (rev !== undefined) {
		rot['@_rev'] = String(rev);
	}
	return rot;
}

function buildScene3dCamera(s3d: Pptx3DScene, source: XmlObject): XmlObject {
	const camera: XmlObject = { ...((source['a:camera'] as XmlObject | undefined) ?? {}) };
	if (s3d.cameraPreset) {
		camera['@_prst'] = s3d.cameraPreset;
	}
	if (s3d.cameraFieldOfView !== undefined) {
		camera['@_fov'] = String(s3d.cameraFieldOfView);
	}
	if (s3d.cameraZoom !== undefined) {
		camera['@_zoom'] = String(s3d.cameraZoom);
	}
	const rot = buildSphereRot(s3d.cameraRotX, s3d.cameraRotY, s3d.cameraRotZ);
	if (rot) {
		camera['a:rot'] = rot;
	}
	return camera;
}

function buildScene3dLightRig(s3d: Pptx3DScene, source: XmlObject): XmlObject | undefined {
	const lightRig: XmlObject = { ...((source['a:lightRig'] as XmlObject | undefined) ?? {}) };
	if (s3d.lightRigType) {
		lightRig['@_rig'] = s3d.lightRigType;
	}
	if (s3d.lightRigDirection) {
		lightRig['@_dir'] = s3d.lightRigDirection;
	}
	const rot = buildSphereRot(s3d.lightRigRotX, s3d.lightRigRotY, s3d.lightRigRotZ);
	if (rot) {
		lightRig['a:rot'] = rot;
	}
	return Object.keys(lightRig).length > 0 ? lightRig : undefined;
}

function buildScene3dBackdrop(s3d: Pptx3DScene): XmlObject | undefined {
	const hasNorm =
		s3d.backdropNormalX !== undefined ||
		s3d.backdropNormalY !== undefined ||
		s3d.backdropNormalZ !== undefined;
	const hasUp =
		s3d.backdropUpX !== undefined || s3d.backdropUpY !== undefined || s3d.backdropUpZ !== undefined;
	if (!s3d.hasBackdrop || !hasNorm || !hasUp) {
		return undefined;
	}
	return {
		'a:anchor': {
			'@_x': String(s3d.backdropAnchorX ?? 0),
			'@_y': String(s3d.backdropAnchorY ?? 0),
			'@_z': String(s3d.backdropAnchorZ ?? 0),
		},
		'a:norm': {
			'@_dx': String(s3d.backdropNormalX ?? 0),
			'@_dy': String(s3d.backdropNormalY ?? 0),
			'@_dz': String(s3d.backdropNormalZ ?? 0),
		},
		'a:up': {
			'@_dx': String(s3d.backdropUpX ?? 0),
			'@_dy': String(s3d.backdropUpY ?? 0),
			'@_dz': String(s3d.backdropUpZ ?? 0),
		},
	};
}

function applyEffectsAndThreeD(
	spPr: XmlObject,
	shapeStyle: ShapeStyle,
	// Mock effect builders — return undefined unless the test provides them
	builders: {
		outerShadow?: XmlObject;
		innerShadow?: XmlObject;
		glow?: XmlObject;
		softEdge?: XmlObject;
		reflection?: XmlObject;
		blur?: XmlObject;
	} = {},
): void {
	const outerShadowXml = builders.outerShadow;
	const innerShadowXml = builders.innerShadow;
	const glowXml = builders.glow;
	const softEdgeXml = builders.softEdge;
	const reflectionXml = builders.reflection;
	const blurXml = builders.blur;

	const hasAnyEffect =
		outerShadowXml || innerShadowXml || glowXml || softEdgeXml || reflectionXml || blurXml;

	if (hasAnyEffect) {
		const effectList = (spPr['a:effectLst'] || {}) as XmlObject;
		if (outerShadowXml) {
			effectList['a:outerShdw'] = outerShadowXml;
		}
		if (innerShadowXml) {
			effectList['a:innerShdw'] = innerShadowXml;
		}
		if (glowXml) {
			effectList['a:glow'] = glowXml;
		}
		if (softEdgeXml) {
			effectList['a:softEdge'] = softEdgeXml;
		}
		if (reflectionXml) {
			effectList['a:reflection'] = reflectionXml;
		}
		if (blurXml) {
			effectList['a:blur'] = blurXml;
		}
		spPr['a:effectLst'] = effectList;
	} else {
		const effectList = spPr['a:effectLst'] as XmlObject | undefined;
		if (effectList) {
			if (shapeStyle.shadowColor !== undefined && !outerShadowXml) {
				delete effectList['a:outerShdw'];
			}
			if (shapeStyle.innerShadowColor !== undefined && !innerShadowXml) {
				delete effectList['a:innerShdw'];
			}
			if (shapeStyle.glowColor !== undefined && !glowXml) {
				delete effectList['a:glow'];
			}
			if (shapeStyle.softEdgeRadius !== undefined && !softEdgeXml) {
				delete effectList['a:softEdge'];
			}
			if (shapeStyle.reflectionBlurRadius !== undefined && !reflectionXml) {
				delete effectList['a:reflection'];
			}
			if (shapeStyle.blurRadius !== undefined && !blurXml) {
				delete effectList['a:blur'];
			}
			if (Object.keys(effectList).length === 0) {
				delete spPr['a:effectLst'];
			}
		}
	}

	// effectDag
	if (shapeStyle.effectDagXml) {
		spPr['a:effectDag'] = shapeStyle.effectDagXml;
	}

	// 3D Scene — delegates to the real save helpers exercised by this suite.
	if (shapeStyle.scene3d) {
		const s3d = shapeStyle.scene3d;
		const hasData = s3d.cameraPreset || s3d.lightRigType;
		if (hasData) {
			const source = (spPr['a:scene3d'] as XmlObject | undefined) ?? {};
			const scene3dXml: XmlObject = { ...source };
			scene3dXml['a:camera'] = buildScene3dCamera(s3d, source);
			const lightRig = buildScene3dLightRig(s3d, source);
			if (lightRig) {
				scene3dXml['a:lightRig'] = lightRig;
			}
			const backdrop = buildScene3dBackdrop(s3d);
			if (backdrop) {
				scene3dXml['a:backdrop'] = backdrop;
			} else {
				delete scene3dXml['a:backdrop'];
			}
			spPr['a:scene3d'] = scene3dXml;
		} else {
			delete spPr['a:scene3d'];
		}
	} else if (shapeStyle.scene3d === undefined) {
		delete spPr['a:scene3d'];
	}

	// 3D Shape
	if (shapeStyle.shape3d) {
		const sh3d = shapeStyle.shape3d;
		const hasData =
			sh3d.extrusionHeight !== undefined ||
			sh3d.contourWidth !== undefined ||
			sh3d.presetMaterial ||
			sh3d.bevelTopType ||
			sh3d.bevelBottomType ||
			sh3d.extrusionColor ||
			sh3d.contourColor;
		if (hasData) {
			const sp3dXml: XmlObject = {};
			if (sh3d.extrusionHeight !== undefined) {
				sp3dXml['@_extrusionH'] = sh3d.extrusionHeight;
			}
			if (sh3d.contourWidth !== undefined) {
				sp3dXml['@_contourW'] = sh3d.contourWidth;
			}
			if (sh3d.presetMaterial) {
				sp3dXml['@_prstMaterial'] = sh3d.presetMaterial;
			}
			if (sh3d.bevelTopType) {
				const bevelT: XmlObject = { '@_prst': sh3d.bevelTopType };
				if (sh3d.bevelTopWidth !== undefined) {
					bevelT['@_w'] = sh3d.bevelTopWidth;
				}
				if (sh3d.bevelTopHeight !== undefined) {
					bevelT['@_h'] = sh3d.bevelTopHeight;
				}
				sp3dXml['a:bevelT'] = bevelT;
			}
			if (sh3d.bevelBottomType) {
				const bevelB: XmlObject = { '@_prst': sh3d.bevelBottomType };
				if (sh3d.bevelBottomWidth !== undefined) {
					bevelB['@_w'] = sh3d.bevelBottomWidth;
				}
				if (sh3d.bevelBottomHeight !== undefined) {
					bevelB['@_h'] = sh3d.bevelBottomHeight;
				}
				sp3dXml['a:bevelB'] = bevelB;
			}
			if (sh3d.extrusionColor) {
				sp3dXml['a:extrusionClr'] = {
					'a:srgbClr': { '@_val': sh3d.extrusionColor.replace('#', '') },
				};
			}
			if (sh3d.contourColor) {
				sp3dXml['a:contourClr'] = {
					'a:srgbClr': { '@_val': sh3d.contourColor.replace('#', '') },
				};
			}
			spPr['a:sp3d'] = sp3dXml;
		} else {
			delete spPr['a:sp3d'];
		}
	} else if (shapeStyle.shape3d === undefined) {
		delete spPr['a:sp3d'];
	}
}

// ---------------------------------------------------------------------------
// Tests: effect list assembly
// ---------------------------------------------------------------------------
describe('applyEffectsAndThreeD – effect list assembly', () => {
	it('should create effectLst with outer shadow', () => {
		const spPr: XmlObject = {};
		const shadow: XmlObject = { '@_blurRad': '38100' };
		applyEffectsAndThreeD(spPr, {}, { outerShadow: shadow });
		const effectLst = spPr['a:effectLst'] as XmlObject;
		expect(effectLst['a:outerShdw']).toBe(shadow);
	});

	it('should create effectLst with multiple effects', () => {
		const spPr: XmlObject = {};
		const shadow: XmlObject = { '@_blurRad': '38100' };
		const glow: XmlObject = { '@_rad': '50800' };
		const blur: XmlObject = { '@_rad': '25400' };
		applyEffectsAndThreeD(spPr, {}, { outerShadow: shadow, glow, blur });
		const effectLst = spPr['a:effectLst'] as XmlObject;
		expect(effectLst['a:outerShdw']).toBe(shadow);
		expect(effectLst['a:glow']).toBe(glow);
		expect(effectLst['a:blur']).toBe(blur);
	});

	it('should merge into existing effectLst', () => {
		const existing: XmlObject = { 'a:outerShdw': { '@_blurRad': '10000' } };
		const spPr: XmlObject = { 'a:effectLst': existing };
		const glow: XmlObject = { '@_rad': '50800' };
		applyEffectsAndThreeD(spPr, {}, { glow });
		const effectLst = spPr['a:effectLst'] as XmlObject;
		// Existing outer shadow stays, glow is added
		expect(effectLst['a:outerShdw']).toStrictEqual({ '@_blurRad': '10000' });
		expect(effectLst['a:glow']).toBe(glow);
	});

	it('should remove outer shadow from effectLst when shadowColor is set but builder returns undefined', () => {
		const spPr: XmlObject = {
			'a:effectLst': {
				'a:outerShdw': { '@_blurRad': '38100' },
				'a:glow': { '@_rad': '1000' },
			},
		};
		applyEffectsAndThreeD(spPr, { shadowColor: '#000000' });
		const effectLst = spPr['a:effectLst'] as XmlObject;
		expect(effectLst['a:outerShdw']).toBeUndefined();
		expect(effectLst['a:glow']).toBeDefined();
	});

	it('should remove inner shadow from effectLst when innerShadowColor is set but builder returns undefined', () => {
		const spPr: XmlObject = {
			'a:effectLst': {
				'a:innerShdw': { '@_blurRad': '38100' },
				'a:glow': { '@_rad': '5000' },
			},
		};
		applyEffectsAndThreeD(spPr, { innerShadowColor: '#FF0000' });
		const effectLst = spPr['a:effectLst'] as XmlObject;
		expect(effectLst['a:innerShdw']).toBeUndefined();
		expect(effectLst['a:glow']).toBeDefined();
	});

	it('should delete effectLst entirely when it becomes empty', () => {
		const spPr: XmlObject = {
			'a:effectLst': { 'a:outerShdw': {} },
		};
		applyEffectsAndThreeD(spPr, { shadowColor: '#000' });
		expect(spPr['a:effectLst']).toBeUndefined();
	});

	it('should set effectDag from shapeStyle', () => {
		const spPr: XmlObject = {};
		const dag: XmlObject = { 'a:grayscl': {} };
		applyEffectsAndThreeD(spPr, { effectDagXml: dag });
		expect(spPr['a:effectDag']).toBe(dag);
	});
});

// ---------------------------------------------------------------------------
// Tests: 3D Scene serialization
// ---------------------------------------------------------------------------
describe('applyEffectsAndThreeD – 3D Scene', () => {
	it('should write scene3d with camera preset and light rig', () => {
		const spPr: XmlObject = {};
		applyEffectsAndThreeD(spPr, {
			scene3d: {
				cameraPreset: 'orthographicFront',
				lightRigType: 'threePt',
				lightRigDirection: 't',
			},
		});
		const scene = spPr['a:scene3d'] as XmlObject;
		expect(scene).toBeDefined();
		expect((scene['a:camera'] as XmlObject)['@_prst']).toBe('orthographicFront');
		const lightRig = scene['a:lightRig'] as XmlObject;
		expect(lightRig['@_rig']).toBe('threePt');
		expect(lightRig['@_dir']).toBe('t');
	});

	it('should include camera rotation when set', () => {
		const spPr: XmlObject = {};
		applyEffectsAndThreeD(spPr, {
			scene3d: {
				cameraPreset: 'perspectiveFront',
				cameraRotX: 1000000,
				cameraRotY: 2000000,
				cameraRotZ: 3000000,
			},
		});
		const camera = (spPr['a:scene3d'] as XmlObject)['a:camera'] as XmlObject;
		const rot = camera['a:rot'] as XmlObject;
		expect(rot['@_lat']).toBe('1000000');
		expect(rot['@_lon']).toBe('2000000');
		expect(rot['@_rev']).toBe('3000000');
	});

	it('should emit a valid backdrop (anchor + norm + up) when vectors are present', () => {
		const spPr: XmlObject = {};
		applyEffectsAndThreeD(spPr, {
			scene3d: {
				cameraPreset: 'orthographicFront',
				hasBackdrop: true,
				backdropAnchorX: 100,
				backdropAnchorY: 200,
				backdropAnchorZ: 300,
				backdropNormalX: 0,
				backdropNormalY: 0,
				backdropNormalZ: 1,
				backdropUpX: 0,
				backdropUpY: 1,
				backdropUpZ: 0,
			},
		});
		const scene = spPr['a:scene3d'] as XmlObject;
		const backdrop = scene['a:backdrop'] as XmlObject;
		expect(backdrop).toBeDefined();
		const anchor = backdrop['a:anchor'] as XmlObject;
		expect(anchor['@_x']).toBe('100');
		expect(anchor['@_z']).toBe('300');
		expect(backdrop['a:norm']).toStrictEqual({ '@_dx': '0', '@_dy': '0', '@_dz': '1' });
		expect(backdrop['a:up']).toStrictEqual({ '@_dx': '0', '@_dy': '1', '@_dz': '0' });
	});

	it('should omit a partial backdrop missing norm/up (schema-invalid)', () => {
		const spPr: XmlObject = {};
		applyEffectsAndThreeD(spPr, {
			scene3d: {
				cameraPreset: 'orthographicFront',
				hasBackdrop: true,
				backdropAnchorX: 100,
				backdropAnchorY: 200,
				backdropAnchorZ: 300,
			},
		});
		const scene = spPr['a:scene3d'] as XmlObject;
		expect(scene['a:backdrop']).toBeUndefined();
	});

	it('should delete scene3d when scene3d has no data', () => {
		const spPr: XmlObject = { 'a:scene3d': { 'a:camera': {} } };
		applyEffectsAndThreeD(spPr, { scene3d: {} });
		expect(spPr['a:scene3d']).toBeUndefined();
	});

	it('should delete scene3d when scene3d is undefined on shapeStyle', () => {
		const spPr: XmlObject = { 'a:scene3d': { 'a:camera': {} } };
		applyEffectsAndThreeD(spPr, {});
		expect(spPr['a:scene3d']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Tests: 3D Shape serialization
// ---------------------------------------------------------------------------
describe('applyEffectsAndThreeD – 3D Shape', () => {
	it('should write sp3d with extrusion height and material', () => {
		const spPr: XmlObject = {};
		applyEffectsAndThreeD(spPr, {
			shape3d: {
				extrusionHeight: 76200,
				presetMaterial: 'metal',
			},
		});
		const sp3d = spPr['a:sp3d'] as XmlObject;
		expect(sp3d['@_extrusionH']).toBe(76200);
		expect(sp3d['@_prstMaterial']).toBe('metal');
	});

	it('should write top and bottom bevels', () => {
		const spPr: XmlObject = {};
		applyEffectsAndThreeD(spPr, {
			shape3d: {
				bevelTopType: 'circle',
				bevelTopWidth: 12700,
				bevelTopHeight: 25400,
				bevelBottomType: 'relaxedInset',
				bevelBottomWidth: 6350,
				bevelBottomHeight: 6350,
			},
		});
		const sp3d = spPr['a:sp3d'] as XmlObject;
		const bevelT = sp3d['a:bevelT'] as XmlObject;
		expect(bevelT['@_prst']).toBe('circle');
		expect(bevelT['@_w']).toBe(12700);
		expect(bevelT['@_h']).toBe(25400);
		const bevelB = sp3d['a:bevelB'] as XmlObject;
		expect(bevelB['@_prst']).toBe('relaxedInset');
	});

	it('should write contour and extrusion colours', () => {
		const spPr: XmlObject = {};
		applyEffectsAndThreeD(spPr, {
			shape3d: {
				extrusionColor: '4F81BD',
				contourColor: 'FF0000',
				contourWidth: 12700,
			},
		});
		const sp3d = spPr['a:sp3d'] as XmlObject;
		expect(sp3d['a:extrusionClr']).toStrictEqual({
			'a:srgbClr': { '@_val': '4F81BD' },
		});
		expect(sp3d['a:contourClr']).toStrictEqual({
			'a:srgbClr': { '@_val': 'FF0000' },
		});
		expect(sp3d['@_contourW']).toBe(12700);
	});

	it('should delete sp3d when shape3d has no data', () => {
		const spPr: XmlObject = { 'a:sp3d': { '@_extrusionH': '0' } };
		applyEffectsAndThreeD(spPr, { shape3d: {} });
		expect(spPr['a:sp3d']).toBeUndefined();
	});

	it('should delete sp3d when shape3d is undefined on shapeStyle', () => {
		const spPr: XmlObject = { 'a:sp3d': {} };
		applyEffectsAndThreeD(spPr, {});
		expect(spPr['a:sp3d']).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Regression: sp3d extrusion colour + scene3d fov/zoom round-trip (issues 67/86)
// ---------------------------------------------------------------------------
describe('3D round-trip: parse -> save', () => {
	// Mirrors the real parse-side colour resolution: srgbClr val -> "#RRGGBB".
	const parseColor = (node: XmlObject | undefined): string | undefined => {
		const srgb = node?.['a:srgbClr'] as XmlObject | undefined;
		return srgb ? `#${srgb['@_val']}` : undefined;
	};

	it('writes a valid #-free srgbClr val for extrusion/contour colour', () => {
		const source: XmlObject = {
			'a:sp3d': {
				'@_extrusionH': '76200',
				'a:extrusionClr': { 'a:srgbClr': { '@_val': '4F81BD' } },
				'a:contourClr': { 'a:srgbClr': { '@_val': 'FF0000' } },
			},
		};
		const style: ShapeStyle = {} as ShapeStyle;
		applyShape3dStyle(source, style, { parseColor });
		// The parsed model carries a leading '#'.
		expect(style.shape3d?.extrusionColor).toBe('#4F81BD');

		const spPr: XmlObject = {};
		applyEffectsAndThreeD(spPr, style);
		const sp3d = spPr['a:sp3d'] as XmlObject;
		const extVal = (sp3d['a:extrusionClr'] as XmlObject)['a:srgbClr'] as XmlObject;
		const conVal = (sp3d['a:contourClr'] as XmlObject)['a:srgbClr'] as XmlObject;
		expect(extVal['@_val']).toBe('4F81BD');
		expect(conVal['@_val']).toBe('FF0000');
		expect(String(extVal['@_val'])).not.toContain('#');
		expect(String(conVal['@_val'])).not.toContain('#');
	});

	it('preserves camera fov/zoom and light-rig rotation across the round-trip', () => {
		const source: XmlObject = {
			'a:scene3d': {
				'a:camera': {
					'@_prst': 'perspectiveFront',
					'@_fov': '600000',
					'@_zoom': '150000',
					'a:rot': { '@_lat': '1000', '@_lon': '2000', '@_rev': '3000' },
				},
				'a:lightRig': {
					'@_rig': 'threePt',
					'@_dir': 't',
					'a:rot': { '@_lat': '10', '@_lon': '20', '@_rev': '30' },
				},
			},
		};
		const style: ShapeStyle = {} as ShapeStyle;
		applyScene3dStyle(source, style);
		expect(style.scene3d?.cameraFieldOfView).toBe(600000);
		expect(style.scene3d?.cameraZoom).toBe(150000);
		expect(style.scene3d?.lightRigRotX).toBe(10);

		const spPr: XmlObject = { 'a:scene3d': source['a:scene3d'] };
		applyEffectsAndThreeD(spPr, style);
		const scene = spPr['a:scene3d'] as XmlObject;
		const camera = scene['a:camera'] as XmlObject;
		expect(camera['@_fov']).toBe('600000');
		expect(camera['@_zoom']).toBe('150000');
		const lightRig = scene['a:lightRig'] as XmlObject;
		const lrRot = lightRig['a:rot'] as XmlObject;
		expect(lrRot['@_lat']).toBe('10');
		expect(lrRot['@_rev']).toBe('30');
	});

	it('round-trips a valid backdrop (anchor + norm + up)', () => {
		const source: XmlObject = {
			'a:scene3d': {
				'a:camera': { '@_prst': 'orthographicFront' },
				'a:backdrop': {
					'a:anchor': { '@_x': '1', '@_y': '2', '@_z': '3' },
					'a:norm': { '@_dx': '0', '@_dy': '0', '@_dz': '1' },
					'a:up': { '@_dx': '0', '@_dy': '1', '@_dz': '0' },
				},
			},
		};
		const style: ShapeStyle = {} as ShapeStyle;
		applyScene3dStyle(source, style);
		expect(style.scene3d?.backdropNormalZ).toBe(1);
		expect(style.scene3d?.backdropUpY).toBe(1);

		const spPr: XmlObject = { 'a:scene3d': source['a:scene3d'] };
		applyEffectsAndThreeD(spPr, style);
		const backdrop = (spPr['a:scene3d'] as XmlObject)['a:backdrop'] as XmlObject;
		expect(backdrop['a:anchor']).toBeDefined();
		expect(backdrop['a:norm']).toStrictEqual({ '@_dx': '0', '@_dy': '0', '@_dz': '1' });
		expect(backdrop['a:up']).toStrictEqual({ '@_dx': '0', '@_dy': '1', '@_dz': '0' });
	});
});
