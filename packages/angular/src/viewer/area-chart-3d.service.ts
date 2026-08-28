import { Injectable, signal } from '@angular/core';

/**
 * Opt-in flag for the Three.js interactive area3D-chart renderer (Angular).
 *
 * Provided by `PowerPointViewerComponent`, which syncs it from the
 * `areaChart3D` input; `ChartElementViewComponent` injects it (optionally)
 * to choose the WebGL ribbon scene (camera orbit/zoom via OrbitControls)
 * over the flat SVG oblique-projection illusion for `area3D` charts. Mirrors
 * `BarChart3DService`, the established shape for this opt-in pattern.
 */
@Injectable()
export class AreaChart3DService {
	/** `true` when an area3D chart should render via the Three.js scene. */
	readonly enabled = signal(false);
}
