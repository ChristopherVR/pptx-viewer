/**
 * Thin re-export shim → vendored `pptx-viewer-shared`
 * (`render/inspector-helpers`).
 *
 * The pure inspector-panel value readers + shapeStyle/textStyle patch builders
 * were extracted to shared and are consumed by every binding. This shim
 * preserves the historical Angular import surface.
 */

export type { ShapeStyleChanges, TextStyleChanges } from '../internal/shared';
export {
	fillColorOf,
	strokeColorOf,
	textColorOf,
	fontSizeOf,
	isBold,
	isItalic,
	isUnderline,
	shapeStylePatch,
	textStylePatch,
} from '../internal/shared';
