/**
 * latex-omml-symbols: the symbol tables shared by both directions of the
 * LaTeX <-> OMML converters (`latex-to-omml.ts`, `omml-to-latex.ts`).
 *
 * Forward maps go from a LaTeX command to the Unicode character OMML stores in
 * `m:t` / `m:chr`; the `REVERSE_*` maps invert them (first command wins for
 * characters reachable from several aliases, e.g. `\le` and `\leq`).
 */

// ── Greek letters ────────────────────────────────────────────────────────────

export const GREEK_MAP: Record<string, string> = {
	'\\alpha': 'α',
	'\\beta': 'β',
	'\\gamma': 'γ',
	'\\delta': 'δ',
	'\\epsilon': 'ε',
	'\\varepsilon': 'ε',
	'\\zeta': 'ζ',
	'\\eta': 'η',
	'\\theta': 'θ',
	'\\vartheta': 'ϑ',
	'\\iota': 'ι',
	'\\kappa': 'κ',
	'\\lambda': 'λ',
	'\\mu': 'μ',
	'\\nu': 'ν',
	'\\xi': 'ξ',
	'\\pi': 'π',
	'\\rho': 'ρ',
	'\\sigma': 'σ',
	'\\tau': 'τ',
	'\\upsilon': 'υ',
	'\\phi': 'φ',
	'\\varphi': 'ϕ',
	'\\chi': 'χ',
	'\\psi': 'ψ',
	'\\omega': 'ω',
	'\\Gamma': 'Γ',
	'\\Delta': 'Δ',
	'\\Theta': 'Θ',
	'\\Lambda': 'Λ',
	'\\Xi': 'Ξ',
	'\\Pi': 'Π',
	'\\Sigma': 'Σ',
	'\\Phi': 'Φ',
	'\\Psi': 'Ψ',
	'\\Omega': 'Ω',
};

// ── Operators ────────────────────────────────────────────────────────────────

export const OPERATOR_MAP: Record<string, string> = {
	'\\times': '×',
	'\\div': '÷',
	'\\pm': '±',
	'\\mp': '∓',
	'\\cdot': '·',
	'\\leq': '≤',
	'\\geq': '≥',
	'\\neq': '≠',
	'\\approx': '≈',
	'\\equiv': '≡',
	'\\ll': '≪',
	'\\gg': '≫',
	'\\subset': '⊂',
	'\\supset': '⊃',
	'\\subseteq': '⊆',
	'\\supseteq': '⊇',
	'\\in': '∈',
	'\\notin': '∉',
	'\\cup': '∪',
	'\\cap': '∩',
	'\\to': '→',
	'\\rightarrow': '→',
	'\\leftarrow': '←',
	'\\leftrightarrow': '↔',
	'\\Rightarrow': '⇒',
	'\\Leftarrow': '⇐',
	'\\Leftrightarrow': '⇔',
	'\\infty': '∞',
	'\\partial': '∂',
	'\\nabla': '∇',
	'\\forall': '∀',
	'\\exists': '∃',
	'\\therefore': '∴',
	'\\because': '∵',
	'\\propto': '∝',
	'\\ldots': '…',
	'\\cdots': '⋯',
	'\\vdots': '⋮',
	'\\ddots': '⋱',
	'\\le': '≤',
	'\\ge': '≥',
	'\\ne': '≠',
};

/**
 * LaTeX escapes for characters that are syntax in the LaTeX grammar but plain
 * text in an OMML run. `omml-to-latex` emits these so a run holding `{` or
 * `_` survives the trip through the tokenizer.
 */
export const ESCAPE_MAP: Record<string, string> = {
	'\\{': '{',
	'\\}': '}',
	'\\lbrace': '{',
	'\\rbrace': '}',
	'\\_': '_',
	'\\^': '^',
	'\\&': '&',
	'\\%': '%',
	'\\#': '#',
	'\\$': '$',
	'\\ ': ' ',
	'\\backslash': '\\',
	// Spacing commands render as an ordinary space run (`\ ` wins on reversal).
	'\\quad': ' ',
	'\\qquad': ' ',
	'\\,': ' ',
	'\\:': ' ',
	'\\;': ' ',
	'\\!': '',
};

// ── N-ary operators ──────────────────────────────────────────────────────────

export const NARY_MAP: Record<string, string> = {
	'\\sum': '∑',
	'\\prod': '∏',
	'\\int': '∫',
	'\\iint': '∬',
	'\\iiint': '∭',
	'\\oint': '∮',
	'\\coprod': '∐',
	'\\bigcup': '⋃',
	'\\bigcap': '⋂',
	'\\bigwedge': '⋀',
	'\\bigvee': '⋁',
};

