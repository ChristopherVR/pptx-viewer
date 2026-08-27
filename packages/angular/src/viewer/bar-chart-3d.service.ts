import { Injectable, signal } from '@angular/core';

/**
 * Opt-in flag for the Three.js interactive bar3D-chart renderer (Angular).
 *
 * Provided by `PowerPointViewerComponent`, which syncs it from the
 * `barChart3D` input; `ChartElementViewComponent` injects it (optionally)
 * to choose the WebGL box-mesh scene (camera orbit/zoom via OrbitControls)
 * over the flat SVG oblique-projection illusion for `bar3D` charts. Mirrors
 * `SurfaceChart3DService`, the established shape for this opt-in pattern.
 */
@Injectable()
export class BarChart3DService {
	/** `true` when a bar3D chart should render via the Three.js scene. */
	readonly enabled = signal(false);
}
