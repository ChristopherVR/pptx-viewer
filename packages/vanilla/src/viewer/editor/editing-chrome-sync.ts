import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import type { Store, ViewerState } from '../state';
import type { ViewerChrome } from '../ui';
import { canFormatShape } from './editor-format-mutations';

/**
 * Keep the editing chrome (ribbon + property inspector) in sync with the
 * selected element. Extracted from `editor-controller` to keep that file
 * within the size budget; pure aside from the imperative chrome `update`
 * calls.
 */
export interface EditingChromeSyncDeps {
	store: Store<ViewerState>;
	getChrome(): ViewerChrome;
	selectedElement(state: ViewerState): PptxElement | undefined;
}

/** Read the shape fill/stroke for the inspector (undefined when not a shape). */
function shapeStyleOf(el: PptxElement | undefined): {
	fillColor: string | undefined;
	strokeColor: string | undefined;
	strokeWidth: number;
} {
	if (el && hasShapeProperties(el)) {
		return {
			fillColor: el.shapeStyle?.fillColor,
			strokeColor: el.shapeStyle?.strokeColor,
			strokeWidth: el.shapeStyle?.strokeWidth ?? 0,
		};
	}
	return { fillColor: undefined, strokeColor: undefined, strokeWidth: 0 };
}

/** Build the `sync()` function that refreshes the ribbon + inspector. */
export function createEditingChromeSync(deps: EditingChromeSyncDeps): () => void {
	return () => {
		const state = deps.store.get();
		const chrome = deps.getChrome();
		const { ribbon, inspector } = chrome;
		if (!ribbon && !inspector) {
			return;
		}
		const editingVisible = state.editable && !state.presenting;
		ribbon?.setEditable(editingVisible);
		inspector?.setEditable(editingVisible);

		const el = editingVisible ? deps.selectedElement(state) : undefined;
		const shape = shapeStyleOf(el);

		ribbon?.updateSelection(el, {
			hasClipboard: state.clipboardPayload !== null,
			slideCount: state.slides.length,
		});

		inspector?.update({
			hasSelection: el !== undefined,
			canShape: canFormatShape(el),
			x: el?.x ?? 0,
			y: el?.y ?? 0,
			width: el?.width ?? 0,
			height: el?.height ?? 0,
			rotation: el?.rotation ?? 0,
			fillColor: shape.fillColor,
			strokeColor: shape.strokeColor,
			strokeWidth: shape.strokeWidth,
		});
	};
}
