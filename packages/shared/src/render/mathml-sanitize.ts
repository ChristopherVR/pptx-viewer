/**
 * MathML / SVG markup sanitisation, shared by every binding's equation
 * renderer.
 *
 * Equations are converted from OOXML OMML to a MathML markup string (see
 * {@link ./omml-to-mathml}) and then injected into the DOM via the binding's
 * raw-HTML mechanism (`dangerouslySetInnerHTML` / `v-html`). To keep that
 * injection safe we run the markup through DOMPurify with the MathML + SVG
 * profiles enabled, so `<math>` / `<mfrac>` / `<msqrt>` / `<svg>` survive while
 * scriptable content is stripped.
 *
 * (Angular renders equations through its own `DomSanitizer`, so it does not
 * consume this helper.)
 */
import { sanitizeMarkupOrRaw } from './dompurify-safe';

/**
 * Safely sanitise a MathML/SVG markup string.
 *
 * In browser environments DOMPurify ships with `sanitize` ready to go. In
 * non-DOM contexts (node-based tests, SSR without jsdom) it falls back to the
 * raw input; the XSS surface only matters in the browser, so this fallback
 * is safe for non-DOM consumers.
 *
 * @param markup - MathML (optionally with embedded SVG) markup to sanitise.
 * @returns The sanitised markup, or the raw input when no DOM is available.
 */
export function sanitizeMathMl(markup: string): string {
	return sanitizeMarkupOrRaw(markup, { USE_PROFILES: { mathMl: true, svg: true } });
}
