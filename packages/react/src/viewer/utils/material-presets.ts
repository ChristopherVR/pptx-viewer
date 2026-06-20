/**
 * CSS approximation of OOXML 3D material presets: React shim.
 *
 * The material map + `getMaterialCssOverrides` now live in the framework-neutral
 * `pptx-viewer-shared` (`render/visual-3d-materials`) so React, Vue, and Angular
 * share one source of truth. This module re-exports that surface and re-types
 * the override object's `mixBlendMode` to React's `CSSProperties` union (the
 * only framework-coupled part).
 *
 * @module material-presets
 */

import { getMaterialCssOverrides } from 'pptx-viewer-shared';
import type { MaterialCssOverrides as SharedMaterialCssOverrides } from 'pptx-viewer-shared';
import type React from 'react';

/** React-typed view of {@link SharedMaterialCssOverrides} (`mixBlendMode` narrowed). */
export interface MaterialCssOverrides extends Omit<SharedMaterialCssOverrides, 'mixBlendMode'> {
	/** Blend mode for fill overlay. */
	mixBlendMode?: React.CSSProperties['mixBlendMode'];
}

export { getMaterialCssOverrides };
