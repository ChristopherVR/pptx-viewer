import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';

import type { EditorState } from '../../../editor/editor-state.svelte';

/**
 * Recolour the selection from a screen pixel via the browser's EyeDropper.
 *
 * Enabled purely on editability (React's rule) rather than on there being a
 * selection: the picker is worth opening to read a colour before the user has
 * committed to a target, and the patch below is a no-op without one.
 */
export async function pickEyedropperFill(editor: EditorState): Promise<void> {
	const Picker = (
		window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }
	).EyeDropper;
	if (!Picker) {
		return;
	}
	const { sRGBHex } = await new Picker().open();
	const el = editor.selectedElement;
	if (!el || !('shapeStyle' in el)) {
		return;
	}
	editor.patchSelected({
		shapeStyle: { ...el.shapeStyle, fillMode: 'solid', fillColor: sRGBHex } as ShapeStyle,
	} as Partial<PptxElement>);
}
