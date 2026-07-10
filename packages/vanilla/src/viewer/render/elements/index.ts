import { createElementRendererRegistry } from '../registry';
import type { ElementRendererRegistry } from '../types';
import { renderConnectorElement } from './connector';
import { renderGroupElement } from './group';
import { renderImageElement } from './image';
import { renderPlaceholderElement } from './placeholder';
import { renderTextShapeElement } from './text-shape';

export { renderConnectorElement } from './connector';
export { renderGroupElement } from './group';
export { renderImageElement } from './image';
export { renderPlaceholderElement } from './placeholder';
export { renderTextBlock } from './text-block';
export { renderTextShapeElement } from './text-shape';

/**
 * The registry the viewer uses by default.
 *
 * Dedicated renderers: `text`, `shape`, `image`, `picture`, `group`,
 * `connector`. Every other type (`table`, `chart`, `smartArt`, `media`,
 * `ink`, `ole`, `contentPart`, `zoom`, `model3d`, `unknown`) falls through to
 * the typed placeholder fallback until its renderer lands; see `./README.md`
 * for the contract to add one.
 */
export function createDefaultRegistry(): ElementRendererRegistry {
	const registry = createElementRendererRegistry();
	registry.register('text', renderTextShapeElement);
	registry.register('shape', renderTextShapeElement);
	registry.register('image', renderImageElement);
	registry.register('picture', renderImageElement);
	registry.register('group', renderGroupElement);
	registry.register('connector', renderConnectorElement);
	registry.setFallback(renderPlaceholderElement);
	return registry;
}
