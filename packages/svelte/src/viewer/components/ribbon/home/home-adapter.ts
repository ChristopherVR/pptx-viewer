import { homeFamilyControls } from 'pptx-viewer-shared';
import type { HomeLayoutArtwork, RibbonGalleryId, RibbonHomeFamily } from 'pptx-viewer-shared';
import { getAllContexts, mount, unmount } from 'svelte';

import LayoutArtwork from './LayoutArtwork.svelte';

/** The gallery a Home control embeds (Quick Styles, Bullets, ...), from the shared spec. */
export function homeGalleryId(
	family: RibbonHomeFamily,
	controlId: string,
): RibbonGalleryId | undefined {
	return homeFamilyControls(family).find((spec) => spec.id === controlId)?.gallery?.id as
		| RibbonGalleryId
		| undefined;
}

/**
 * Layout artwork hook for the shared slides element. Call during component
 * init: it captures the Svelte contexts (translator, field context, ...) so the
 * mounted slide stage behaves as it did inside the old native gallery.
 */
export function createLayoutArtwork(): HomeLayoutArtwork {
	const context = getAllContexts();
	return (preview, geometry, container) => {
		const instance = mount(LayoutArtwork, {
			target: container,
			props: { preview, geometry },
			context,
		});
		return () => {
			void unmount(instance);
		};
	};
}
