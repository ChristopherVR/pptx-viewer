/**
 * Authored scene data of a PowerPoint 3D model (`am3d:model3d`, namespace
 * `http://schemas.microsoft.com/office/drawing/2017/model3d`).
 *
 * This is a read-only parsed view: the untouched XML stays on the element's
 * `rawXml`, so the camera, transform and lights round-trip on save.
 */

/** A 3D point or vector. Points are in EMU; direction vectors are unit-less. */
export interface Model3DVec3 {
	x: number;
	y: number;
	z: number;
}

/** `am3d:camera`. Positions are EMU, `fovDeg` is in degrees. */
export interface Model3DCamera {
	position?: Model3DVec3;
	/** Up vector (`am3d:up`), unit-less. */
	up?: Model3DVec3;
	/** Look-at target point (`am3d:lookAt`), EMU. */
	lookAt?: Model3DVec3;
	projection: 'perspective' | 'orthographic';
	/** Vertical field of view in degrees (perspective only). */
	fovDeg?: number;
	/** Orthographic view scale (orthographic only), when authored. */
	orthoScale?: number;
}

/** `am3d:trans`: how the model sits in the scene. Offsets are EMU. */
export interface Model3DTransformData {
	/** `meterPerModelUnit` as a plain ratio. */
	meterPerModelUnit?: number;
	preTranslate?: Model3DVec3;
	scale?: Model3DVec3;
	/** Euler rotation in degrees about each axis (`am3d:rot`). */
	rotationDeg?: Model3DVec3;
	postTranslate?: Model3DVec3;
}

/** One authored light (`am3d:ambientLight`, `ptLight`, `spotLight`, `dirLight`). */
export interface Model3DLightData {
	kind: 'ambient' | 'point' | 'spot' | 'directional';
	/** `#rrggbb`, when the light has an authored colour. */
	color?: string;
	/** `am3d:illuminance` as a plain ratio. */
	illuminance?: number;
	position?: Model3DVec3;
	direction?: Model3DVec3;
	/** Spot cone angle in degrees, when authored. */
	spotAngleDeg?: number;
}

/** Everything parsed from an `am3d:model3d` scene. */
export interface Model3DSceneData {
	camera?: Model3DCamera;
	transform?: Model3DTransformData;
	lights: Model3DLightData[];
	/** `am3d:objViewport/@viewportSz` in EMU. */
	viewportSizeEmu?: number;
}
