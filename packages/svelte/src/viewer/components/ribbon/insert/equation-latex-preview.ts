import { convertLatexToOmml, convertOmmlToMathMl, sanitizeMathMl } from 'pptx-viewer-shared';
import type { OmmlNode } from 'pptx-viewer-shared';

/** A compiled equation: sanitized MathML for the preview, OMML for the insert. */
export interface CompiledEquation {
	mathml: string;
	omml: Record<string, unknown>;
}

/**
 * LaTeX -> OMML -> sanitized MathML, for the equation editor's live preview and
 * its insert payload.
 *
 * Every conversion failure (and there are many: the editor compiles on every
 * keystroke, so most intermediate strings are invalid LaTeX) collapses to an
 * empty result rather than throwing, which is what lets the preview simply show
 * its placeholder while the user is mid-expression.
 *
 * NOTE: React, Vue, Vanilla and this binding each hand-roll this same
 * three-step pipeline; it is framework-agnostic and belongs in
 * `pptx-viewer-shared` next to `mathml-sanitize`. Kept local for now, extracted
 * out of the SFC so the dialog stays presentation only.
 */
export function compileLatexEquation(source: string): CompiledEquation {
	const trimmed = source.trim();
	if (!trimmed) {
		return { mathml: '', omml: {} };
	}
	try {
		const omml = convertLatexToOmml(trimmed);
		const raw = convertOmmlToMathMl(omml as OmmlNode);
		return { mathml: raw ? sanitizeMathMl(raw) : '', omml };
	} catch {
		return { mathml: '', omml: {} };
	}
}

/** Convert a LaTeX string to sanitized MathML; '' on failure or empty input. */
export function latexToMathMl(source: string): string {
	if (!source.trim()) {
		return '';
	}
	try {
		const omml = convertLatexToOmml(source);
		const raw = convertOmmlToMathMl(omml as OmmlNode);
		return raw ? sanitizeMathMl(raw) : '';
	} catch {
		return '';
	}
}
