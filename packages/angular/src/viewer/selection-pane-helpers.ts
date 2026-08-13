/**
 * selection-pane-helpers.ts: pure display + rename logic behind
 * {@link SelectionPaneComponent}, kept out of the component so it stays thin
 * presentation and this logic is testable without a TestBed.
 */

import type { PptxElement } from 'pptx-viewer-core';
import { resolveSelectionPaneRename } from 'pptx-viewer-shared';

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
 * Decide what a rename commit means.
 *
 * Thin re-export of the shared decision function so every binding answers this
 * identically; Angular used to carry its own copy, which is exactly how the
 * five drifted onto the same wrong answer for the empty case. Kept exported
 * under this name because the component and its tests import it from here.
 *
 * @see resolveSelectionPaneRename
 */
export function renameCommitName(seed: string, value: string): { name: string } | null {
	return resolveSelectionPaneRename(seed, value);
}
