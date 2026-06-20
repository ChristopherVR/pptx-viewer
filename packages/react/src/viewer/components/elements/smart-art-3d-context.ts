/**
 * Opt-in flag for the Three.js SmartArt renderer.
 *
 * `PowerPointViewer` provides this from its `smartArt3D` prop; the SmartArt
 * element dispatcher reads it to choose the WebGL renderer over the SVG one.
 * A context avoids threading the flag through `renderBody`'s positional args
 * and every intermediate component.
 */

import { createContext } from 'react';

/** `true` when SmartArt should render via the Three.js scene. */
export const SmartArt3DContext = createContext<boolean>(false);
