import { describe, expect, it } from 'vitest';

import { createElementRendererRegistry } from '../registry';
import { renderContentPartElement } from './contentpart';
import { renderModel3dElement } from './model3d';
import { registerExtraRenderers } from './register-extras';
import { renderZoomElement } from './zoom';

describe('registerExtraRenderers', () => {
	it('registers the model3d, zoom, and contentPart renderers', () => {
		const registry = createElementRendererRegistry();
		registerExtraRenderers(registry);

		expect(registry.get('model3d')).toBe(renderModel3dElement);
		expect(registry.get('zoom')).toBe(renderZoomElement);
		expect(registry.get('contentPart')).toBe(renderContentPartElement);
		expect(registry.registeredTypes()).toStrictEqual(['contentPart', 'model3d', 'zoom']);
	});

	it('leaves unknown on the fallback', () => {
		const registry = createElementRendererRegistry();
		registerExtraRenderers(registry);
		expect(registry.has('unknown')).toBeFalsy();
	});
});
