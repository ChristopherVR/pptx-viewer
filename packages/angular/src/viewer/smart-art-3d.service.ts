import { Injectable, signal } from '@angular/core';

/**
 * Opt-in flag for the Three.js SmartArt renderer (Angular).
 *
 * Provided by `PowerPointViewerComponent`, which syncs it from the `smartArt3D`
 * input; the element dispatcher injects it (optionally) to choose the WebGL
 * renderer over the SVG one. Mirrors the React `SmartArt3DContext` and the Vue
 * `SmartArt3DKey` provide/inject. Scoped to the viewer subtree, so renderers
 * used outside the viewer (thumbnails, export) fall back to `false`.
 */
@Injectable()
export class SmartArt3DService {
	/** `true` when SmartArt should render via the Three.js scene. */
	readonly enabled = signal(false);
}
