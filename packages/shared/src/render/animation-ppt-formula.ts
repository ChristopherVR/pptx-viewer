/**
 * Pure evaluator for PowerPoint's `p:anim`/`p:tav` geometry-formula language
 * (ECMA-376 S19.5, seen on `from`/`to`/`by` attributes and `p:tav`/`p:tav@fmla`
 * values that target `ppt_x`/`ppt_y`/`ppt_w`/`ppt_h`).
 *
 * Grammar (a hand-rolled recursive-descent parser, no `eval`/`Function`):
 *
 * ```
 * expr    := term (('+' | '-') term)*
 * term    := power (('*' | '/') power)*
 * power   := unary ('^' power)?        // right-associative
 * unary   := ('-' | '+')? primary
 * primary := number | variable | call | '(' expr ')'
 * call    := name '(' expr (',' expr)* ')'
 * ```
 *
 * Variables: `$` (the sampled time/interpolation parameter), and
 * `ppt_x`/`ppt_y`/`ppt_w`/`ppt_h` (an optional leading `#` is accepted and
 * ignored, matching PowerPoint's own `#ppt_x` spelling), `pi`, `e`.
 * Functions: `abs sqrt sin cos tan atan min max` (`min`/`max` take 2+ args).
 *
 * See `animation-ppt-formula-ground-truth.md` for the real-PowerPoint samples
 * this grammar was derived from.
 *
 * @module render/animation-ppt-formula
 */

export type PptFormulaVars = Readonly<Record<string, number>>;

type TokenType = 'number' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma';

interface Token {
	type: TokenType;
	value: string;
}

const IDENT_RE = /^[#a-zA-Z_$][a-zA-Z0-9_]*/u;
const NUMBER_RE = /^\d+(\.\d+)?|^\.\d+/u;

function tokenize(formula: string): Token[] | undefined {
	const tokens: Token[] = [];
	let index = 0;
	const source = formula.trim();
	while (index < source.length) {
		const ch = source[index];
		if (ch === ' ' || ch === '\t') {
			index += 1;
			continue;
		}
		if (ch === '(') {
			tokens.push({ type: 'lparen', value: ch });
			index += 1;
			continue;
		}
		if (ch === ')') {
			tokens.push({ type: 'rparen', value: ch });
			index += 1;
			continue;
		}
		if (ch === ',') {
			tokens.push({ type: 'comma', value: ch });
			index += 1;
			continue;
		}
		if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
			tokens.push({ type: 'op', value: ch });
			index += 1;
			continue;
		}
		const rest = source.slice(index);
		const numberMatch = NUMBER_RE.exec(rest);
		if (numberMatch) {
			tokens.push({ type: 'number', value: numberMatch[0] });
			index += numberMatch[0].length;
			continue;
		}
		const identMatch = IDENT_RE.exec(rest);
		if (identMatch) {
			tokens.push({ type: 'ident', value: identMatch[0] });
			index += identMatch[0].length;
			continue;
		}
		return undefined;
	}
	return tokens;
}

const CONSTANTS: Readonly<Record<string, number>> = {
	e: Math.E,
	pi: Math.PI,
};

const FUNCTIONS: Readonly<Record<string, (args: number[]) => number | undefined>> = {
	abs: (args) => (args.length === 1 ? Math.abs(args[0]) : undefined),
	atan: (args) => (args.length === 1 ? Math.atan(args[0]) : undefined),
	cos: (args) => (args.length === 1 ? Math.cos(args[0]) : undefined),
	max: (args) => (args.length >= 2 ? Math.max(...args) : undefined),
	min: (args) => (args.length >= 2 ? Math.min(...args) : undefined),
	sin: (args) => (args.length === 1 ? Math.sin(args[0]) : undefined),
	sqrt: (args) => (args.length === 1 ? Math.sqrt(args[0]) : undefined),
	tan: (args) => (args.length === 1 ? Math.tan(args[0]) : undefined),
};

/** Recursive-descent parser producing a closure evaluator (no AST retained). */
class FormulaParser {
	private position = 0;

	public constructor(private readonly tokens: readonly Token[]) {}

	private peek(): Token | undefined {
		return this.tokens[this.position];
	}

	private consume(): Token | undefined {
		const token = this.tokens[this.position];
		this.position += 1;
		return token;
	}

	public parseExpr(vars: PptFormulaVars): number | undefined {
		const result = this.expr(vars);
		if (result === undefined || this.position !== this.tokens.length) {
			return undefined;
		}
		return result;
	}

	private expr(vars: PptFormulaVars): number | undefined {
		let value = this.term(vars);
		if (value === undefined) {
			return undefined;
		}
		for (;;) {
			const token = this.peek();
			if (!token || token.type !== 'op' || (token.value !== '+' && token.value !== '-')) {
				break;
			}
			this.consume();
			const rhs = this.term(vars);
			if (rhs === undefined) {
				return undefined;
			}
			value = token.value === '+' ? value + rhs : value - rhs;
		}
		return value;
	}

