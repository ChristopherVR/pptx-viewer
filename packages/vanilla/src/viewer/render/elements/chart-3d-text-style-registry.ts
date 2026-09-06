import type { TextStyleAnimationDescriptor } from 'pptx-viewer-shared';

/**
 * chart-3d-text-style-registry: lets presentation playback
 * (`animation-dom.ts`'s `applyElementAnimationStyles`) reach the font-style
 * emphasis override (Bold Flash, Underline, Change Font Style/Size, ...) into
 * a 3D chart or SmartArt3D element's OWN canvas-drawn text.
 *
 * Every other element's text-style override is a plain CSS `<style>` scoped
 * by `data-element-id` (`buildTextStyleOverrideCss`), which works because the
 * run markup it targets is real DOM. A bar3D/line3D/area3D/surface3D chart's
 * axis labels and a SmartArt3D node's caption are drawn as textures on a
 * three.js mesh instead: no CSS selector can reach them, so the mounted
 * scene's own `handle.setTextStyle(...)` method is the only way in. This
 * module is the seam between the two: each 3D renderer registers its handle
 * here right after a successful mount and unregisters it on teardown; the
 * per-frame animation pass looks the element id up and calls `setTextStyle`
 * directly, alongside (not instead of) the harmless-but-ineffective CSS
 * override every element still gets.
 *
 * Scoped per `Document` (a `WeakMap`), matching `ensurePresentationKeyframes`
 * / `injectSlideKeyframes`'s own per-document scoping in `animation-dom.ts`,
 * so multiple viewer instances (or a detached test document) never share
 * state through a bare module-level id map.
 *
 * @module chart-3d-text-style-registry
 */

/** The one method every interactive 3D scene handle with canvas-drawn text exposes. */
export interface Chart3DTextStyleHandle {
	setTextStyle(style: TextStyleAnimationDescriptor | undefined): void;
}

const registries = new WeakMap<Document, Map<string, Chart3DTextStyleHandle>>();

function registryFor(doc: Document): Map<string, Chart3DTextStyleHandle> {
	let registry = registries.get(doc);
	if (!registry) {
		registry = new Map();
		registries.set(doc, registry);
	}
	return registry;
}

/**
 * Register a freshly mounted 3D scene's handle under `elementId`, so
 * subsequent animation ticks can reach its `setTextStyle`. Replaces any
 * previous registration for the same id (a stale handle left behind by a
 * mount that never got torn down, which should not happen in practice, but
 * "last mount wins" is the safe default either way).
 */
export function registerChart3DTextStyleHandle(
	doc: Document,
	elementId: string,
	handle: Chart3DTextStyleHandle,
): void {
	registryFor(doc).set(elementId, handle);
}

/**
 * Unregister a 3D scene's handle on teardown. A no-op when `handle` is not
 * (or no longer) the one registered for `elementId`, so a stale async
 * disposal can never evict a NEWER mount's live handle.
 */
export function unregisterChart3DTextStyleHandle(
	doc: Document,
	elementId: string,
	handle: Chart3DTextStyleHandle,
): void {
	const registry = registries.get(doc);
	if (registry?.get(elementId) === handle) {
		registry.delete(elementId);
	}
}

/**
 * Apply (or clear) a text-style override on the 3D scene mounted for
 * `elementId`, if any. Called once per element per animation tick from
 * `applyElementAnimationStyles`; a no-op when nothing is registered (the
 * element isn't a 3D chart/SmartArt3D, or none is currently mounted, e.g.
 * `three` unavailable / still loading / pie3D which has no canvas text).
 */
export function applyChart3DTextStyle(
	doc: Document,
	elementId: string,
	style: TextStyleAnimationDescriptor | undefined,
): void {
	registries.get(doc)?.get(elementId)?.setTextStyle(style);
}
