/**
 * `three-view` contract: what a three.js scene module must provide to be
 * hosted by the shared `<pptx-three-view>` custom element.
 *
 * The element (see `element.ts`) owns everything every binding used to
 * duplicate five times over: lazily loading `three`, sizing, a DOM overlay
 * layer, visibility, disposal, and the SVG fallback. The shared renderer host
 * (see `renderer-host.ts`) owns the ONE WebGL context every view draws with,
 * so a deck with dozens of 3D charts/SmartArt graphics (slide + thumbnails)
 * never exhausts the browser's context limit.
 *
 * A scene module only builds meshes and a camera. It never creates a
 * `WebGLRenderer`, never calls `renderer.setSize`/`setViewport`, and never runs
 * its own `requestAnimationFrame` loop: it calls `ctx.requestRender()` when
 * something visible changed, and draws in {@link ThreeViewScene.render}.
 *
 * Type-only `three` imports here; scene modules receive the runtime module as
 * `ctx.three` so nothing in `pptx-viewer-shared` imports `three` statically.
 *
 * @module three-view/types
 */
import type * as THREE from 'three';

import type { TextStyleAnimationDescriptor } from '../render/animation-text-style-resolve';
import type { ChartPartRef } from '../render/chart-view-model';

/** The runtime `three` module handed to a scene. */
export type ThreeModule = typeof THREE;

/** A view's size: CSS pixels of the element's own (untransformed) box, plus the device-pixel backing size. */
export interface ThreeViewSize {
	/** Layout width in CSS px (the element's own box, before any ancestor CSS transform). */
	width: number;
	/** Layout height in CSS px. */
	height: number;
	/** Backing-store width in device pixels (accounts for ancestor zoom and devicePixelRatio). */
	pixelWidth: number;
	/** Backing-store height in device pixels. */
	pixelHeight: number;
}

/**
 * How far a scene draws past each edge of the element box, as fractions of
 * the box's width (`left`/`right`) or height (`top`/`bottom`). See
 * `view-overflow.ts`.
 */
export interface ThreeViewOverflow {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

/** A value drag on a chart mark, in progress (`move`) or finished (`commit`). */
export interface ThreeViewDragDetail {
	part: ChartPartRef;
	value: number;
	phase: 'move' | 'commit';
}

/** Events a scene can raise; the element re-dispatches them as DOM `CustomEvent`s. */
export type ThreeViewSceneEvent =
	| { type: 'select'; part: ChartPartRef | null }
	| { type: 'drag'; detail: ThreeViewDragDetail };

/** What the element gives a scene when mounting it. */
export interface ThreeViewContext {
	three: ThreeModule;
	/**
	 * OrbitControls constructor. The view controller always passes `null`: a
	 * hosted scene never orbits, because the pointer that lands on the view is
	 * also the one dragging the element across the slide.
	 */
	OrbitControls: (new (camera: THREE.Camera, dom: HTMLElement) => ThreeOrbitControls) | null;
	size: ThreeViewSize;
	/** The element pointer input lands on (attach raycast listeners here). */
	eventTarget: HTMLElement;
	/** Absolutely positioned layer above the canvas, same box, for HTML/SVG chrome (titles, labels, tooltips). */
	overlay: HTMLElement;
	/** The document the view lives in (use it to create overlay nodes). */
	document: Document;
	/** Whether pointer interaction (select, drag) is enabled at mount. */
	interactive: boolean;
	/** Schedule a redraw of this view on the next frame. Cheap; coalesced. */
	requestRender: () => void;
	/** Raise a select/drag event to the host element. */
	emit: (event: ThreeViewSceneEvent) => void;
}

/** The minimal OrbitControls surface scenes use (kept structural so tests can fake it). */
export interface ThreeOrbitControls {
	enabled: boolean;
	enablePan: boolean;
	enableZoom: boolean;
	enableRotate: boolean;
	enableDamping: boolean;
	target: THREE.Vector3;
	update: () => boolean;
	addEventListener: (type: 'change', listener: () => void) => void;
	removeEventListener: (type: 'change', listener: () => void) => void;
	dispose: () => void;
}

/** A mounted scene, driven by the element and the renderer host. */
export interface ThreeViewScene {
	/**
	 * Draw one frame. The host has already bound the view's viewport and
	 * scissor and cleared colour + depth; the scene may issue several passes
	 * (calling `renderer.clearDepth()` between them) but must not resize the
	 * renderer or change its viewport.
	 */
	render: (renderer: THREE.WebGLRenderer) => void;
	/** The view's size changed; update camera aspect / overlay layout. */
	resize: (size: ThreeViewSize) => void;
	/**
	 * How far the scene draws past the element box (see `view-overflow.ts`).
	 * A scene that implements it must frame its camera for the grown buffer
	 * (`overflowViewOffset`) whenever it reports a non-zero overflow; it is
	 * read after mount and after every {@link resize}. Omitted: no overflow.
	 */
	overflow?: () => ThreeViewOverflow;
	/** `true` while the scene needs continuous frames (damping, auto-rotate, a tween). */
	isAnimating?: () => boolean;
	setInteractive?: (on: boolean) => void;
	/** Mirror an externally chosen chart part (e.g. picked in the inspector) onto the scene. */
	setSelectedPart?: (part: ChartPartRef | null) => void;
	/** Apply (or clear) a font-style emphasis override on the scene's text. */
	setTextStyle?: (style: TextStyleAnimationDescriptor | undefined) => void;
	dispose: () => void;
}

/** A scene module's mount function. */
export type ThreeViewSceneFactory<Spec> = (
	spec: Spec,
	ctx: ThreeViewContext,
) => ThreeViewScene | Promise<ThreeViewScene>;

/** Everything `<pptx-three-view>` can show; `kind` picks the lazily-loaded scene module. */
export type ThreeViewSpec =
	| { kind: 'chart'; spec: import('../render/chart-3d-spec').Chart3DSpec }
	| { kind: 'smartart'; spec: import('../render/smartart-3d-types').SmartArt3DModel };

/** Lifecycle state the element reflects on its `data-state` attribute. */
export type ThreeViewState = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
