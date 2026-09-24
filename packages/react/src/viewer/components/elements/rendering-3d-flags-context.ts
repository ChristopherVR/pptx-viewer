/**
 * The host's opt-in 3D rendering flags (`smartArt3D`, `surfaceChart3D`,
 * `barChart3D`, `lineChart3D`, `areaChart3D`, `pieChart3D`), already narrowed
 * by the viewer user's own Options > Advanced > "Disable 3D rendering"
 * override (see `resolve3DRenderingFlags`).
 *
 * `PowerPointViewer` provides the resolved flags from its six props; every
 * chart/SmartArt element reads this ONE context (replacing the six per-kind
 * contexts the per-kind 3D wrappers used) and passes it straight through to
 * `resolveChartThreeViewSpec`/`resolveSmartArtThreeViewSpec`, which decide
 * per element whether a `<pptx-three-view>` spec applies.
 *
 * A context avoids threading the flags through `renderBody`'s positional
 * args and every intermediate component.
 */
import type { Rendering3DFlags } from 'pptx-viewer-shared';
import { createContext } from 'react';

/** All off: the safe default for anything rendered outside `PowerPointViewer` (tests, thumbnails in isolation). */
export const DEFAULT_RENDERING_3D_FLAGS: Rendering3DFlags = {
	smartArt3D: false,
	surfaceChart3D: false,
	barChart3D: false,
	lineChart3D: false,
	areaChart3D: false,
	pieChart3D: false,
};

export const Rendering3DFlagsContext = createContext<Rendering3DFlags>(DEFAULT_RENDERING_3D_FLAGS);
