/**
 * Vanilla three.js GLTF/GLB model scene controller (framework-agnostic).
 *
 * Mounts an interactive 3D model into a caller-provided container element:
 * dynamically imports `three` plus its `GLTFLoader` and `OrbitControls` addons,
 * builds a scene (perspective camera, lights), auto-centres and fits the model
 * to the view via a `Box3`, renders with a RAF loop, and exposes `resize()` /
 * `dispose()` for deterministic teardown of GPU resources.
 *
 * `three` is an OPTIONAL peer dependency: every import is dynamic and guarded.
 * When `three` is not installed, {@link mountModel3D} resolves to a sentinel
 * handle ({@link THREE_UNAVAILABLE}) so the caller can fall back to a poster.
 * No framework imports - the React, Vue, and Angular bindings can all mount it.
 */

// Type-only imports are erased at build time, so they do not pull `three` into
// the bundle; the actual modules are loaded via dynamic `import()` at runtime.
import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Options for {@link mountModel3D}. */
export interface Model3DSceneOptions {
	/** Initial CSS-pixel width of the view. */
	width: number;
	/** Initial CSS-pixel height of the view. */
	height: number;
	/** Enable OrbitControls (rotate + zoom, no pan). Default `true`. */
	interactive?: boolean;
	/** Solid background colour `#rrggbb`; omit for a transparent canvas. */
	background?: string;
	/** Device pixel-ratio cap. Default `2`. */
	maxPixelRatio?: number;
}

/** Imperative handle to a mounted 3D model view. */
export interface Model3DHandle {
	/** Whether the model mounted (false = `three` missing / load failed). */
	readonly ok: boolean;
	/** Resize the renderer + camera to new CSS-pixel dimensions. */
	resize: (width: number, height: number) => void;
	/** Toggle interactive orbit controls at runtime. */
	setInteractive: (on: boolean) => void;
	/** Tear down the renderer, controls, loaded model, and GPU resources. */
	dispose: () => void;
}

/**
 * Sentinel handle returned when `three` is unavailable or the model fails to
 * load. All methods are no-ops; `ok` is `false` so callers can show a poster.
 */
export const THREE_UNAVAILABLE: Model3DHandle = {
	ok: false,
	resize: () => {},
	setInteractive: () => {},
	dispose: () => {},
};

const FOV = 50;

/** The subset of the `three` module surface this controller uses at runtime. */
type ThreeModule = typeof THREE;

/** Dynamically load `three`; returns `null` when the package is not installed. */
async function loadThree(): Promise<ThreeModule | null> {
	try {
		return (await import('three')) as ThreeModule;
	} catch {
		return null;
	}
}

/** Dynamically load the GLTFLoader addon; returns `null` when unavailable. */
async function loadGltfLoaderCtor(): Promise<(new () => GLTFLoader) | null> {
	try {
		const mod = await import('three/examples/jsm/loaders/GLTFLoader.js');
		return mod.GLTFLoader;
	} catch {
		return null;
	}
}

/** Dynamically load the OrbitControls addon; returns `null` when unavailable. */
async function loadOrbitControlsCtor(): Promise<
	(new (camera: THREE.Camera, dom: HTMLElement) => OrbitControls) | null
> {
	try {
		const mod = await import('three/examples/jsm/controls/OrbitControls.js');
		return mod.OrbitControls;
	} catch {
		return null;
	}
}

/** Promisified `GLTFLoader.load`. */
function loadGltf(loader: GLTFLoader, url: string): Promise<GLTF> {
	return new Promise((resolve, reject) => {
		loader.load(url, resolve, undefined, reject);
	});
}

/**
 * Auto-centre the model at the origin and uniformly scale it so its largest
 * dimension fills a 2-unit cube, mirroring the previous react-three-fiber fit.
 */
function centerAndFit(three: ThreeModule, root: THREE.Object3D): void {
	const box = new three.Box3().setFromObject(root);
	const size = new three.Vector3();
	box.getSize(size);
	const maxDim = Math.max(size.x, size.y, size.z);
	if (maxDim > 0) {
		root.scale.setScalar(2 / maxDim);
	}
	const center = new three.Vector3();
	box.getCenter(center);
	root.position.sub(center.multiplyScalar(root.scale.x));
}

