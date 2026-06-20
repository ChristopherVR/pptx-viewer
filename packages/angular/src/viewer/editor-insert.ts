/**
 * Thin re-export shim -> vendored `pptx-viewer-shared`.
 *
 * The pure element-factory functions were extracted to `pptx-viewer-shared`
 * (`render/editor-insert`) and are consumed by every binding. This shim
 * preserves the historical Angular import surface so `editor-toolbar.component`,
 * `power-point-viewer.component`, `ribbon.component`, the colocated tests, and
 * any future importers are unchanged.
 */

export {
	newTextElement,
	newShapeElement,
	newTableElement,
	newSmartArtElement,
	newEquationElement,
} from '../internal/shared';
