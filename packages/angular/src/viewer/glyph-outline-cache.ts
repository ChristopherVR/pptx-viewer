/**
 * Module-scoped WordArt glyph-outline font cache (see `pptx-viewer-shared`'s
 * `text-warp-outline-font-cache.ts`). Angular port of the React/Vue bindings'
 * `glyph-outline-cache.ts`; same rationale: a module singleton, not a
 * service/component field, since `element-renderer-shape.component.html`
 * reads the resolved outline directly off each `WarpGlyph` (already resolved
 * by `buildGlyphWarpDef` in `text-warp-glyph.ts`) rather than threading a
 * service through every template.
 *
 * `EmbeddedFontsService.setFonts` registers the deck's embedded fonts here
 * SYNCHRONOUSLY, before signals update (so before the first change-detection
 * pass that would render them). `GoogleWebfontsService` registers catalogue
 * webfont bytes once fetched and bumps its own signal, which recomputes
 * `glyphWarp` (both already read shared/component signals, so a change
 * triggers Angular's normal change detection).
 */
import { signal } from '@angular/core';
import type { WritableSignal } from '@angular/core';

import { GlyphOutlineFontCache, createGlyphOutlineLookup } from '../internal/shared';

export const glyphOutlineFontCache = new GlyphOutlineFontCache();

/**
 * Bumped whenever a webfont's outline bytes are newly registered
 * (`GoogleWebfontsService`). `text-warp-glyph.ts`'s `buildGlyphWarpDef` reads
 * it (via `getGlyphOutline` below being invoked inside an Angular
 * `computed()`), so `element-renderer-shape.component.ts`'s `glyphWarp`
 * signal recomputes and picks up newly-available outlines automatically.
 */
export const glyphOutlineFontsTick: WritableSignal<number> = signal(0);

/** The `getGlyphOutline` callback `buildGlyphEnvelope` accepts, backed by the module singleton. */
export const getGlyphOutline = createGlyphOutlineLookup(glyphOutlineFontCache);