/**
 * Mount an interactive GLTF/GLB model into `container` and start rendering.
 *
 * Resolves to {@link THREE_UNAVAILABLE} (a no-op handle with `ok === false`)
 * when `three` or its addons cannot be loaded, or when the model fails to parse.
 */
export async function mountModel3D(
	container: HTMLElement,
	modelUrl: string,
	options: Model3DSceneOptions,
): Promise<Model3DHandle> {
	const three = await loadThree();
	const GltfLoaderCtor = three ? await loadGltfLoaderCtor() : null;
	if (!three || !GltfLoaderCtor) {
		return THREE_UNAVAILABLE;
	}

	const width = Math.max(1, options.width);
	const height = Math.max(1, options.height);

	const renderer = new three.WebGLRenderer({ antialias: true, alpha: !options.background });
	renderer.setPixelRatio(
		Math.min(
			typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
			options.maxPixelRatio ?? 2,
		),
	);
	renderer.setSize(width, height, false);
	const canvas = renderer.domElement;
	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;
	canvas.style.display = 'block';
	canvas.style.willChange = 'transform';
	container.appendChild(canvas);

	const scene = new three.Scene();
	if (options.background) {
		scene.background = new three.Color(options.background);
	}

	const camera = new three.PerspectiveCamera(FOV, width / height, 0.1, 1000);
	camera.position.set(0, 0, 5);
	camera.lookAt(0, 0, 0);

	scene.add(new three.AmbientLight(0xffffff, 0.5));
	const key = new three.DirectionalLight(0xffffff, 1);
	key.position.set(5, 5, 5);
	scene.add(key);
	const fill = new three.DirectionalLight(0xffffff, 0.3);
	fill.position.set(-3, -3, 2);
	scene.add(fill);

	let gltf: GLTF;
	try {
		gltf = await loadGltf(new GltfLoaderCtor(), modelUrl);
	} catch {
		renderer.dispose();
		canvas.remove();
		return THREE_UNAVAILABLE;
	}

	const model = gltf.scene;
	centerAndFit(three, model);
	scene.add(model);

	let controls: OrbitControls | null = null;
	const OrbitCtrlCtor = await loadOrbitControlsCtor();
	const enableControls = (on: boolean): void => {
		if (on && !controls && OrbitCtrlCtor) {
			controls = new OrbitCtrlCtor(camera, canvas);
			controls.enablePan = false;
			controls.enableZoom = true;
			controls.enableRotate = true;
			controls.minDistance = 2;
			controls.maxDistance = 20;
			controls.update();
		} else if (!on && controls) {
			controls.dispose();
			controls = null;
		}
	};
	enableControls(options.interactive ?? true);

	let frame = 0;
	let disposed = false;
	const renderLoop = (): void => {
		if (disposed) {
			return;
		}
		frame = requestAnimationFrame(renderLoop);
		controls?.update();
		renderer.render(scene, camera);
	};
	frame = requestAnimationFrame(renderLoop);

	/** Recursively dispose every geometry/material/texture under the model. */
	const disposeModel = (): void => {
		model.traverse((obj: THREE.Object3D) => {
			const mesh = obj as Partial<THREE.Mesh>;
			mesh.geometry?.dispose();
			const material = mesh.material;
			if (Array.isArray(material)) {
				for (const m of material) {
					m.dispose();
				}
			} else {
				material?.dispose();
			}
		});
	};

	return {
		ok: true,
		resize(w: number, h: number) {
			const nextW = Math.max(1, w);
			const nextH = Math.max(1, h);
			camera.aspect = nextW / nextH;
			camera.updateProjectionMatrix();
			renderer.setSize(nextW, nextH, false);
			canvas.style.width = `${nextW}px`;
			canvas.style.height = `${nextH}px`;
		},
		setInteractive(on: boolean) {
			enableControls(on);
		},
		dispose() {
			if (disposed) {
				return;
			}
			disposed = true;
			cancelAnimationFrame(frame);
			controls?.dispose();
			disposeModel();
			scene.clear();
			renderer.dispose();
			canvas.remove();
		},
	};
}
