import type { Pptx3DScene, TextStyle, XmlObject } from '../types';
import { cloneXmlObject } from './clone-utils';

const CAMERA_PRESETS = new Set([
	'legacyObliqueTopLeft',
	'legacyObliqueTop',
	'legacyObliqueTopRight',
	'legacyObliqueLeft',
	'legacyObliqueFront',
	'legacyObliqueRight',
	'legacyObliqueBottomLeft',
	'legacyObliqueBottom',
	'legacyObliqueBottomRight',
	'legacyPerspectiveTopLeft',
	'legacyPerspectiveTop',
	'legacyPerspectiveTopRight',
	'legacyPerspectiveLeft',
	'legacyPerspectiveFront',
	'legacyPerspectiveRight',
	'legacyPerspectiveBottomLeft',
	'legacyPerspectiveBottom',
	'legacyPerspectiveBottomRight',
	'orthographicFront',
	'isometricTopUp',
	'isometricTopDown',
	'isometricBottomUp',
	'isometricBottomDown',
	'isometricLeftUp',
	'isometricLeftDown',
	'isometricRightUp',
	'isometricRightDown',
	'isometricOffAxis1Left',
	'isometricOffAxis1Right',
	'isometricOffAxis1Top',
	'isometricOffAxis2Left',
	'isometricOffAxis2Right',
	'isometricOffAxis2Top',
	'isometricOffAxis3Left',
	'isometricOffAxis3Right',
	'isometricOffAxis3Bottom',
	'isometricOffAxis4Left',
	'isometricOffAxis4Right',
	'isometricOffAxis4Bottom',
	'obliqueTopLeft',
	'obliqueTop',
	'obliqueTopRight',
	'obliqueLeft',
	'obliqueRight',
	'obliqueBottomLeft',
	'obliqueBottom',
	'obliqueBottomRight',
	'perspectiveFront',
	'perspectiveLeft',
	'perspectiveRight',
	'perspectiveAbove',
	'perspectiveBelow',
	'perspectiveAboveLeftFacing',
	'perspectiveAboveRightFacing',
	'perspectiveContrastingLeftFacing',
	'perspectiveContrastingRightFacing',
	'perspectiveHeroicLeftFacing',
	'perspectiveHeroicRightFacing',
	'perspectiveHeroicExtremeLeftFacing',
	'perspectiveHeroicExtremeRightFacing',
	'perspectiveRelaxed',
	'perspectiveRelaxedModerately',
]);
const LIGHT_RIGS = new Set([
	'legacyFlat1',
	'legacyFlat2',
	'legacyFlat3',
	'legacyFlat4',
	'legacyNormal1',
	'legacyNormal2',
	'legacyNormal3',
	'legacyNormal4',
	'legacyHarsh1',
	'legacyHarsh2',
	'legacyHarsh3',
	'legacyHarsh4',
	'threePt',
	'balanced',
	'soft',
	'harsh',
	'flood',
	'contrasting',
	'morning',
	'sunrise',
	'sunset',
	'chilly',
	'freezing',
	'flat',
	'twoPt',
	'glow',
	'brightRoom',
]);
const LIGHT_DIRECTIONS = new Set(['tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br']);

const localName = (key: string): string => key.replace(/^@_/, '').split(':').pop() ?? key;
const childKey = (node: XmlObject, local: string): string | undefined =>
	Object.keys(node).find((key) => !key.startsWith('@_') && localName(key) === local);
