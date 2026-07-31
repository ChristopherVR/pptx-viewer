import { openPptxFile } from 'pptx-viewer-shared';

import type { PresentationLoader } from './presentation-loader.svelte';

/**
 * Build the File > Open > "Browse this device" handler.
 *
 * The host can override it (the `onopenfile` prop); otherwise this falls back
 * to the built-in native picker and loads the chosen deck in place. Without the
 * fallback the control is inert in every host that does not pass `onopenfile`,
 * which is what made it look dead in the demo; React, Vue, Angular and Vanilla
 * all fall back this way.
 *
 * `getOverride` is read lazily so a host that supplies the callback later (or
 * conditionally) still wins.
 */
export function createOpenFile(
	loader: PresentationLoader,
	getOverride: () => (() => void) | undefined,
): () => void {
	return () => {
		const override = getOverride();
		if (override) {
			override();
			return;
		}
		void (async () => {
			const picked = await openPptxFile();
			if (picked) {
				await loader.load(picked.buffer);
			}
		})();
	};
}
