/**
 * `three-view`: the shared host for every three.js scene (3D charts, 3D
 * SmartArt). See `element.ts` for the `<pptx-three-view>` element bindings
 * render, `renderer-host.ts` for the single shared WebGL context, and
 * `types.ts` for the scene-module contract.
 *
 * Nothing reachable from here imports `three` at runtime: scenes receive the
 * module through their mount context, so the main barrel stays free of the
 * optional peer.
 *
 * @module three-view
 */
export { defineThreeViewElement, THREE_VIEW_MARKER_ATTR, THREE_VIEW_TAG } from './element';
export {
	chartThreeViewSpec,
	isChart3DViewEnabled,
	resolveChartThreeViewSpec,
	resolveSmartArtThreeViewSpec,
	smartArtThreeViewSpec,
} from './view-spec';
export type { Chart3DFlags } from './view-spec';
export {
	applyChart3DDrag,
	applyChart3DSelect,
	handleThreeViewChartEvent,
	THREE_VIEW_EVENTS,
	threeViewStateOf,
} from './chart-events';
export type {
	Chart3DSelectionBridge,
	ThreeViewSelectDetail,
	ThreeViewStateDetail,
} from './chart-events';
export {
	settleThreeViews,
	snapshotThreeViewsIntoClone,
	THREE_VIEW_SETTLE_TIMEOUT_MS,
	THREE_VIEW_SNAPSHOT_ATTR,
} from './export-snapshot';
export type { PptxThreeViewElement } from './element';
export { computeThreeViewSize, MAX_DEVICE_PIXEL_RATIO } from './view-size';
export { MAX_VIEW_PIXELS } from './renderer-host';
export type {
	ThreeModule,
	ThreeOrbitControls,
	ThreeViewContext,
	ThreeViewDragDetail,
	ThreeViewScene,
	ThreeViewSceneEvent,
	ThreeViewSceneFactory,
	ThreeViewSize,
	ThreeViewSpec,
	ThreeViewState,
} from './types';
