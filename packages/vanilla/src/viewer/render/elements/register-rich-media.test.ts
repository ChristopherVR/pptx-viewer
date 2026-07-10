import { describe, expect, it } from 'vitest';

import { createElementRendererRegistry } from '../registry';
import { renderInkElement } from './ink';
import { renderMediaElement } from './media';
import { renderOleElement } from './ole';
import { registerRichMediaRenderers } from './register-rich-media';
import { renderSmartArtElement } from './smartart';

describe('registerRichMediaRenderers', () => {
	it('registers the smartArt, media, ink, and ole renderers', () => {
		const registry = createElementRendererRegistry();
		registerRichMediaRenderers(registry);

		expect(registry.get('smartArt')).toBe(renderSmartArtElement);
		expect(registry.get('media')).toBe(renderMediaElement);
		expect(registry.get('ink')).toBe(renderInkElement);
		expect(registry.get('ole')).toBe(renderOleElement);
		expect(registry.registeredTypes()).toStrictEqual(['ink', 'media', 'ole', 'smartArt']);
	});
});
