/**
 * Opt-in flag for the Three.js interactive pie3D-chart renderer.
 *
 * `PowerPointViewer` provides this from its `pieChart3D` prop; the chart
 * element view reads it to choose the WebGL wedge-mesh scene (camera
 * orbit/zoom via OrbitControls) over the flat SVG oblique-projection illusion
 * for `pie3D` chart kinds. Mirrors {@link ./bar-chart-3d-context.ts}'s
 * `BarChart3DContext`, the established shape for this opt-in pattern.
 *
 * A context avoids threading the flag through `renderBody`'s positional args
 * and every intermediate component.
 */

import { createContext } from 'react';

/** `true` when a pie3D chart should render via the interactive Three.js scene. */
export const PieChart3DContext = createContext<boolean>(false);
