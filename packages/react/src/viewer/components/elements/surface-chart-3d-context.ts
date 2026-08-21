/**
 * Opt-in flag for the Three.js interactive surface-chart renderer.
 *
 * `PowerPointViewer` provides this from its `surfaceChart3D` prop; the chart
 * element view reads it to choose the WebGL scene (camera orbit/zoom via
 * OrbitControls) over the static SVG isometric projection for `surface` /
 * `surface3D` chart kinds. Mirrors {@link ./smart-art-3d-context.ts}'s
 * `SmartArt3DContext`, the established shape for this opt-in pattern.
 *
 * A context avoids threading the flag through `renderBody`'s positional args
 * and every intermediate component.
 */

import { createContext } from 'react';

/** `true` when a surface chart should render via the interactive Three.js scene. */
export const SurfaceChart3DContext = createContext<boolean>(false);
