/**
 * Opt-in flag for the Three.js interactive bar3D-chart renderer.
 *
 * `PowerPointViewer` provides this from its `barChart3D` prop; the chart
 * element view reads it to choose the WebGL box-mesh scene (camera orbit/zoom
 * via OrbitControls) over the flat SVG oblique-projection illusion for
 * `bar3D` chart kinds. Mirrors {@link ./surface-chart-3d-context.ts}'s
 * `SurfaceChart3DContext`, the established shape for this opt-in pattern.
 *
 * A context avoids threading the flag through `renderBody`'s positional args
 * and every intermediate component.
 */

import { createContext } from 'react';

/** `true` when a bar3D chart should render via the interactive Three.js scene. */
export const BarChart3DContext = createContext<boolean>(false);
