import type { ElementRendererRegistry } from '../types';
import { renderInkElement } from './ink';
import { renderMediaElement } from './media';
import { renderOleElement } from './ole';
import { renderSmartArtElement } from './smartart';

export { renderInkElement } from './ink';
export { renderMediaElement } from './media';
export { renderOleElement } from './ole';
export { renderSmartArtElement } from './smartart';

/**
 * Register the rich-media element renderers (`smartArt`, `media`, `ink`,
 * `ole`) on a registry.
 *
 * Kept as a standalone entry point (rather than wiring
 * `createDefaultRegistry()` directly) so the default-registry wiring in
 * `./index.ts` can adopt these renderers in one place without this module
 * needing to touch it; hosts and tests can also call it against their own
 * registries.
 */
export function registerRichMediaRenderers(registry: ElementRendererRegistry): void {
	registry.register('smartArt', renderSmartArtElement);
	registry.register('media', renderMediaElement);
	registry.register('ink', renderInkElement);
	registry.register('ole', renderOleElement);
}
