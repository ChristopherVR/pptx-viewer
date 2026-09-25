/**
 * A Picture Styles pick as an element patch. The style REPLACES the
 * picture's geometry, fill, outline, effects and 3-D wholesale (PowerPoint
 * clears the previous style's effects), and the `ShapeStyle` built here is
 * field-for-field what core's load path produces for the XML PowerPoint
 * writes, so the save path writes that XML back.
 *
 * @module render/ribbon-galleries/picture-styles-patch
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { cropShapeForPresetGeometry } from 'pptx-viewer-core';

import { colorSpecXml, resolveColorSpec } from './gallery-color-spec';
import { shapeStyleWithoutFormatting } from './gallery-element-patch';
import type {
	PictureStyleOuterShadow,
	PictureStyleScene,
	PictureStyleShape3d,
	PictureStyleSpec,
} from './picture-styles-spec';

const EMU_PER_PX = 9525;
/** `a:reflection` constants every reflected picture style shares. */
const REFLECTION_BLUR_EMU = 12700;
const REFLECTION_DIST_EMU = 5000;

function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

function outerShadowStyle(spec: PictureStyleOuterShadow): ShapeStyle {
	const { hex, opacity } = resolveColorSpec(spec.color, undefined);
	const colorXml = colorSpecXml(spec.color);
	const angle = (spec.dir ?? 0) / 60000;
	const out: ShapeStyle = {
		shadowColor: hex,
		shadowBlur: spec.blur / EMU_PER_PX,
		shadowAngle: angle,
		shadowRotateWithShape: false,
		outerShadowXml: colorXml,
		outerShadowOriginalColor: hex,
		...(opacity !== undefined && { shadowOpacity: opacity, outerShadowOriginalOpacity: opacity }),
		...(spec.sx !== undefined && { shadowScaleX: spec.sx }),
		...(spec.sy !== undefined && { shadowScaleY: spec.sy }),
		...(spec.kx !== undefined && { shadowSkewX: spec.kx }),
		...(spec.ky !== undefined && { shadowSkewY: spec.ky }),
		...(spec.algn && { shadowAlignment: spec.algn }),
	};
	// PowerPoint omits `dist` for a centred shadow; the writer needs an
	// explicit 0 or it falls back to its legacy 4px/45deg offset.
	const dist = (spec.dist ?? 0) / EMU_PER_PX;
	const rad = (angle * Math.PI) / 180;
	out.shadowDistance = dist;
	out.shadowOffsetX = round2(Math.cos(rad) * dist);
	out.shadowOffsetY = round2(Math.sin(rad) * dist);
	return out;
}

function sceneStyle(scene: PictureStyleScene): NonNullable<ShapeStyle['scene3d']> {
	return {
		cameraPreset: scene.camera,
		...(scene.fov !== undefined && { cameraFieldOfView: scene.fov }),
		...(scene.rot && {
			cameraRotX: scene.rot[0],
			cameraRotY: scene.rot[1],
			cameraRotZ: scene.rot[2],
		}),
		lightRigType: scene.rig,
		lightRigDirection: 't',
		...(scene.rigRev !== undefined && {
			lightRigRotX: 0,
			lightRigRotY: 0,
			lightRigRotZ: scene.rigRev,
		}),
	};
}

function shape3dStyle(sp3d: PictureStyleShape3d): NonNullable<ShapeStyle['shape3d']> {
	return {
		bevelTopType: sp3d.bevelPrst ?? 'circle',
		...(sp3d.bevelW !== undefined && { bevelTopWidth: sp3d.bevelW }),
		bevelTopHeight: sp3d.bevelH,
		...(sp3d.contourW !== undefined && { contourWidth: sp3d.contourW }),
		...(sp3d.contourClr && { contourColor: sp3d.contourClr }),
		...(sp3d.material && { presetMaterial: sp3d.material }),
		...(sp3d.extrusionH !== undefined && { extrusionHeight: sp3d.extrusionH }),
		...(sp3d.extrusionClr && { extrusionColor: sp3d.extrusionClr }),
	};
}

function lineStyle(spec: PictureStyleSpec): ShapeStyle {
	const line = spec.line;
	if (!line) {
		return { strokeFillMode: 'none', strokeWidth: 0, strokeColor: 'transparent' };
	}
	return {
		strokeWidth: line.w / EMU_PER_PX,
		strokeFillMode: 'solid',
		strokeColor: line.color,
		strokeColorXml: colorSpecXml(line.color),
		lineCap: line.cap,
		...(line.dash && { strokeDash: 'solid' }),
		...(line.miter && { lineJoin: 'miter', miterLimit: 800000 }),
		...(line.cmpd && { compoundLine: line.cmpd }),
	};
}

/** The picture's `ShapeStyle` after picking `spec` (connector keys aside, everything is replaced). */
export function pictureStyleShapeStyle(spec: PictureStyleSpec, element: PptxElement): ShapeStyle {
	// `styleMatrixReset` makes the writer drop the retained `spPr` fill,
	// outline, effects and 3-D first, so nothing of the previous style leaks.
	const style: ShapeStyle = {
		...shapeStyleWithoutFormatting(element),
		effectListXml: {},
		styleMatrixReset: true,
	};
	if (spec.fill) {
		const fill = resolveColorSpec(spec.fill, undefined);
		Object.assign(style, { fillMode: 'solid', fillColor: fill.hex, fillColorXml: fill.xml });
	}
	Object.assign(style, lineStyle(spec));
	if (spec.outer) {
		Object.assign(style, outerShadowStyle(spec.outer));
	}
	if (spec.innerBlur !== undefined) {
		Object.assign(style, {
			innerShadowColor: '#000000',
			innerShadowBlur: spec.innerBlur / EMU_PER_PX,
			innerShadowXml: colorSpecXml('#000000'),
			innerShadowOriginalColor: '#000000',
		});
	}
	if (spec.reflection) {
		Object.assign(style, {
			reflectionBlurRadius: REFLECTION_BLUR_EMU / EMU_PER_PX,
			reflectionStartOpacity: spec.reflection.stA / 100000,
			reflectionEndPosition: spec.reflection.endPos / 100000,
			reflectionDirection: 90,
			reflectionDistance: REFLECTION_DIST_EMU / EMU_PER_PX,
			reflectionScaleY: -100000,
			reflectionAlignment: 'bl',
			reflectionRotateWithShape: false,
		});
	}
	if (spec.softEdge !== undefined) {
		style.softEdgeRadius = spec.softEdge / EMU_PER_PX;
	}
	if (spec.scene) {
		style.scene3d = sceneStyle(spec.scene);
	}
	if (spec.sp3d) {
		style.shape3d = shape3dStyle(spec.sp3d);
	}
	return style;
}

/**
 * The whole element patch: geometry (preset, guides, crop shape) plus the
 * style. A style's preset replaces any custom geometry, as in PowerPoint.
 */
export function pictureStylePatch(
	spec: PictureStyleSpec,
	element: PptxElement,
): Partial<PptxElement> {
	return {
		shapeType: spec.geom,
		shapeAdjustments: spec.adj ? { ...spec.adj } : undefined,
		cropShape: cropShapeForPresetGeometry(spec.geom),
		pathData: undefined,
		customGeometryPaths: undefined,
		customGeometryRawData: undefined,
		shapeStyle: pictureStyleShapeStyle(spec, element),
	} as Partial<PptxElement>;
}
