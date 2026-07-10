import type { ElementRenderer, ElementRendererRegistry, PptxElementType } from './types';

/**
 * Create an empty {@link ElementRendererRegistry}.
 *
 * The default fallback renders nothing; `createDefaultRegistry()` (in
 * `./elements`) installs the built-in renderers plus the typed placeholder
 * fallback.
 */
export function createElementRendererRegistry(): ElementRendererRegistry {
	const renderers = new Map<PptxElementType, ElementRenderer>();
	let fallback: ElementRenderer = () => null;

	return {
		register(type, renderer) {
			renderers.set(type, renderer);
		},
		unregister(type) {
			renderers.delete(type);
		},
		get(type) {
			return renderers.get(type);
		},
		has(type) {
			return renderers.has(type);
		},
		setFallback(renderer) {
			fallback = renderer;
		},
		resolve(type) {
			return renderers.get(type) ?? fallback;
		},
		registeredTypes() {
			return Array.from(renderers.keys()).sort();
		},
	};
}
