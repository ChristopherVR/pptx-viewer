/**
 * `equation-compile` - the LaTeX -> OMML -> sanitised MathML pipeline that backs
 * every binding's Insert > Equation dialog.
 *
 * The three steps it chains already lived in shared
 * ({@link ./latex-to-omml}, {@link ./omml-to-mathml}, {@link ./mathml-sanitize}),
 * but each of the five bindings hand-rolled the glue that joins them, and the
 * copies had drifted: one skipped sanitisation entirely and one carried its own
 * fail-open DOMPurify wrapper. Chaining them here means the security posture and
 * the failure behaviour are decided once.
 *
 * WHY every failure collapses to an empty result instead of throwing: the editor
 * recompiles on every keystroke, so most intermediate strings are invalid LaTeX
 * (`\fra`, `\frac{`, ...). Returning `{ mathml: '', omml: {} }` is what lets the
 * dialog fall back to its "preview will appear here" placeholder and keep the
 * Insert button disabled while the user is mid-expression, with no error path.
 *
 * WHY the MathML is sanitised here rather than at each injection site: the
 * markup is fed to `dangerouslySetInnerHTML` / `v-html` / `{@html}` / raw
 * `innerHTML`, and OMML can arrive from an untrusted deck (edit mode seeds the
 * textarea from an existing equation). Sanitising at the source means a binding
 * cannot forget. {@link sanitizeMathMl} fails closed (empty) outside a DOM.
 *
 * @module render/equation-compile
 */

import { EQUATION_TEMPLATES } from './equation-templates';
import { convertLatexToOmml } from './latex-to-omml';
import { sanitizeMathMl } from './mathml-sanitize';
import { convertOmmlToMathMl } from './omml-to-mathml';
import type { OmmlNode } from './omml-to-mathml';

/**
 * A compiled equation: sanitised MathML for the live preview, plus the OMML tree
 * for the insert payload (what core stores as `TextSegment.equationXml`).
 */
export interface CompiledEquation {
	/** Sanitised MathML markup, or `''` when the source does not compile. */
	mathml: string;
	/** OMML object (`{ "m:oMathPara": { "m:oMath": … } }`), or `{}` on failure. */
	omml: Record<string, unknown>;
}

/**
 * The result every failure path collapses to. Built fresh per call rather than
 * shared from a module constant: callers hand the `omml` object straight to the
 * editor as an insert payload, and a shared `{}` would let one dialog's mutation
 * leak into the next.
 */
function emptyResult(): CompiledEquation {
	return { mathml: '', omml: {} };
}

/**
 * Compile a LaTeX source string into `{ mathml, omml }`.
 *
 * Never throws: empty, whitespace-only and unparseable input all yield the empty
 * result, so callers can gate their preview on `Object.keys(omml).length > 0`.
 */
export function compileLatexEquation(source: string): CompiledEquation {
	const trimmed = source.trim();
	if (!trimmed) {
		return emptyResult();
	}
	try {
		const omml = convertLatexToOmml(trimmed);
		const raw = convertOmmlToMathMl(omml as OmmlNode);
		return { mathml: raw ? sanitizeMathMl(raw) : '', omml };
	} catch {
		return emptyResult();
	}
}

/**
 * Convert a LaTeX string straight to sanitised MathML; `''` on empty input or
 * any failure. The preview-only half of {@link compileLatexEquation}, used by
 * the template tiles which never need the OMML.
 */
export function latexToMathMl(source: string): string {
	return compileLatexEquation(source).mathml;
}

/**
 * Compile the shared {@link EQUATION_TEMPLATES} catalogue to MathML, index for
 * index, for the dialog's starter-formula tiles.
 *
 * Deliberately NOT memoised: `sanitizeMathMl` fails closed without a DOM, so a
 * cached result computed during SSR / module evaluation would freeze an array of
 * empty strings into a page that later hydrates in a real browser. Bindings that
 * want it computed once do so at their own component scope.
 */
export function compileEquationTemplateMathMl(): string[] {
	return EQUATION_TEMPLATES.map((tmpl) => latexToMathMl(tmpl.latex));
}