const child = (node: XmlObject | undefined, local: string): XmlObject | undefined => {
	if (!node) {
		return undefined;
	}
	const key = childKey(node, local);
	return key ? (node[key] as XmlObject | undefined) : undefined;
};
const finiteInt = (value: unknown): number | undefined => {
	const parsed = Number(value);
	return Number.isInteger(parsed) ? parsed : undefined;
};
const percentage = (value: unknown): number | undefined => {
	if (typeof value === 'string' && value.endsWith('%')) {
		const parsed = Number(value.slice(0, -1));
		return Number.isFinite(parsed) && parsed > 0 ? parsed / 100 : undefined;
	}
	const parsed = finiteInt(value);
	return parsed !== undefined && parsed > 0 ? parsed / 100000 : undefined;
};
const enumToken = (value: unknown, allowed: Set<string>): string | undefined => {
	const token = String(value ?? '').trim();
	return allowed.has(token) ? token : undefined;
};
const applyRotation = (target: Pptx3DScene, node: XmlObject | undefined, prefix: string): void => {
	const rot = child(node, 'rot');
	const x = finiteInt(rot?.['@_lat']);
	const y = finiteInt(rot?.['@_lon']);
	const z = finiteInt(rot?.['@_rev']);
	if (x !== undefined) {
		target[`${prefix}RotX` as 'cameraRotX'] = x;
	}
	if (y !== undefined) {
		target[`${prefix}RotY` as 'cameraRotY'] = y;
	}
	if (z !== undefined) {
		target[`${prefix}RotZ` as 'cameraRotZ'] = z;
	}
};
const applyPoint = (target: Pptx3DScene, node: XmlObject | undefined, prefix: string): void => {
	for (const [axis, suffix] of [
		['x', 'X'],
		['y', 'Y'],
		['z', 'Z'],
	] as const) {
		const value = finiteInt(node?.[`@_${axis}`]);
		if (value !== undefined) {
			target[`${prefix}${suffix}` as 'backdropAnchorX'] = value;
		}
	}
};

export function parseTextBodyScene3d(bodyPr: XmlObject, style: TextStyle): void {
	const scene = child(bodyPr, 'scene3d');
	if (!scene) {
		return;
	}
	style.textBodyScene3dXml = cloneXmlObject(scene);
	const camera = child(scene, 'camera');
	const light = child(scene, 'lightRig');
	const typed: Pptx3DScene = {
		cameraPreset: enumToken(camera?.['@_prst'], CAMERA_PRESETS),
		lightRigType: enumToken(light?.['@_rig'], LIGHT_RIGS),
		lightRigDirection: enumToken(light?.['@_dir'], LIGHT_DIRECTIONS),
	};
	const fov = finiteInt(camera?.['@_fov']);
	if (fov !== undefined && fov >= 0 && fov <= 10800000) {
		typed.cameraFieldOfView = fov;
	}
	const zoom = percentage(camera?.['@_zoom']);
	if (zoom !== undefined) {
		typed.cameraZoom = zoom;
	}
	applyRotation(typed, camera, 'camera');
	applyRotation(typed, light, 'lightRig');
	const backdrop = child(scene, 'backdrop');
	if (backdrop) {
		typed.hasBackdrop = true;
		applyPoint(typed, child(backdrop, 'anchor'), 'backdropAnchor');
		applyPoint(typed, child(backdrop, 'norm'), 'backdropNormal');
		applyPoint(typed, child(backdrop, 'up'), 'backdropUp');
	}
	style.textBodyScene3d = typed;
}

const setAttrs = (node: XmlObject, attrs: Record<string, number | string | undefined>): void => {
	for (const [key, value] of Object.entries(attrs)) {
		if (value !== undefined) {
			node[`@_${key}`] = String(value);
		}
	}
};
const setChild = (node: XmlObject, local: string, value: XmlObject): void => {
	const key = childKey(node, local) ?? `a:${local}`;
	node[key] = value;
};
const ordered = (node: XmlObject, order: readonly string[]): XmlObject => {
	const result: XmlObject = {};
	for (const local of order) {
		const key = childKey(node, local);
		if (key) {
			result[key] = node[key];
		}
	}
	for (const key of Object.keys(node)) {
		if (!Object.hasOwn(result, key)) {
			result[key] = node[key];
		}
	}
	return result;
};
const rotationXml = (x?: number, y?: number, z?: number): XmlObject | undefined => {
	if (![x, y, z].some(Number.isInteger)) {
		return undefined;
	}
	const rot: XmlObject = {};
	setAttrs(rot, { lat: x, lon: y, rev: z });
	return rot;
};
const pointXml = (x?: number, y?: number, z?: number): XmlObject | undefined => {
	if (![x, y, z].every(Number.isInteger)) {
		return undefined;
	}
	const point: XmlObject = {};
	setAttrs(point, { x, y, z });
	return point;
};

