import { createElementRendererRegistry } from '../registry';
import type { ElementRendererRegistry } from '../types';
import { renderConnectorElement } from './connector';
import { renderGroupElement } from './group';
import { renderImageElement } from './image';
import { renderPlaceholderElement } from './placeholder';
import { registerRichMediaRenderers } from './register-rich-media';
import { registerTableChartRenderers } from './register-table-chart';
import { renderTextShapeElement } from './text-shape';

export { renderChartElement } from './chart';
export { renderConnectorElement } from './connector';
export { renderGroupElement } from './group';
export { renderImageElement } from './image';
export { renderInkElement } from './ink';
export { renderMediaElement } from './media';
export { renderOleElement } from './ole';
export { renderPlaceholderElement } from './placeholder';
export { registerRichMediaRenderers } from './register-rich-media';
export { registerTableChartRenderers } from './register-table-chart';
export { renderSmartArtElement } from './smartart';
export { renderTableElement } from './table';
export { renderTextBlock } from './text-block';
export { renderTextShapeElement } from './text-shape';

/**
 * The registry the viewer uses by default.
 *
 * Dedicated renderers: `text`, `shape`, `image`, `picture`, `group`,
 * `connector`, `table`, `chart`, `smartArt`, `media`, `ink`, `ole`. The
 * remaining types (`contentPart`, `zoom`, `model3d`, `unknown`) fall through
 * to the typed placeholder fallback until their renderers land; see
 * `./README.md` for the contract to add one.
 */
export function createDefaultRegistry(): ElementRendererRegistry {
	const registry = createElementRendererRegistry();
	registry.register('text', renderTextShapeElement);
	registry.register('shape', renderTextShapeElement);
	registry.register('image', renderImageElement);
	registry.register('picture', renderImageElement);
	registry.register('group', renderGroupElement);
	registry.register('connector', renderConnectorElement);
	registerTableChartRenderers(registry);
	registerRichMediaRenderers(registry);
	registry.setFallback(renderPlaceholderElement);
	return registry;
}
