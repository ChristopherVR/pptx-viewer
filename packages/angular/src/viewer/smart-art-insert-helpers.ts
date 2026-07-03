/**
 * smart-art-insert-helpers.ts: pure logic for the Angular "Insert SmartArt"
 * dialog.
 *
 * The presentational `InsertSmartArtDialogComponent` is intentionally thin:
 * every non-trivial computation (filtering the preset gallery by category,
 * building the SmartArt element payload from a chosen preset, hierarchy
 * parenting) is delegated to the pure functions below so they can be unit-tested
 * in plain vitest (the Angular package's vitest setup has no Angular compiler,
 * so component / TestBed tests are not available).
 *
 * The preset catalogue itself is the framework-agnostic, vendored
 * `pptx-viewer-shared` source of truth (`render/smart-art-presets`), consumed
 * through the `../internal/shared` barrel. This mirrors the React
 * `InsertSmartArtDialog.tsx` + `insert-structured-elements.ts` spec.
 *
 * @module angular-viewer/smart-art-insert-helpers
 */

import type { PptxElement, PptxSmartArtNode, SmartArtLayout } from 'pptx-viewer-core';

import { PRESETS } from '../internal/shared';
import type { SmartArtCategory, SmartArtPreset } from '../internal/shared';

/** Default insert position / size for a new SmartArt element (mirrors React). */
const INSERT_X = 100;
const INSERT_Y = 120;
const INSERT_WIDTH = 600;
const INSERT_HEIGHT = 340;

/** The presets that belong to a sidebar category, in catalogue order. */
export function presetsForCategory(category: SmartArtCategory): SmartArtPreset[] {
	return PRESETS.filter((preset) => preset.category === category);
}

/** Resolve a preset by its layout kind, or `undefined` when none matches. */
export function presetByLayout(layout: SmartArtLayout): SmartArtPreset | undefined {
	return PRESETS.find((preset) => preset.layout === layout);
}

/**
 * Build the SmartArt nodes for a chosen layout + item texts.
 *
 * Mirrors the React `handleInsertSmartArt` parenting rule: for a `hierarchy`
 * layout every item after the first becomes a child of the first (root) node;
 * for every other layout the items are flat top-level siblings. Each node gets a
 * unique id derived from `idSeed` so repeated inserts never collide.
 */
export function buildSmartArtNodes(
	layout: SmartArtLayout,
	items: readonly string[],
	idSeed: string = String(Date.now()),
): PptxSmartArtNode[] {
	const ids = items.map((_, i) => `node-${idSeed}-${i}`);
	return items.map((text, i) => {
		const node: PptxSmartArtNode = { id: ids[i], text };
		if (layout === 'hierarchy' && i > 0) {
			node.parentId = ids[0];
		}
		return node;
	});
}

/**
 * Build the complete new SmartArt {@link PptxElement} for an insert.
 *
 * The element id is left empty (`''`) so `EditorStateService.addElement`
 * assigns a real id, matching every other Angular insert factory. `colorScheme`
 * defaults to `colorful1` and `style` to `flat`, exactly as React inserts.
 */
export function buildSmartArtInsertElement(
	layout: SmartArtLayout,
	items: readonly string[],
	idSeed?: string,
): PptxElement {
	return {
		type: 'smartArt',
		id: '',
		name: 'SmartArt',
		x: INSERT_X,
		y: INSERT_Y,
		width: INSERT_WIDTH,
		height: INSERT_HEIGHT,
		smartArtData: {
			layout,
			colorScheme: 'colorful1',
			style: 'flat',
			nodes: buildSmartArtNodes(layout, items, idSeed),
		},
	} as PptxElement;
}

/**
 * Split a multi-line textarea value into trimmed, non-empty node texts.
 *
 * The dialog seeds the textarea with the preset's default items (one per line);
 * the user may edit them before inserting. Empty / whitespace-only lines are
 * dropped. When nothing usable remains, returns the preset's `defaultItems` so
 * an insert is never empty.
 */
export function parseNodeTextarea(value: string, fallback: readonly string[]): string[] {
	const lines = value
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	return lines.length > 0 ? lines : [...fallback];
}
