/**
 * The slide layouts the Home tab's "New Slide" split button can insert from.
 *
 * A deck's layouts hang off its masters, one list per master, and a layout's
 * `name` is optional in OOXML. This flattens both facts away so the ribbon can
 * render a single menu without knowing about masters: one entry per layout, in
 * document order, always with something to display.
 *
 * Pure on purpose: the picker's behaviour is worth testing without a TestBed.
 */
import type { PptxSlideMaster } from 'pptx-viewer-core';

/** One entry in the New Slide layout menu. */
export interface RibbonLayoutOption {
	/** Package path of the layout, written to the new slide's `layoutPath`. */
	path: string;
	/** Display name; falls back to the layout's file stem when OOXML omits one. */
	name: string;
}

/** Derive the layout menu from the deck's masters, skipping pathless entries. */
export function layoutOptionsFrom(masters: readonly PptxSlideMaster[]): RibbonLayoutOption[] {
	return masters.flatMap((master) =>
		(master.layouts ?? []).flatMap((layout) =>
			layout.path ? [{ path: layout.path, name: layout.name || fileStem(layout.path) }] : [],
		),
	);
}

/** "ppt/slideLayouts/slideLayout2.xml" -> "slideLayout2". */
function fileStem(path: string): string {
	const file = path.split('/').pop() ?? path;
	return file.replace(/\.[^.]+$/u, '');
}