	// `term`/`unary`/`power` are ordered so unary minus binds LOOSER than `^`
	// (the conventional maths reading: `-2^2` is `-(2^2)` = -4, not `(-2)^2`),
	// while still allowing a signed exponent (`2^-3`) via `power`'s own call
	// into `unary` for its exponent operand.
	private term(vars: PptFormulaVars): number | undefined {
		let value = this.unary(vars);
		if (value === undefined) {
			return undefined;
		}
		for (;;) {
			const token = this.peek();
			if (!token || token.type !== 'op' || (token.value !== '*' && token.value !== '/')) {
				break;
			}
			this.consume();
			const rhs = this.unary(vars);
			if (rhs === undefined) {
				return undefined;
			}
			value = token.value === '*' ? value * rhs : value / rhs;
		}
		return value;
	}

	private unary(vars: PptFormulaVars): number | undefined {
		const token = this.peek();
		if (token && token.type === 'op' && (token.value === '-' || token.value === '+')) {
			this.consume();
			const value = this.unary(vars);
			if (value === undefined) {
				return undefined;
			}
			return token.value === '-' ? -value : value;
		}
		return this.power(vars);
	}

	private power(vars: PptFormulaVars): number | undefined {
		const base = this.primary(vars);
		if (base === undefined) {
			return undefined;
		}
		const token = this.peek();
		if (token && token.type === 'op' && token.value === '^') {
			this.consume();
			const exponent = this.unary(vars);
			if (exponent === undefined) {
				return undefined;
			}
			return base ** exponent;
		}
		return base;
	}

	private primary(vars: PptFormulaVars): number | undefined {
		const token = this.consume();
		if (!token) {
			return undefined;
		}
		if (token.type === 'number') {
			const parsed = Number(token.value);
			return Number.isFinite(parsed) ? parsed : undefined;
		}
		if (token.type === 'lparen') {
			const value = this.expr(vars);
			const closing = this.consume();
			if (value === undefined || !closing || closing.type !== 'rparen') {
				return undefined;
			}
			return value;
		}
		if (token.type === 'ident') {
			return this.identifier(token.value, vars);
		}
		return undefined;
	}

	private identifier(name: string, vars: PptFormulaVars): number | undefined {
		const next = this.peek();
		if (next && next.type === 'lparen') {
			return this.call(name, vars);
		}
		const normalized = name.replace(/^#/u, '').toLowerCase();
		if (normalized in vars) {
			return vars[normalized];
		}
		if (normalized in CONSTANTS) {
			return CONSTANTS[normalized];
		}
		return undefined;
	}

	private call(name: string, vars: PptFormulaVars): number | undefined {
		const fn = FUNCTIONS[name.toLowerCase()];
		this.consume(); // lparen
		const args: number[] = [];
		if (this.peek()?.type !== 'rparen') {
			for (;;) {
				const value = this.expr(vars);
				if (value === undefined) {
					return undefined;
				}
				args.push(value);
				const separator = this.peek();
				if (separator && separator.type === 'comma') {
					this.consume();
					continue;
				}
				break;
			}
		}
		const closing = this.consume();
		if (!closing || closing.type !== 'rparen') {
			return undefined;
		}
		return fn ? fn(args) : undefined;
	}
}

/**
 * Evaluate a PowerPoint animation geometry formula (`#ppt_x+0.1`,
 * `(#ppt_h/3+#ppt_w*0.1)`, `#ppt_y-sin(pi*$)/3`, ...) against a fixed set of
 * variables. Variable lookups are case-insensitive and a leading `#` on a
 * `ppt_*` token is optional. Returns `undefined` (never throws) on a syntax
 * error, an unknown identifier/function, a wrong function arity, or a
 * non-finite result (e.g. division by zero) so a caller can fall back rather
 * than animate to a garbage position.
 */
export function evaluatePptFormula(formula: string, vars: PptFormulaVars = {}): number | undefined {
	const tokens = tokenize(formula);
	if (!tokens || tokens.length === 0) {
		return undefined;
	}
	const parser = new FormulaParser(tokens);
	const lowered: Record<string, number> = {};
	for (const [key, value] of Object.entries(vars)) {
		lowered[key.toLowerCase()] = value;
	}
	const result = parser.parseExpr(lowered);
	return result !== undefined && Number.isFinite(result) ? result : undefined;
}

/** Canonical (lower-cased) variable names this module understands. */
export const PPT_FORMULA_GEOMETRY_VARS = ['ppt_x', 'ppt_y', 'ppt_w', 'ppt_h'] as const;
export type PptFormulaGeometryVar = (typeof PPT_FORMULA_GEOMETRY_VARS)[number];
