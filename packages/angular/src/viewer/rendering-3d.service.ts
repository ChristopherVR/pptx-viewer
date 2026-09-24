import { Injectable, signal } from '@angular/core';

import type { Rendering3DFlags } from '../internal/shared';

/** All off: the default outside `PowerPointViewerComponent` (tests, isolated thumbnails). */
export const DEFAULT_RENDERING_3D_FLAGS: Rendering3DFlags = {
	smartArt3D: false,
	surfaceChart3D: false,
	barChart3D: false,
	lineChart3D: false,
	areaChart3D: false,
	pieChart3D: false,
};

/**
 * The host's opt-in 3D rendering flags (`smartArt3D`, `surfaceChart3D`,
 * `barChart3D`, `lineChart3D`, `areaChart3D`, `pieChart3D`), already narrowed
 * by the viewer user's Options > Advanced > "Disable 3D rendering" override
 * (see `resolve3DRenderingFlags`).
 *
 * Provided by `PowerPointViewerComponent`, which syncs it from its six
 * inputs. ONE service replaces the six per-kind ones; every chart / SmartArt
 * element hands the flags to `resolveChartThreeViewSpec` /
 * `resolveSmartArtThreeViewSpec`. Mirrors React's `Rendering3DFlagsContext`.
 */
@Injectable()
export class Rendering3DService {
	readonly flags = signal<Rendering3DFlags>(DEFAULT_RENDERING_3D_FLAGS);
}
