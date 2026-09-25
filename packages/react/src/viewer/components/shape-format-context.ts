/**
 * Shape Format commands that several surfaces share: the Merge Shapes
 * operations and the picture crop controller.
 *
 * The ribbon (desktop and mobile sheet), the canvas context menu and the slide
 * canvas's crop overlay all need the same live controller, and they sit in
 * three different subtrees. Threading it through every intermediate props
 * interface would touch half a dozen already oversized components, so the
 * viewer provides it once here instead. Absent a provider (a surface rendered
 * standalone, as in unit tests) every consumer treats the commands as
 * unavailable.
 */
import type { MergeShapeOperation } from 'pptx-viewer-core';
import { createContext, useContext } from 'react';

import type { PictureCropController } from '../hooks/usePictureCropMode';

export interface ShapeFormatCommands {
	/** Two or more mergeable shapes are selected on an editable deck. */
	canMergeShapes: boolean;
	mergeShapes: (operation: MergeShapeOperation) => void;
	crop: PictureCropController;
}

export const ShapeFormatContext = createContext<ShapeFormatCommands | null>(null);

export function useShapeFormatContext(): ShapeFormatCommands | null {
	return useContext(ShapeFormatContext);
}
