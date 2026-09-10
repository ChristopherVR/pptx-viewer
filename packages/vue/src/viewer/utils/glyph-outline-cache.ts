/**
 * Module-scoped WordArt glyph-outline font cache (see `pptx-viewer-shared`'s
 * `text-warp-outline-font-cache.ts`). Vue port of the React binding's
 * `glyph-outline-cache.ts`; same rationale: a module singleton, not
 * component/composable state, since `WordArtEnvelopeGlyph.vue` reads it
 * directly during render for every glyph, and threading it through props for
 * every element down the tree would be a much bigger change than the value
 * it buys.
 *
 * `useEmbeddedFonts` registers the deck's embedded fonts here SYNCHRONOUSLY
 * (in a `watchEffect` with `immediate: true`, so before the first template
 * render that uses them). `useGoogleWebfonts` registers catalogue webfont
 * bytes once fetched and bumps {@link glyphOutlineFontsTick} so
 * `useTextWarpEnvelope`'s computed glyph layout (which reads the tick)
 * recomputes and picks them up from this same cache.
 */
import { GlyphOutlineFontCache, createGlyphOutlineLookup } from 'pptx-viewer-shared';
import { ref } from 'vue';
import type { Ref } from 'vue';

export const glyphOutlineFontCache = new GlyphOutlineFontCache();

/** Bumped whenever a webfont's outline bytes are newly registered; read (not written) by `useTextWarpEnvelope`. */
export const glyphOutlineFontsTick: Ref<number> = ref(0);

/** The `getGlyphOutline` callback `buildGlyphEnvelope` accepts, backed by the module singleton. */
export const getGlyphOutline = createGlyphOutlineLookup(glyphOutlineFontCache);
