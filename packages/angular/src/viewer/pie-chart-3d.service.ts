import { Injectable, signal } from '@angular/core';

/**
 * Opt-in flag for the Three.js interactive pie3D-chart renderer (Angular).
 *
 * Provided by `PowerPointViewerComponent`, which syncs it from the
 * `pieChart3D` input; `ChartElementViewComponent` injects it (optionally)
 * to choose the WebGL wedge-mesh scene (camera orbit/zoom via OrbitControls)
 * over the flat SVG oblique-projection illusion for `pie3D` charts. Mirrors
 * `BarChart3DService`, the established shape for this opt-in pattern.
 */
@Injectable()
export class PieChart3DService {
	/** `true` when a pie3D chart should render via the Three.js scene. */
	readonly enabled = signal(false);
}
