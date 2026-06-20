/**
 * Thin re-export shim -> `pptx-viewer-shared`.
 *
 * The Unicode script detection helpers (font fallback by codepoint) were
 * extracted to `pptx-viewer-shared` (`render/unicode-script-detection`) and are
 * consumed by every binding. This shim preserves the historical React import
 * surface so `text-segment-render`, `text-segment-helpers`, and the colocated
 * test are unchanged.
 */
export type { FontScriptCategory, ScriptRun } from 'pptx-viewer-shared';
export {
	detectFontScript,
	segmentByScript,
	resolveFontForScript,
	hasDistinctScriptFonts,
} from 'pptx-viewer-shared';
