import type { ElementRendererRegistry } from '../types';
import { renderContentPartElement } from './contentpart';
import { renderModel3dElement } from './model3d';
import { renderZoomElement } from './zoom';

export { renderContentPartElement } from './contentpart';
export { renderModel3dElement } from './model3d';
export { renderZoomElement } from './zoom';

/**
 * Register the remaining "extra" element renderers (`model3d`, `zoom`,
 * `contentPart`) on a registry. The `unknown` type intentionally stays on the
 * fallback placeholder.
 *
 * Kept as a standalone entry point (like `registerRichMediaRenderers`) so the
 * default-registry wiring in `./index.ts` can adopt these renderers in one
 * place; hosts and tests can also call it against their own registries.
 */
export function registerExtraRenderers(registry: ElementRendererRegistry): void {
	registry.register('model3d', renderModel3dElement);
	registry.register('zoom', renderZoomElement);
	registry.register('contentPart', renderContentPartElement);
}
