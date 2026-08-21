import { Injectable, signal } from '@angular/core';

/**
 * Opt-in flag for the Three.js interactive surface-chart renderer (Angular).
 *
 * Provided by `PowerPointViewerComponent`, which syncs it from the
 * `surfaceChart3D` input; `ChartElementViewComponent` injects it (optionally)
 * to choose the WebGL scene (camera orbit/zoom via OrbitControls) over the
 * static SVG isometric projection for `surface`/`surface3D` charts. Mirrors
 * `SmartArt3DService`, the established shape for this opt-in pattern.
 */
@Injectable()
export class SurfaceChart3DService {
	/** `true` when a surface chart should render via the Three.js scene. */
	readonly enabled = signal(false);
}
