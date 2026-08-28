/**
 * Vanilla three.js 3D pie-chart scene controller (framework-agnostic).
 *
 * Mounts an interactive `pie3D` chart into a caller-provided container
 * element: dynamically imports `three` plus its `OrbitControls` addon, builds
 * one real `THREE.CylinderGeometry` wedge mesh per data point (a partial-arc
 * cylinder, so each wedge gets a flat top/bottom face, the two curved rim
 * faces, and the two flat radial "cut" faces for free), lights, a perspective
 * camera driven by `c:view3D` (`rotX`/`rotY`/`rperspective`/`hPercent`),
 * OrbitControls, and a RAF loop. Raycasts pointer moves against the wedges to
 * set a native hover tooltip on the canvas element (see
 * {@link ./pie-chart-3d-hit-test.ts}), matching every other chart kind's
 * SVG-`<title>` hover tooltip. Exposes `dispose()` for deterministic teardown.
 *
 * Unlike the cartesian 3D scenes (bar3D/line3D/area3D), a pie has no plot
 * rectangle to wall in, so this module mounts no grid floor or
 * `c:floor`/`c:sideWall`/`c:backWall` panels, matching PowerPoint's own
 * behaviour and the flat SVG engine's `chart-3d-surfaces.ts` doc comment.
 *
 * Mirrors {@link ./bar-chart-3d-scene.ts} (`mountBarChart3D`), the
 * established shape for this "optional three.js scene with a 2D SVG safety
 * net" pattern: `three` is an OPTIONAL peer dependency, every import is
 * dynamic and guarded, and a missing dependency resolves to a no-op sentinel
 * handle so the caller falls back to the flat 2D renderer.
 *
 * @module pie-chart-3d-scene
 */

import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import type { PieChart3DSceneOptions } from './pie-chart-3d-data';
import { computePieChart3DCameraPlacement } from './pie-chart-3d-geom';
import { buildPieChart3DHoverTooltip } from './pie-chart-3d-hit-test';
import type { PieChart3DHit } from './pie-chart-3d-hit-test';

type ThreeModule = typeof THREE;

/** Imperative handle to a mounted pie3D chart view. */
export interface PieChart3DHandle {
	readonly ok: boolean;
	resize: (width: number, height: number) => void;
	dispose: () => void;
}

/** No-op sentinel returned when `three` or its OrbitControls addon is missing. */
export const PIE_CHART_THREE_UNAVAILABLE: PieChart3DHandle = {
	ok: false,
	resize: () => {},
	dispose: () => {},
};

async function loadThree(): Promise<ThreeModule | null> {
	try {
		return (await import('three')) as ThreeModule;
	} catch {
		return null;
	}
}

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

/** Minimum radial segments per wedge so a thin slice is still visibly curved. */
const MIN_RADIAL_SEGMENTS = 3;
/** Radial segments for a full-circle wedge (360deg); scaled down for narrower slices. */
const FULL_CIRCLE_SEGMENTS = 64;

/**
 * Mount an interactive 3D pie chart into `container` and start rendering.
 *
 * Resolves to {@link PIE_CHART_THREE_UNAVAILABLE} when `three` or its
 * OrbitControls addon cannot be loaded, so the caller can fall back to the
 * flat SVG oblique-projection pie3D renderer.
 */
