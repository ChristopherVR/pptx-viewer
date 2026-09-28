import type {
	Model3DCamera,
	Model3DLightData,
	Model3DSceneData,
	Model3DTransformData,
	Model3DVec3,
	XmlObject,
} from '../types';

const ANGLE_UNIT = 60000;

function child(node: XmlObject | undefined, ...names: string[]): XmlObject | undefined {
	if (!node) {
		return undefined;
	}
	for (const name of names) {
		const raw = node[name];
		const value = Array.isArray(raw) ? raw[0] : raw;
		if (value !== undefined && value !== null) {
			return typeof value === 'object' ? (value as XmlObject) : ({} as XmlObject);
		}
	}
	return undefined;
}

function children(node: XmlObject | undefined, name: string): XmlObject[] {
	const raw = node?.[name];
	if (raw === undefined || raw === null) {
		return [];
	}
	return (Array.isArray(raw) ? raw : [raw]).map((v) =>
		typeof v === 'object' && v !== null ? (v as XmlObject) : ({} as XmlObject),
	);
}

function num(node: XmlObject | undefined, attr: string): number | undefined {
	const raw = node?.[`@_${attr}`];
	if (raw === undefined || raw === '') {
		return undefined;
	}
	const value = Number(raw);
	return Number.isFinite(value) ? value : undefined;
}

/** `am3d:*` nodes may be authored with or without the prefix in fixtures. */
function am(node: XmlObject | undefined, name: string): XmlObject | undefined {
	return child(node, `am3d:${name}`, name);
}

function vec(node: XmlObject | undefined, keys: [string, string, string]): Model3DVec3 | undefined {
	if (!node) {
		return undefined;
	}
	const [x, y, z] = keys.map((k) => num(node, k));
	if (x === undefined && y === undefined && z === undefined) {
		return undefined;
	}
	return { x: x ?? 0, y: y ?? 0, z: z ?? 0 };
}

const point = (n: XmlObject | undefined) => vec(n, ['x', 'y', 'z']);
const delta = (n: XmlObject | undefined) => vec(n, ['dx', 'dy', 'dz']);

/** Parse an `n`/`d` ratio node to a number (denominator 0 is rejected). */
function ratio(node: XmlObject | undefined): number | undefined {
	const n = num(node, 'n');
	const d = num(node, 'd');
	if (n === undefined || d === undefined || d === 0) {
		return undefined;
	}
	return n / d;
}

function colour(node: XmlObject | undefined): string | undefined {
	const clr = am(node, 'clr');
	const srgb = child(clr, 'a:srgbClr');
	const val = srgb?.['@_val'];
	if (typeof val === 'string' && /^[0-9a-f]{6}$/iu.test(val)) {
		return `#${val.toLowerCase()}`;
	}
	const scrgb = child(clr, 'a:scrgbClr');
	if (scrgb) {
		const chan = (a: string): string => {
			const pct = Math.min(100000, Math.max(0, num(scrgb, a) ?? 0)) / 100000;
			return Math.round(pct * 255)
				.toString(16)
				.padStart(2, '0');
		};
		return `#${chan('r')}${chan('g')}${chan('b')}`;
	}
	return undefined;
}

function parseCamera(node: XmlObject | undefined): Model3DCamera | undefined {
	if (!node) {
		return undefined;
	}
	const ortho = am(node, 'orthographic');
	const persp = am(node, 'perspective');
	const fov = num(persp, 'fov');
	return {
		position: point(am(node, 'pos')),
		up: delta(am(node, 'up')),
		lookAt: point(am(node, 'lookAt')),
		projection: ortho && !persp ? 'orthographic' : 'perspective',
		...(fov !== undefined ? { fovDeg: fov / ANGLE_UNIT } : {}),
		...(ortho ? { orthoScale: num(ortho, 'sx') ?? num(ortho, 'scale') } : {}),
	};
}

function parseTransform(node: XmlObject | undefined): Model3DTransformData | undefined {
	if (!node) {
		return undefined;
	}
	const scaleNode = am(node, 'scale');
	const rot = am(node, 'rot');
	const sx = ratio(am(scaleNode, 'sx'));
	const sy = ratio(am(scaleNode, 'sy'));
	const sz = ratio(am(scaleNode, 'sz'));
	const angle = (a: string): number => (num(rot, a) ?? 0) / ANGLE_UNIT;
	return {
		meterPerModelUnit: ratio(am(node, 'meterPerModelUnit')),
		preTranslate: delta(am(node, 'preTrans')),
		scale:
			sx === undefined && sy === undefined && sz === undefined
				? undefined
				: { x: sx ?? 1, y: sy ?? 1, z: sz ?? 1 },
		rotationDeg: rot ? { x: angle('ax'), y: angle('ay'), z: angle('az') } : undefined,
		postTranslate: delta(am(node, 'postTrans')),
	};
}

const LIGHT_TAGS: Array<[string, Model3DLightData['kind']]> = [
	['ambientLight', 'ambient'],
	['ptLight', 'point'],
	['spotLight', 'spot'],
	['dirLight', 'directional'],
];

function parseLights(model3d: XmlObject): Model3DLightData[] {
	const lights: Model3DLightData[] = [];
	for (const [tag, kind] of LIGHT_TAGS) {
		for (const node of [...children(model3d, `am3d:${tag}`), ...children(model3d, tag)]) {
			const spot =
				num(am(node, 'spotAngle'), 'angle') ?? num(node, 'angle') ?? num(node, 'spotAngle');
			lights.push({
				kind,
				color: colour(node),
				illuminance: ratio(am(node, 'illuminance')),
				position: point(am(node, 'pos')),
				direction: delta(am(node, 'dir')) ?? delta(am(node, 'up')),
				...(kind === 'spot' && spot !== undefined ? { spotAngleDeg: spot / ANGLE_UNIT } : {}),
			});
		}
	}
	return lights;
}

/**
 * Parse the authored camera, model transform and lights of an
 * `am3d:model3d` node. Returns `undefined` when none of them are present.
 */
export function parseModel3DScene(model3d: XmlObject): Model3DSceneData | undefined {
	const camera = parseCamera(am(model3d, 'camera'));
	const transform = parseTransform(am(model3d, 'trans'));
	const lights = parseLights(model3d);
	const viewportSizeEmu = num(am(model3d, 'objViewport'), 'viewportSz');
	if (!camera && !transform && lights.length === 0) {
		return undefined;
	}
	return { camera, transform, lights, viewportSizeEmu };
}
