import type { ChartPptxElement } from 'pptx-viewer-core';
/**
 * `<pptx-three-view>` scene module for 3D charts.
 *
 * The oblique-projection family (`c:view3D/@rAngAx=1`, `bar3D`'s own
 * default; verified against `gt/chart-01.webp`) is drawn here. Everything
 * else (line3D/area3D/pie3D/surface3D, and bar3D's `standard` grouping, a
 * horizontal `c:barDir val="bar"` or round shapes) has `geometry: null` and
 * mounts the matching perspective scene from `spec.perspective` (the
 * pre-`<pptx-three-view>` scenes, hosted on the shared renderer). Those are
 * not yet at PowerPoint parity; see `demos/demo-three-parity/README.md`.
 *
 * The oblique projection is built as a plain `OrthographicCamera` (1 world
 * unit = 1 authored chart px, matching `chart-3d-chrome-overlay.ts`'s
 * overlay `<svg>` viewBox exactly) with a SHEAR term hand-inserted into its
 * projection matrix, rather than tilting the camera or shearing the scene
 * graph: this keeps a future `OrbitControls` well-defined, since only the camera moves, and keeps every box's world
 * position/size meaningful on its own instead of encoding the illusion into
 * mesh transforms.
 *
 * @module chart-3d-view-scene
 */
import type * as THREE from 'three';

import type { ThreeViewContext, ThreeViewScene } from '../three-view/types';
import { createAreaChart3DScene } from './area-chart-3d-scene';
import { createBarChart3DScene } from './bar-chart-3d-scene';
import { buildChart3DBarMeshes } from './chart-3d-bar-mesh';
import { renderChart3DChromeOverlaySvg } from './chart-3d-chrome-overlay';
import { attachObliqueBarInteraction } from './chart-3d-oblique-interaction';
import { mountPerspChartView } from './chart-3d-persp-scene';
import type { Chart3DPerspectiveScene, Chart3DSpec } from './chart-3d-spec';
import { createLineChart3DScene } from './line-chart-3d-scene';
import { createPieChart3DScene } from './pie-chart-3d-scene';
import { createSurfaceChart3DScene } from './surface-chart-3d-scene';

/**
 * The oblique chart camera. Camera distance is chosen so `NEAR`/`FAR` stay
 * tight around the scene's own (tiny) depth extent. Exported for tests.
 */
export function buildObliqueCamera(
	three: ThreeModule,
	svgWidth: number,
	svgHeight: number,
	shearX: number,
	shearY: number,
): THREE.OrthographicCamera {
	const halfW = svgWidth / 2;
	const halfH = svgHeight / 2;
	const distance = halfW + halfH + 500;
	const camera = new three.OrthographicCamera(-halfW, halfW, halfH, -halfH, 1, distance + 2000);
	camera.position.set(0, 0, distance);
	camera.lookAt(0, 0, 0);
	camera.updateProjectionMatrix();

	// Hand-insert the oblique shear: clip_x += kX * ndcScaleX * world_z,
	// clip_y += kY * ndcScaleY * world_z (see the module doc + the chart
	// track's progress log for the sign derivation between the flat 2D
	// fallback's SVG-Y-down depth vector and this scene's world-Y-up frame:
	// X needs no flip (kX = -shearX), Y does (kY = +shearY)).
	const m = camera.projectionMatrix.elements;
	const ndcScaleX = m[0];
	const ndcScaleY = m[5];
	m[8] = -shearX * ndcScaleX;
	m[9] = shearY * ndcScaleY;
	// The shear multiplies VIEW-space z, which is `-distance` at the chart's
	// front plane (world z = 0). Offset it so the front plane is unsheared
	// and lands exactly on the 2D layout; only depth behind it shifts.
	m[12] += m[8] * distance;
	m[13] += m[9] * distance;
	camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
	return camera;
}

type ThreeModule = typeof THREE;

/** The hosted perspective scene for a spec whose oblique geometry is `null`. */
function mountPerspectiveScene(
	perspective: Chart3DPerspectiveScene,
	ctx: ThreeViewContext,
): ThreeViewScene {
	switch (perspective.kind) {
		case 'bar':
			return createBarChart3DScene(ctx, perspective.options);
		case 'line':
			return createLineChart3DScene(ctx, perspective.options);
		case 'area':
			return createAreaChart3DScene(ctx, perspective.options);
		case 'pie':
			return createPieChart3DScene(ctx, perspective.options);
		case 'surface':
			return createSurfaceChart3DScene(ctx, perspective.options);
		default: {
			const exhaustive: never = perspective;
			return exhaustive;
		}
	}
}

export async function mountChart3DView(
	spec: Chart3DSpec,
	ctx: ThreeViewContext,
): Promise<ThreeViewScene> {
	if (spec.geometry?.kind === 'perspective') {
		const chartData = (spec.element as ChartPptxElement).chartData;
		if (!chartData) {
			throw new Error('3D chart spec without chart data');
		}
		return mountPerspChartView(
			{ vm: spec.vm, layout: spec.geometry.layout, chartData, categoryLabels: spec.categoryLabels },
			ctx,
		);
	}
	if (spec.projection.mode !== 'oblique' || spec.geometry?.kind !== 'oblique') {
		if (spec.perspective) {
			return mountPerspectiveScene(spec.perspective, ctx);
		}
		throw new Error(`no 3D chart scene for chartType=${spec.chartType}`);
	}
	const three = ctx.three;
	const { vm, geometry } = spec;
	const chartData = (spec.element as ChartPptxElement).chartData;
	if (!chartData) {
		throw new Error('3D chart spec without chart data');
	}

	const camera = buildObliqueCamera(
		three,
		vm.svgWidth,
		vm.svgHeight,
		spec.projection.shearX,
		spec.projection.shearY,
	);

	const scene = new three.Scene();
	const { layout } = geometry;
	const bars = buildChart3DBarMeshes(three, layout, vm.svgWidth, vm.svgHeight);
	scene.add(bars.group);

	const overlay = renderChart3DChromeOverlaySvg(ctx.document, vm, {
		labels: layout.labels,
		// PowerPoint lists a clustered horizontal bar chart's legend bottom-up,
		// matching the order the series stack up the category axis.
		reverseLegend: layout.horizontal && layout.grouping === 'clustered',
	});
	ctx.overlay.appendChild(overlay);

	const interaction = attachObliqueBarInteraction({
		ctx,
		camera,
		meshes: bars.meshes,
		layout,
		svgWidth: vm.svgWidth,
		svgHeight: vm.svgHeight,
		chartData,
		categoryLabels: spec.categoryLabels,
		seriesNames: chartData.series.map((series) => series.name),
		scene,
	});

	let disposed = false;
	return {
		render(renderer: THREE.WebGLRenderer) {
			renderer.render(scene, camera);
		},
		resize() {
			// The orthographic frustum is fixed in authored chart-px units
			// (svgWidth/svgHeight), independent of the element's on-screen CSS
			// size, so nothing needs recomputing here.
		},
		isAnimating: () => false,
		setInteractive: (on) => interaction.setInteractive(on),
		setSelectedPart: (part) => interaction.setSelectedPart(part),
		dispose() {
			if (disposed) {
				return;
			}
			disposed = true;
			interaction.dispose();
			bars.dispose();
			overlay.remove();
		},
	};
}
