import { createElementRendererRegistry } from '../registry';
import type { ElementRendererRegistry } from '../types';
import { renderConnectorElement } from './connector';
import { renderGroupElement } from './group';
import { renderImageElement } from './image';
import { renderPlaceholderElement } from './placeholder';
import { registerExtraRenderers } from './register-extras';
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
export { registerExtraRenderers } from './register-extras';
export { registerTableChartRenderers } from './register-table-chart';
export { renderSmartArtElement, renderSmartArtSvg } from './smartart';
export { renderSmartArt3DElement } from './smartart-3d';
export { renderTableElement } from './table';
export { renderTextBlock } from './text-block';
export { renderTextShapeElement } from './text-shape';

/**
 * The registry the viewer uses by default.
 *
 * Dedicated renderers: `text`, `shape`, `image`, `picture`, `group`,
 * `connector`, `table`, `chart`, `smartArt`, `media`, `ink`, `ole`,
 * `contentPart`, `zoom`, and `model3d`. Only unknown extension elements fall
 * through to the typed placeholder fallback.
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
	registerExtraRenderers(registry);
	registry.setFallback(renderPlaceholderElement);
	return registry;
}