export function applyTextBodyScene3d(bodyPr: XmlObject, style: TextStyle | undefined): void {
	const existingKey = childKey(bodyPr, 'scene3d');
	const raw =
		cloneXmlObject(style?.textBodyScene3dXml) ??
		(existingKey ? cloneXmlObject(bodyPr[existingKey] as XmlObject) : undefined);
	const typed = style?.textBodyScene3d;
	if (!typed) {
		if (raw) {
			bodyPr[existingKey ?? 'a:scene3d'] = raw;
		}
		return;
	}
	const cameraPreset = enumToken(typed.cameraPreset, CAMERA_PRESETS);
	const lightRig = enumToken(typed.lightRigType, LIGHT_RIGS);
	const lightDir = enumToken(typed.lightRigDirection, LIGHT_DIRECTIONS);
	if ((!cameraPreset || !lightRig || !lightDir) && !raw) {
		return;
	}
	const scene = raw ?? {};
	const camera = cloneXmlObject(child(scene, 'camera')) ?? {};
	if (cameraPreset) {
		camera['@_prst'] = cameraPreset;
	}
	if (
		typed.cameraFieldOfView !== undefined &&
		Number.isInteger(typed.cameraFieldOfView) &&
		typed.cameraFieldOfView >= 0 &&
		typed.cameraFieldOfView <= 10800000
	) {
		camera['@_fov'] = String(typed.cameraFieldOfView);
	}
	if (typed.cameraZoom !== undefined && Number.isFinite(typed.cameraZoom) && typed.cameraZoom > 0) {
		camera['@_zoom'] = String(Math.round(typed.cameraZoom * 100000));
	}
	const cameraRot = rotationXml(typed.cameraRotX, typed.cameraRotY, typed.cameraRotZ);
	if (cameraRot) {
		setChild(camera, 'rot', cameraRot);
	}
	setChild(scene, 'camera', ordered(camera, ['rot']));
	const light = cloneXmlObject(child(scene, 'lightRig')) ?? {};
	if (lightRig) {
		light['@_rig'] = lightRig;
	}
	if (lightDir) {
		light['@_dir'] = lightDir;
	}
	const lightRot = rotationXml(typed.lightRigRotX, typed.lightRigRotY, typed.lightRigRotZ);
	if (lightRot) {
		setChild(light, 'rot', lightRot);
	}
	setChild(scene, 'lightRig', ordered(light, ['rot']));
	if (typed.hasBackdrop) {
		const backdrop = cloneXmlObject(child(scene, 'backdrop')) ?? {};
		const anchor = pointXml(typed.backdropAnchorX, typed.backdropAnchorY, typed.backdropAnchorZ);
		const norm = pointXml(typed.backdropNormalX, typed.backdropNormalY, typed.backdropNormalZ);
		const up = pointXml(typed.backdropUpX, typed.backdropUpY, typed.backdropUpZ);
		if (anchor) {
			setChild(backdrop, 'anchor', anchor);
		}
		if (norm) {
			setChild(backdrop, 'norm', norm);
		}
		if (up) {
			setChild(backdrop, 'up', up);
		}
		if (child(backdrop, 'anchor') && child(backdrop, 'norm') && child(backdrop, 'up')) {
			setChild(scene, 'backdrop', ordered(backdrop, ['anchor', 'norm', 'up', 'extLst']));
		}
	}
	bodyPr[existingKey ?? 'a:scene3d'] = ordered(scene, ['camera', 'lightRig', 'backdrop', 'extLst']);
}
