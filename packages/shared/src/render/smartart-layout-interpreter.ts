/**
 * SmartArt DiagramML interpreter - public entry point + dispatch.
 *
 * Re-exported from `pptx-viewer-core`, which is now the single home of this
 * interpreter: `pptx-viewer-core`'s save/decompose pipeline fabricates the
 * cached `dsp:` diagram drawing using the SAME interpreter this package's SVG
 * -fallback preview path calls, so the fabricated drawing on save matches
 * what every binding renders on screen (`composite`/`conn`/`sp`/`tx`,
 * decided `dgm:choose`/`dgm:forEach`, and manual `cust*` node overrides all
 * included). `pptx-viewer-core` cannot import `pptx-viewer-shared` (this
 * package depends on core, not the other way around, and core is published
 * standalone), so this is the only direction that avoids a circular
 * dependency.
 */

export { interpretSmartArtLayout, type InterpretLayoutInput } from 'pptx-viewer-core';
