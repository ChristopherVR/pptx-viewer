import type { PptxLayoutPreview } from 'pptx-viewer-core';
import { useEffect, useState } from 'react';

/**
 * Fetch layout artwork the first time a gallery menu is opened.
 *
 * Parsing every layout part (and decoding the pictures they reference) is only
 * worth doing once the user actually asks to see the thumbnails, so this stays
 * idle until `enabled` flips. Core memoises the parse, so a second menu open
 * resolves immediately and this hook simply re-reads it.
 *
 * @param loadPreviews - Supplier bound to the current handler, or `undefined`
 *   before a deck is loaded.
 * @param enabled - Whether a gallery menu is currently open.
 * @returns Previews keyed by layout path; empty until the first load resolves.
 */
export function useLayoutPreviews(
	loadPreviews: (() => Promise<PptxLayoutPreview[]>) | undefined,
	enabled: boolean,
): ReadonlyMap<string, PptxLayoutPreview> {
	const [previews, setPreviews] = useState<ReadonlyMap<string, PptxLayoutPreview>>(new Map());

	useEffect(() => {
		if (!enabled || !loadPreviews) {
			return;
		}
		let cancelled = false;
		void loadPreviews()
			.then((loaded) => {
				if (!cancelled) {
					setPreviews(new Map(loaded.map((preview) => [preview.path, preview])));
				}
				return undefined;
			})
			.catch(() => {
				// A layout that will not parse should cost the user a plain-text
				// menu, not a broken one: the tiles fall back to name-only.
			});
		return () => {
			cancelled = true;
		};
	}, [enabled, loadPreviews]);

	return previews;
}
