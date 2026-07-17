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
import { sanitizeMarkupOrEmpty } from './dompurify-safe';

/**
 * Safely sanitise a MathML/SVG markup string.
 *
 * In browser environments DOMPurify ships with `sanitize` ready to go. In
 * non-DOM contexts (node-based tests, SSR without jsdom) there is no
 * sanitizer to run, and the markup can originate from an untrusted OOXML
 * equation, so this fails closed (empty string) rather than passing raw,
 * unsanitised markup through to a caller that injects it as HTML.
 *
 * @param markup - MathML (optionally with embedded SVG) markup to sanitise.
 * @returns The sanitised markup, or `''` when no DOM sanitizer is available.
 */
export function sanitizeMathMl(markup: string): string {
	const sanitized = sanitizeMarkupOrEmpty(markup, { USE_PROFILES: { mathMl: true, svg: true } });
	// DOMPurify's HTML parser can retain MathML descendants while dropping the
	// outer namespace-bearing <math> node. Restore that generated, constant
	// wrapper so browsers keep the fragment in the MathML rendering context.
	if (/<math(?:\s|>)/iu.test(markup) && !/<math(?:\s|>)/iu.test(sanitized) && sanitized) {
		return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline">${sanitized}</math>`;
	}
	return sanitized;
}
