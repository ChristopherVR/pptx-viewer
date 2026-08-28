import { Injectable, signal } from '@angular/core';

/**
 * Opt-in flag for the Three.js interactive line3D-chart renderer (Angular).
 *
 * Provided by `PowerPointViewerComponent`, which syncs it from the
 * `lineChart3D` input; `ChartElementViewComponent` injects it (optionally)
 * to choose the WebGL tube-path scene (camera orbit/zoom via OrbitControls)
 * over the flat SVG oblique-projection illusion for `line3D` charts. Mirrors
 * `BarChart3DService`, the established shape for this opt-in pattern.
 */
@Injectable()
export class LineChart3DService {
	/** `true` when a line3D chart should render via the Three.js scene. */
	readonly enabled = signal(false);
}
