/**
 * Module-scoped WordArt glyph-outline font cache (see `pptx-viewer-shared`'s
 * `text-warp-outline-font-cache.ts`).
 *
 * A singleton, not React state: `warp-text-renderer.tsx` reads it directly
 * during render (many small `<EnvelopeGlyph>`s deep in the tree), so
 * threading it through props/context for every element would be a much
 * bigger change than the value it buys. `useFontInjection` registers the
 * deck's embedded fonts here SYNCHRONOUSLY (see `useLoadContent.ts`'s
 * `setEmbeddedFonts` call site), before the first render that uses them, so
 * no extra re-render is needed for the common (embedded-font) case. Google
 * catalogue webfont bytes arrive later (a real fetch); `useFontInjection`
 * bumps its own state once they land so components re-render and pick them
 * up from this same cache.
 */
import { GlyphOutlineFontCache, createGlyphOutlineLookup } from 'pptx-viewer-shared';

export const glyphOutlineFontCache = new GlyphOutlineFontCache();

/** The `getGlyphOutline` callback `buildGlyphEnvelope` accepts, backed by the module singleton. */
export const getGlyphOutline = createGlyphOutlineLookup(glyphOutlineFontCache);
