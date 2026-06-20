/**
 * Thin re-export shim → vendored `pptx-viewer-shared` (`render/embedded-fonts`).
 *
 * The pure embedded-font `@font-face` assembly (URL/format validation, XOR
 * de-obfuscation fallback, resolved-variant -> stylesheet/family-list build)
 * was extracted to shared and is consumed by every binding. This shim preserves
 * the historical Angular import surface.
 *
 * `EMBEDDED_FONTS_STYLE_ID` stays Angular-local: it is the DOM id of the managed
 * `<style>` element this binding injects, and is intentionally distinct from the
 * React binding's id.
 */

export type { ResolvedFontVariant, ObjectUrlFactory, EmbeddedFontStyles } from '../internal/shared';

export {
	isInjectableUrl,
	fontMimeForFormat,
	normalizeFontFormat,
	resolveFontVariant,
	buildFontFaceRule,
	buildEmbeddedFontStyles,
} from '../internal/shared';

/** DOM id of the managed `<style>` element the service injects into `<head>`. */
export const EMBEDDED_FONTS_STYLE_ID = 'pptx-angular-embedded-fonts';
