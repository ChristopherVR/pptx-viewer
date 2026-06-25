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
import DOMPurify from 'dompurify';

/**
 * Safely sanitise a MathML/SVG markup string.
 *
 * In browser environments DOMPurify ships with `sanitize` ready to go. In
 * non-DOM contexts (node-based tests, SSR without jsdom) DOMPurify returns a
 * factory that lacks `sanitize` until handed a window; there we fall back to
 * the raw input. The XSS surface only matters in the browser, so this fallback
 * is safe for non-DOM consumers.
 *
 * @param markup - MathML (optionally with embedded SVG) markup to sanitise.
 * @returns The sanitised markup, or the raw input when no DOM is available.
 */
export function sanitizeMathMl(markup: string): string {
	const purify = DOMPurify as unknown as {
		sanitize?: (dirty: string, cfg?: Record<string, unknown>) => string;
	};
	if (typeof purify.sanitize !== 'function') {
		return markup;
	}
	return purify.sanitize(markup, { USE_PROFILES: { mathMl: true, svg: true } });
}