// ── Function names ───────────────────────────────────────────────────────────

export const FUNC_NAMES = new Set([
	'sin',
	'cos',
	'tan',
	'cot',
	'sec',
	'csc',
	'arcsin',
	'arccos',
	'arctan',
	'sinh',
	'cosh',
	'tanh',
	'coth',
	'log',
	'ln',
	'exp',
	'lim',
	'min',
	'max',
	'sup',
	'inf',
	'det',
	'dim',
	'mod',
	'gcd',
	'deg',
	'hom',
	'ker',
]);

/**
 * Function names whose `_{...}` argument typesets beneath the name (LaTeX
 * "limits" operators). `\lim_{x \to 0}` becomes `m:limLow`, not `m:sSub`,
 * which is the structure PowerPoint itself writes for a limit.
 */
export const LIMIT_FUNC_NAMES = new Set(['lim', 'min', 'max', 'sup', 'inf', 'det', 'gcd']);

// ── Accents (m:acc) ──────────────────────────────────────────────────────────

/** LaTeX accent command -> combining character stored in `m:accPr/m:chr`. */
export const ACCENT_MAP: Record<string, string> = {
	'\\hat': '̂',
	'\\check': '̌',
	'\\tilde': '̃',
	'\\acute': '́',
	'\\grave': '̀',
	'\\dot': '̇',
	'\\ddot': '̈',
	'\\dddot': '⃛',
	'\\breve': '̆',
	'\\bar': '̅',
	'\\vec': '⃗',
	'\\overleftarrow': '⃖',
	'\\overrightarrow': '⃗',
};

/** Accent characters that are aliases of a mapped one (macron == overline). */
export const ACCENT_ALIASES: Record<string, string> = {
	'̄': '̅',
	'^': '̂',
	'~': '̃',
	'¯': '̅',
};

// ── Delimiters (m:d) ─────────────────────────────────────────────────────────

/** LaTeX delimiter command -> the character stored in `m:begChr` / `m:endChr`. */
export const DELIM_MAP: Record<string, string> = {
	'\\{': '{',
	'\\}': '}',
	'\\lbrace': '{',
	'\\rbrace': '}',
	'\\langle': '⟨',
	'\\rangle': '⟩',
	'\\lfloor': '⌊',
	'\\rfloor': '⌋',
	'\\lceil': '⌈',
	'\\rceil': '⌉',
	'\\vert': '|',
	'\\lvert': '|',
	'\\rvert': '|',
	'\\|': '‖',
	'\\Vert': '‖',
	'\\lVert': '‖',
	'\\rVert': '‖',
};

/** Matrix environments -> the delimiter pair (empty for none). */
export const MATRIX_ENVS: Record<string, [string, string]> = {
	matrix: ['', ''],
	pmatrix: ['(', ')'],
	bmatrix: ['[', ']'],
	Bmatrix: ['{', '}'],
	vmatrix: ['|', '|'],
	Vmatrix: ['‖', '‖'],
	array: ['', ''],
};

/** Equation-array environments (aligned rows, `m:eqArr`). */
export const EQARR_ENVS = new Set([
	'aligned',
	'align',
	'align*',
	'gather',
	'gather*',
	'gathered',
	'eqnarray',
	'eqnarray*',
	'split',
]);

// ── Reverse maps (character -> LaTeX command) ────────────────────────────────

function invert(map: Record<string, string>): Record<string, string> {
	const reversed: Record<string, string> = {};
	for (const [cmd, ch] of Object.entries(map)) {
		if (!reversed[ch]) {
			reversed[ch] = cmd;
		}
	}
	return reversed;
}

export const REVERSE_GREEK = invert(GREEK_MAP);
export const REVERSE_OPERATOR = invert(OPERATOR_MAP);
export const REVERSE_NARY = invert(NARY_MAP);
export const REVERSE_ACCENT = invert(ACCENT_MAP);
export const REVERSE_DELIM = invert(DELIM_MAP);

/** Characters a run must escape so the LaTeX tokenizer treats them as text. */
export const REVERSE_ESCAPE: Record<string, string> = {
	'{': '\\{',
	'}': '\\}',
	_: '\\_',
	'^': '\\^',
	'%': '\\%',
	'#': '\\#',
	$: '\\$',
	' ': '\\ ',
	'\\': '\\backslash ',
};
