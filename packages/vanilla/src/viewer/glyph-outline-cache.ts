/**
 * Module-scoped WordArt glyph-outline font cache (see `pptx-viewer-shared`'s
 * `text-warp-outline-font-cache.ts`). Vanilla port of the React/Vue/Angular/
 * Svelte bindings' `glyph-outline-cache`; same rationale: a module singleton,
 * not viewer-state, since `render/elements/text-warp.ts` reads it directly
 * while rendering every glyph.
 *
 * `PptxViewer` registers the deck's embedded fonts here SYNCHRONOUSLY (in the
 * same store subscription that already reacts to `state.embeddedFonts`,
 * before the state-sync repaint it triggers runs) and registers catalogue
 * webfont bytes once fetched, bumping `viewer-state.ts`'s `outlineFontsTick`
 * so `state-sync.ts` repaints and the renderer picks them up from this same
 * cache.
 */
import { createGlyphOutlineLookup, GlyphOutlineFontCache } from 'pptx-viewer-shared';

export const glyphOutlineFontCache = new GlyphOutlineFontCache();

/** The `getGlyphOutline` callback `buildGlyphEnvelope` accepts, backed by the module singleton. */
export const getGlyphOutline = createGlyphOutlineLookup(glyphOutlineFontCache);
