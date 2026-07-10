/**
 * DOMPurify wrappers shared by every markup-sanitising call site (MathML/SVG
 * equation rendering, print-document/SVG assembly). DOMPurify's factory has
 * no working `sanitize` until handed a `window`, so in non-DOM contexts
 * (node-based tests, SSR without jsdom) these degrade rather than throw.
 *
 * Two degradation strategies, picked per call site by how the sanitised
 * output is used:
 *  - {@link sanitizeMarkupOrRaw}: returns the untouched input outside a DOM.
 *    Safe when the caller only ever renders the result in the browser (e.g.
 *    `dangerouslySetInnerHTML` / `v-html`), so the fallback path never
 *    reaches a real sink.
 *  - {@link sanitizeMarkupOrEmpty}: returns `''` outside a DOM (fail closed).
 *    Used where the sanitised string is unconditionally spliced into a
 *    larger assembled document (print HTML/SVG) with no further gate, so a
 *    silent pass-through of the raw, unsanitised input would defeat the
 *    sanitisation entirely.
 */
import DOMPurify from 'dompurify';

type Purify = { sanitize?: (dirty: string, cfg?: Record<string, unknown>) => string };

function purifyFn(): Purify['sanitize'] | undefined {
	const purify = DOMPurify as unknown as Purify;
	return typeof purify.sanitize === 'function' ? purify.sanitize : undefined;
}

/** Sanitise `markup`; outside a DOM, returns the raw input unchanged. */
export function sanitizeMarkupOrRaw(markup: string, config: Record<string, unknown>): string {
	const sanitize = purifyFn();
	return sanitize ? sanitize(markup, config) : markup;
}

/** Sanitise `markup`; outside a DOM, returns `''` (fail closed). */
export function sanitizeMarkupOrEmpty(markup: string, config: Record<string, unknown>): string {
	const sanitize = purifyFn();
	return sanitize ? sanitize(markup, config) : '';
}
