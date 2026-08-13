/**
 * selection-pane-helpers.ts: pure display + rename logic behind
 * {@link SelectionPaneComponent}, kept out of the component so it stays thin
 * presentation and this logic is testable without a TestBed.
 */

import type { PptxElement } from 'pptx-viewer-core';

/** Unicode icon by element type (no Lucide dependency in Angular). */
const ELEMENT_TYPE_ICONS: Record<string, string> = {
	text: 'T',
	shape: '▭',
	image: 'Img',
	table: '⊞',
	chart: 'Cht',
	connector: '╱',
	group: '▣',
	smartArt: '◈',
	media: '▶',
	ink: '✏',
	ole: 'OLE',
};

/** Icon glyph for an element type, with a '?' fallback. */
export function elementIcon(type: string): string {
	return ELEMENT_TYPE_ICONS[type] ?? '?';
}

/** The row label: the element's authored name, else its id. */
export function elementLabel(el: PptxElement): string {
	if ('name' in el && typeof el.name === 'string' && el.name.trim().length > 0) {
		return el.name;
	}
	return el.id;
}

/**
 * Decide what a rename commit means, mirroring React's `SelectionPane`:
 *
 * - An unedited commit (the trimmed value equals the trimmed seed the input
 *   was opened with) is a no-op, so a fallback label (the element id) is
 *   never persisted as a real name. Returns `null`.
 * - An emptied value drops the model's name back to `undefined`, which clears
 *   the label this pane shows. It does NOT clear `cNvPr/@name` in the file:
 *   `undefined` means "the model has no opinion, leave the markup alone" to
 *   the save writer (`applyNameToCnvPr`), because chart / SmartArt / graphic
 *   frames parse without a `name` while their markup carries a real one, and
 *   blanking on `undefined` would wipe those on a plain round-trip. `@name` is
 *   REQUIRED on `CT_NonVisualDrawingProps` (ECMA-376 S20.1.2.2.8), so it can
 *   never be dropped; an explicit `''` is what writes `name=""`. React, Vue,
 *   Svelte and Vanilla all commit `undefined` here too, so this is shared
 *   behaviour rather than a divergence.
 * - Anything else commits the trimmed value.
 */
export function renameCommitName(seed: string, value: string): { name: string | undefined } | null {
	const trimmed = value.trim();
	if (trimmed === seed.trim()) {
		return null;
	}
	return { name: trimmed.length > 0 ? trimmed : undefined };
}