export async function mountPieChart3D(
	container: HTMLElement,
	options: PieChart3DSceneOptions,
): Promise<PieChart3DHandle> {
	const three = await loadThree();
	const OrbitCtrlCtor = three ? await loadOrbitControlsCtor() : null;
	if (!three || !OrbitCtrlCtor) {
		return PIE_CHART_THREE_UNAVAILABLE;
	}

	let width = Math.max(1, options.width);
	let height = Math.max(1, options.height);

	const renderer = new three.WebGLRenderer({ antialias: true, alpha: true });
	renderer.setPixelRatio(
		Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, 2),
	);
	renderer.setSize(width, height, false);
	const canvas = renderer.domElement;
	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;
	canvas.style.display = 'block';
	canvas.style.willChange = 'transform';
	container.appendChild(canvas);

	const scene = new three.Scene();
	scene.add(new three.AmbientLight(0xffffff, 0.65));
	const key = new three.DirectionalLight(0xffffff, 0.8);
	key.position.set(5, 8, 5);
	scene.add(key);
	const fill = new three.DirectionalLight(0xffffff, 0.3);
	fill.position.set(-3, 4, -2);
	scene.add(fill);

	const placement = computePieChart3DCameraPlacement(options.view3D);
	const camera = new three.PerspectiveCamera(placement.fov, width / height, 0.1, 1000);
	camera.position.set(...placement.position);
	const target = new three.Vector3(...placement.target);
	camera.lookAt(target);

	// One CylinderGeometry mesh per wedge: radiusTop = radiusBottom = outerRadius,
	// height = thickness, capped (openEnded=false) so a partial thetaLength gets
	// real flat top/bottom + curved rim + flat radial "cut" faces for free.
	const wedgeMeshes: THREE.Mesh[] = [];
	const wedgeGeometries: THREE.BufferGeometry[] = [];
	const wedgeMaterials: THREE.Material[] = [];
	for (const wedge of options.wedges) {
		const segments = Math.max(
			MIN_RADIAL_SEGMENTS,
			Math.round((wedge.thetaLength / (Math.PI * 2)) * FULL_CIRCLE_SEGMENTS),
		);
		const geometry = new three.CylinderGeometry(
			options.outerRadius,
			options.outerRadius,
			options.thickness,
			segments,
			1,
			false,
			wedge.startAngle,
			wedge.thetaLength,
		);
		const material = new three.MeshPhongMaterial({ color: wedge.color, shininess: 30 });
		const mesh = new three.Mesh(geometry, material);
		mesh.position.set(wedge.explodeOffset[0], 0, wedge.explodeOffset[1]);
		mesh.userData = { pointIndex: wedge.pointIndex, value: wedge.value } satisfies PieChart3DHit;
		scene.add(mesh);
		wedgeMeshes.push(mesh);
		wedgeGeometries.push(geometry);
		wedgeMaterials.push(material);
	}

	// Raycast-based hover tooltip: each wedge mesh carries its own point index
	// in `userData`, so a hit reports the slice directly (no face-index -> cell
	// arithmetic, matching bar3D's box meshes).
	const raycaster = new three.Raycaster();
	const pointerNdc = new three.Vector2();
	let hoveredTooltip: string | undefined;

	const updateHoverTooltip = (clientX: number, clientY: number): void => {
		const rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			return;
		}
		pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
		pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
		raycaster.setFromCamera(pointerNdc, camera);
		const hits = raycaster.intersectObjects(wedgeMeshes, false);
		const hit = hits[0]?.object.userData as PieChart3DHit | undefined;
		const tooltip = buildPieChart3DHoverTooltip(hit, {
			categoryLabels: options.categoryLabels,
			seriesName: options.seriesName,
			numberFormat: options.numberFormat,
		});
		if (tooltip !== hoveredTooltip) {
			hoveredTooltip = tooltip;
			canvas.title = tooltip ?? '';
		}
	};
	const onPointerMove = (event: PointerEvent): void => {
		updateHoverTooltip(event.clientX, event.clientY);
	};
	const onPointerLeave = (): void => {
		if (hoveredTooltip !== undefined) {
			hoveredTooltip = undefined;
			canvas.title = '';
		}
	};
	canvas.addEventListener('pointermove', onPointerMove);
	canvas.addEventListener('pointerleave', onPointerLeave);

	const controls = new OrbitCtrlCtor(camera, canvas);
	controls.enablePan = true;
	controls.enableZoom = true;
	controls.enableRotate = true;
	controls.minDistance = 0.5;
	controls.maxDistance = 30;
	controls.maxPolarAngle = Math.PI / 2 + 0.3;
	controls.target.copy(target);
	controls.update();

	let frame = 0;
	let disposed = false;
	const renderLoop = (): void => {
		if (disposed) {
			return;
		}
		frame = requestAnimationFrame(renderLoop);
		controls.update();
		renderer.render(scene, camera);
	};
	frame = requestAnimationFrame(renderLoop);

	return {
		ok: true,
		resize(w: number, h: number) {
			width = Math.max(1, w);
			height = Math.max(1, h);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.setSize(width, height, false);
			canvas.style.width = `${width}px`;
			canvas.style.height = `${height}px`;
		},
		dispose() {
			if (disposed) {
				return;
			}
			disposed = true;
			cancelAnimationFrame(frame);
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('pointerleave', onPointerLeave);
			controls.dispose();
			for (const g of wedgeGeometries) {
				g.dispose();
			}
			for (const m of wedgeMaterials) {
				m.dispose();
			}
			scene.clear();
			renderer.dispose();
			canvas.remove();
		},
	};
}
