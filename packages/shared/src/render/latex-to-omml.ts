/**
 * latex-to-omml — convert a subset of LaTeX math notation to/from Office Math
 * Markup Language (OMML) XML objects (fast-xml-parser shape).
 *
 * Vue-local port of the React package's `latex-to-omml-*` utilities
 * (constants + constructs + parser + reverse), consolidated into one
 * framework-agnostic module so the equation editor can turn LaTeX input into an
 * `equationXml` OMML tree (which `EquationRenderer`/`omml-to-mathml` then render
 * as MathML) and seed the textarea from an existing equation.
 *
 * The produced OMML has the shape `{ "m:oMathPara": { "m:oMath": { … } } }`,
 * matching what the core shape-parsing pipeline stores as
 * `TextSegment.equationXml`.
 */
import { orderedXmlKey, stripXmlOrderSuffix } from 'pptx-viewer-core';

import type { OmmlNode } from './omml-to-mathml';

// ── Greek letter map ─────────────────────────────────────────────────────────

const GREEK_MAP: Record<string, string> = {
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

// ── Operator map ─────────────────────────────────────────────────────────────

const OPERATOR_MAP: Record<string, string> = {
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
	'\\Rightarrow': '⇒',
	'\\Leftarrow': '⇐',
	'\\infty': '∞',
	'\\partial': '∂',
	'\\nabla': '∇',
	'\\forall': '∀',
	'\\exists': '∃',
	'\\ldots': '…',
	'\\cdots': '⋯',
	'\\le': '≤',
	'\\ge': '≥',
	'\\ne': '≠',
};

// ── Nary operators ───────────────────────────────────────────────────────────

const NARY_MAP: Record<string, string> = {
	'\\sum': '∑',
	'\\prod': '∏',
	'\\int': '∫',
	'\\iint': '∬',
	'\\iiint': '∭',
	'\\oint': '∮',
	'\\coprod': '∐',
	'\\bigcup': '⋃',
	'\\bigcap': '⋂',
};

// ── Known function names ─────────────────────────────────────────────────────

const FUNC_NAMES = new Set([
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

// ── Tokenizer ────────────────────────────────────────────────────────────────

interface Token {
	type:
		| 'command'
		| 'text'
		| 'group_start'
		| 'group_end'
		| 'superscript'
		| 'subscript'
		| 'whitespace';
	value: string;
}

const LETTER_RE = /[a-zA-Z]/u;
const WHITESPACE_RE = /\s/u;

function tokenize(latex: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	while (i < latex.length) {
		const ch = latex[i];
		if (ch === '{') {
			tokens.push({ type: 'group_start', value: '{' });
			i++;
		} else if (ch === '}') {
			tokens.push({ type: 'group_end', value: '}' });
			i++;
		} else if (ch === '^') {
			tokens.push({ type: 'superscript', value: '^' });
			i++;
		} else if (ch === '_') {
			tokens.push({ type: 'subscript', value: '_' });
			i++;
		} else if (ch === '\\') {
			let cmd = '\\';
			i++;
			if (i < latex.length && LETTER_RE.test(latex[i]!)) {
				while (i < latex.length && LETTER_RE.test(latex[i]!)) {
					cmd += latex[i];
					i++;
				}
			} else if (i < latex.length) {
				cmd += latex[i];
				i++;
			}
			tokens.push({ type: 'command', value: cmd });
		} else if (WHITESPACE_RE.test(ch!)) {
			i++;
			tokens.push({ type: 'whitespace', value: ' ' });
		} else {
			tokens.push({ type: 'text', value: ch! });
			i++;
		}
	}
	return tokens;
}

// ── Sibling merging ──────────────────────────────────────────────────────────

/**
 * True when merging the sibling entries into one tag-keyed object keeps their
 * visual order. fast-xml-parser's collapsed shape stores same-tag siblings as
 * an array under one key and distinct tags under separate keys, so a walker
 * iterating `Object.keys` re-emits the sequence grouped by tag in
 * first-appearance order. That equals the original order only while each
 * tag's occurrences are contiguous (e.g. `r r sSup` survives, `sSup r sSup`
 * does not: the runs would migrate to the end, turning a^2+b^2 into a2b2+).
 */
function isGroupedByTag(tags: string[]): boolean {
	const seen = new Set<string>();
	let previous = '';
	for (const tag of tags) {
		if (tag !== previous && seen.has(tag)) {
			return false;
		}
		seen.add(tag);
		previous = tag;
	}
	return true;
}

/**
 * Merge parsed sibling nodes into a single OMML container object.
 *
 * When tags interleave (`m:sSup`, `m:r`, `m:sSup`, ... for a^2+b^2=c^2), the
 * collapsed tag-keyed shape cannot represent the sibling order under plain
 * keys, so repeated tags get position-marked keys (`m:r#pptx-order-1`, via
 * core's `orderedXmlKey`): object insertion order then carries the true
 * sequence. This is the same convention core's load pipeline applies to real
 * decks (`omml-sibling-order.ts`), and core's save-side XMLBuilder strips the
 * markers from emitted tag names, so the serialized OOXML is the natural
 * interleaved sequence PowerPoint itself writes. Grouped-by-tag sequences
 * keep the compact merged shape.
 */
function mergeSiblings(nodes: OmmlNode[]): OmmlNode {
	const entries: Array<[string, OmmlNode[keyof OmmlNode]]> = [];
	for (const node of nodes) {
		for (const key of Object.keys(node)) {
			if (node[key] !== undefined) {
				entries.push([key, node[key]]);
			}
		}
	}

	if (!isGroupedByTag(entries.map(([key]) => key))) {
		const counts = new Map<string, number>();
		for (const [key] of entries) {
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		const ordered: OmmlNode = {};
		for (const [position, [key, value]] of entries.entries()) {
			ordered[(counts.get(key) ?? 0) > 1 ? orderedXmlKey(key, position) : key] = value;
		}
		return ordered;
	}

	const result: OmmlNode = {};
	for (const [key, value] of entries) {
		if (result[key]) {
			const existing = result[key];
			if (Array.isArray(existing)) {
				(existing as OmmlNode[]).push(value as OmmlNode);
			} else {
				result[key] = [existing as OmmlNode, value as OmmlNode];
			}
		} else {
			result[key] = value;
		}
	}
	return result;
}

// ── Construct helpers ────────────────────────────────────────────────────────

interface LatexParserContext {
	peek: () => Token | undefined;
	next: () => Token | undefined;
	parseGroup: () => OmmlNode[];
	parseSingleOrGroup: () => OmmlNode[];
	parseAtom: () => OmmlNode | null;
	wrapE: (nodes: OmmlNode[]) => OmmlNode;
	makeRun: (text: string, normal?: boolean) => OmmlNode;
}

/** Try to parse trailing ^ and _ to wrap the base in superscript/subscript. */
function tryParseScripts(ctx: LatexParserContext, base: OmmlNode): OmmlNode {
	let hasSup = false;
	let hasSub = false;
	let sup: OmmlNode[] = [];
	let sub: OmmlNode[] = [];

	for (let round = 0; round < 2; round++) {
		const tok = ctx.peek();
		if (tok?.type === 'superscript' && !hasSup) {
			ctx.next();
			sup = ctx.parseSingleOrGroup();
			hasSup = true;
		} else if (tok?.type === 'subscript' && !hasSub) {
			ctx.next();
			sub = ctx.parseSingleOrGroup();
			hasSub = true;
		}
	}

	if (hasSup && hasSub) {
		return {
			'm:sSubSup': {
				'm:e': ctx.wrapE([base]),
				'm:sub': ctx.wrapE(sub),
				'm:sup': ctx.wrapE(sup),
			} as unknown as OmmlNode,
		};
	}
	if (hasSup) {
		return {
			'm:sSup': {
				'm:e': ctx.wrapE([base]),
				'm:sup': ctx.wrapE(sup),
			} as unknown as OmmlNode,
		};
	}
	if (hasSub) {
		return {
			'm:sSub': {
				'm:e': ctx.wrapE([base]),
				'm:sub': ctx.wrapE(sub),
			} as unknown as OmmlNode,
		};
	}
	return base;
}

/** Parse an n-ary operator with optional sub/superscripts and body. */
function parseNary(ctx: LatexParserContext, operatorChar: string): OmmlNode {
	let sub: OmmlNode[] = [];
	let sup: OmmlNode[] = [];
	let hasSub = false;
	let hasSup = false;

	for (let round = 0; round < 2; round++) {
		const tok = ctx.peek();
		if (tok?.type === 'subscript' && !hasSub) {
			ctx.next();
			sub = ctx.parseSingleOrGroup();
			hasSub = true;
		} else if (tok?.type === 'superscript' && !hasSup) {
			ctx.next();
			sup = ctx.parseSingleOrGroup();
			hasSup = true;
		}
	}

	const body = ctx.parseSingleOrGroup();

	const naryPr: OmmlNode = {
		'm:chr': { '@_val': operatorChar } as unknown as OmmlNode,
	};
	if (!hasSub) {
		naryPr['m:subHide'] = { '@_val': '1' } as unknown as OmmlNode;
	}
	if (!hasSup) {
		naryPr['m:supHide'] = { '@_val': '1' } as unknown as OmmlNode;
	}

	return {
		'm:nary': {
			'm:naryPr': naryPr,
			'm:sub': hasSub ? ctx.wrapE(sub) : {},
			'm:sup': hasSup ? ctx.wrapE(sup) : {},
			'm:e': ctx.wrapE(body),
		} as unknown as OmmlNode,
	};
}

/** Parse a \left...\right delimiter pair. */
function parseDelimiter(ctx: LatexParserContext): OmmlNode {
	const openTok = ctx.next();
	const openChar = openTok?.value === '.' ? '' : (openTok?.value ?? '(');

	const inner: OmmlNode[] = [];
	while (ctx.peek()) {
		if (ctx.peek()!.type === 'command' && ctx.peek()!.value === '\\right') {
			ctx.next();
			break;
		}
		const node = ctx.parseAtom();
		if (node) {
			inner.push(node);
		}
	}

	const closeTok = ctx.next();
	const closeChar = closeTok?.value === '.' ? '' : (closeTok?.value ?? ')');

	const dPr: OmmlNode = {};
	if (openChar !== '(') {
		dPr['m:begChr'] = { '@_val': openChar } as unknown as OmmlNode;
	}
	if (closeChar !== ')') {
		dPr['m:endChr'] = { '@_val': closeChar } as unknown as OmmlNode;
	}

	return {
		'm:d': {
			'm:dPr': Object.keys(dPr).length > 0 ? dPr : undefined,
			'm:e': ctx.wrapE(inner),
		} as unknown as OmmlNode,
	};
}

/** Parse a function application like \sin{x} or \lim_{x \to 0}. */
function parseFuncApplication(ctx: LatexParserContext, name: string): OmmlNode {
	const fNameNode = ctx.makeRun(name, true);
	const withScripts = tryParseScripts(ctx, fNameNode);

	let body: OmmlNode[] = [];
	if (ctx.peek()?.type === 'group_start') {
		body = ctx.parseGroup();
	} else if (ctx.peek() && ctx.peek()!.type !== 'group_end') {
		const atom = ctx.parseAtom();
		if (atom) {
			body = [atom];
		}
	}

	if (body.length === 0) {
		return withScripts;
	}

	return {
		'm:func': {
			'm:fName': ctx.wrapE([withScripts]),
			'm:e': ctx.wrapE(body),
		} as unknown as OmmlNode,
	};
}

// ── Parser ───────────────────────────────────────────────────────────────────

class LatexParser implements LatexParserContext {
	private tokens: Token[];
	private pos = 0;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
	}

	public peek(): Token | undefined {
		return this.tokens[this.pos];
	}

	public next(): Token | undefined {
		return this.tokens[this.pos++];
	}

	private expect(type: Token['type']): Token {
		const tok = this.next();
		if (!tok || tok.type !== type) {
			throw new Error(`Expected ${type}, got ${tok?.type ?? 'EOF'}`);
		}
		return tok;
	}

	public parseGroup(): OmmlNode[] {
		this.expect('group_start');
		const nodes: OmmlNode[] = [];
		while (this.peek() && this.peek()!.type !== 'group_end') {
			const node = this.parseAtom();
			if (node) {
				nodes.push(node);
			}
		}
		this.expect('group_end');
		return nodes;
	}

	public parseSingleOrGroup(): OmmlNode[] {
		if (this.peek()?.type === 'group_start') {
			return this.parseGroup();
		}
		const atom = this.parseAtom();
		return atom ? [atom] : [];
	}

	public wrapE(nodes: OmmlNode[]): OmmlNode {
		// A single node passes through unchanged: it may itself be a merged
		// container whose keys carry `#pptx-order-N` markers, which a fixed
		// key-name copy would silently drop.
		if (nodes.length === 1) {
			return nodes[0]!;
		}
		return mergeSiblings(nodes);
	}

	public makeRun(text: string, normal = false): OmmlNode {
		const run: OmmlNode = { 'm:t': text };
		if (normal) {
			run['m:rPr'] = { 'm:nor': { '@_val': '1' } } as unknown as OmmlNode;
		}
		return { 'm:r': run };
	}

	public parseAtom(): OmmlNode | null {
		const tok = this.peek();
		if (!tok) {
			return null;
		}

		if (tok.type === 'whitespace') {
			this.next();
			return this.parseAtom();
		}

		if (tok.type === 'text') {
			this.next();
			const base = this.makeRun(tok.value);
			return tryParseScripts(this, base);
		}

		if (tok.type === 'group_start') {
			const group = this.parseGroup();
			if (group.length === 0) {
				return null;
			}
			const base = group.length === 1 ? group[0]! : this.wrapE(group);
			return tryParseScripts(this, base);
		}

		if (tok.type === 'command') {
			this.next();
			const cmd = tok.value;

			if (GREEK_MAP[cmd]) {
				const base = this.makeRun(GREEK_MAP[cmd]);
				return tryParseScripts(this, base);
			}

			if (OPERATOR_MAP[cmd]) {
				return this.makeRun(OPERATOR_MAP[cmd]);
			}

			if (NARY_MAP[cmd]) {
				return parseNary(this, NARY_MAP[cmd]);
			}

			if (cmd === '\\frac') {
				const num = this.parseGroup();
				const den = this.parseGroup();
				const frac: OmmlNode = {
					'm:f': {
						'm:num': this.wrapE(num),
						'm:den': this.wrapE(den),
					} as unknown as OmmlNode,
				};
				return tryParseScripts(this, frac);
			}

			if (cmd === '\\sqrt') {
				if (this.peek()?.type === 'text' && this.peek()?.value === '[') {
					this.next();
					let degree = '';
					while (this.peek() && !(this.peek()!.type === 'text' && this.peek()!.value === ']')) {
						degree += this.next()!.value;
					}
					if (this.peek()?.value === ']') {
						this.next();
					}
					const body = this.parseGroup();
					const rad: OmmlNode = {
						'm:rad': {
							'm:deg': this.wrapE([this.makeRun(degree)]),
							'm:e': this.wrapE(body),
						} as unknown as OmmlNode,
					};
					return tryParseScripts(this, rad);
				}
				const body = this.parseGroup();
				const rad: OmmlNode = {
					'm:rad': {
						'm:radPr': { 'm:degHide': { '@_val': '1' } } as unknown as OmmlNode,
						'm:e': this.wrapE(body),
					} as unknown as OmmlNode,
				};
				return tryParseScripts(this, rad);
			}

			if (cmd === '\\text') {
				const textNodes = this.parseGroup();
				const text = textNodes
					.map((n) => {
						const r = n['m:r'] as OmmlNode | undefined;
						return r ? String(r['m:t'] ?? '') : '';
					})
					.join('');
				return this.makeRun(text, true);
			}

			if (cmd === '\\left') {
				return parseDelimiter(this);
			}
			if (cmd === '\\right') {
				return null;
			}

			const funcName = cmd.slice(1);
			if (FUNC_NAMES.has(funcName)) {
				return parseFuncApplication(this, funcName);
			}

			const base = this.makeRun(cmd.slice(1), true);
			return tryParseScripts(this, base);
		}

		if (tok.type === 'superscript' || tok.type === 'subscript') {
			this.next();
			const arg = this.parseSingleOrGroup();
			const empty = this.makeRun('');
			if (tok.type === 'superscript') {
				return {
					'm:sSup': {
						'm:e': this.wrapE([empty]),
						'm:sup': this.wrapE(arg),
					} as unknown as OmmlNode,
				};
			}
			return {
				'm:sSub': {
					'm:e': this.wrapE([empty]),
					'm:sub': this.wrapE(arg),
				} as unknown as OmmlNode,
			};
		}

		return null;
	}

	public parseAll(): OmmlNode[] {
		const nodes: OmmlNode[] = [];
		while (this.peek()) {
			const node = this.parseAtom();
			if (node) {
				nodes.push(node);
			}
		}
		return nodes;
	}
}

// ── Public API: LaTeX → OMML ─────────────────────────────────────────────────

/**
 * Convert a LaTeX math string into an OMML XML object (fast-xml-parser shape).
 *
 * The returned object has the shape `{ "m:oMathPara": { "m:oMath": { … } } }`,
 * matching what the core pipeline stores as `TextSegment.equationXml`.
 */
export function convertLatexToOmml(latex: string): Record<string, unknown> {
	const trimmed = latex.trim();
	if (trimmed.length === 0) {
		return {};
	}

	const tokens = tokenize(trimmed);
	const parser = new LatexParser(tokens);
	const nodes = parser.parseAll();

	if (nodes.length === 0) {
		return {};
	}

	const oMath = mergeSiblings(nodes);

	return {
		'm:oMathPara': {
			'm:oMath': oMath,
		},
	};
}

// ── Public API: OMML → LaTeX (best-effort reverse) ───────────────────────────

const REVERSE_GREEK: Record<string, string> = {};
for (const [cmd, ch] of Object.entries(GREEK_MAP)) {
	REVERSE_GREEK[ch] = cmd;
}

const REVERSE_OPERATOR: Record<string, string> = {};
for (const [cmd, ch] of Object.entries(OPERATOR_MAP)) {
	if (!REVERSE_OPERATOR[ch]) {
		REVERSE_OPERATOR[ch] = cmd;
	}
}

const REVERSE_NARY: Record<string, string> = {};
for (const [cmd, ch] of Object.entries(NARY_MAP)) {
	if (!REVERSE_NARY[ch]) {
		REVERSE_NARY[ch] = cmd;
	}
}

function ensureArr(val: unknown): Array<Record<string, unknown>> {
	if (val === undefined || val === null) {
		return [];
	}
	if (Array.isArray(val)) {
		return val as Array<Record<string, unknown>>;
	}
	if (typeof val === 'object') {
		return [val as Record<string, unknown>];
	}
	return [];
}

function childNode(
	node: Record<string, unknown> | undefined,
	key: string,
): Record<string, unknown> {
	if (!node) {
		return {};
	}
	const v = node[key];
	if (v && typeof v === 'object' && !Array.isArray(v)) {
		return v as Record<string, unknown>;
	}
	return {};
}

function attrVal(node: Record<string, unknown> | undefined): string {
	if (!node) {
		return '';
	}
	const v = node['@_val'];
	if (typeof v === 'string') {
		return v;
	}
	return v !== undefined ? String(v) : '';
}

function ommlChildrenToLatex(node: Record<string, unknown> | undefined): string {
	if (!node || typeof node !== 'object') {
		return '';
	}
	const parts: string[] = [];

	for (const key of Object.keys(node)) {
		if (key.startsWith('@_')) {
			continue;
		}
		// Keys may carry `#pptx-order-N` position markers (interleaved sibling
		// sequences); strip them before dispatching on the tag name.
		const tag = stripXmlOrderSuffix(key);
		const items = ensureArr(node[key]);
		for (const item of items) {
			const result = ommlElementToLatex(tag, item);
			if (result) {
				parts.push(result);
			}
		}
	}

	return parts.join('');
}

function ommlElementToLatex(tag: string, node: Record<string, unknown>): string {
	switch (tag) {
		case 'm:r': {
			let text = '';
			if (typeof node['m:t'] === 'string') {
				text = node['m:t'];
			} else if (node['m:t'] !== undefined) {
				text = String(node['m:t']);
			}
			if (text.length === 0) {
				return '';
			}
			if (REVERSE_GREEK[text]) {
				return `${REVERSE_GREEK[text]} `;
			}
			if (REVERSE_OPERATOR[text]) {
				return `${REVERSE_OPERATOR[text]} `;
			}
			const rPr = childNode(node, 'm:rPr');
			const norVal = attrVal(childNode(rPr, 'm:nor'));
			if (norVal === '1' || norVal === 'on' || norVal === 'true') {
				return `\\text{${text}}`;
			}
			return text;
		}
		case 'm:f': {
			const num = ommlChildrenToLatex(childNode(node, 'm:num'));
			const den = ommlChildrenToLatex(childNode(node, 'm:den'));
			return `\\frac{${num}}{${den}}`;
		}
		case 'm:rad': {
			const radPr = childNode(node, 'm:radPr');
			const degHide = attrVal(childNode(radPr, 'm:degHide'));
			const base = ommlChildrenToLatex(childNode(node, 'm:e'));
			if (degHide === '1' || degHide === 'on' || degHide === 'true') {
				return `\\sqrt{${base}}`;
			}
			const deg = ommlChildrenToLatex(childNode(node, 'm:deg'));
			if (deg) {
				return `\\sqrt[${deg}]{${base}}`;
			}
			return `\\sqrt{${base}}`;
		}
		case 'm:sSup': {
			const base = ommlChildrenToLatex(childNode(node, 'm:e'));
			const sup = ommlChildrenToLatex(childNode(node, 'm:sup'));
			return `${base}^{${sup}}`;
		}
		case 'm:sSub': {
			const base = ommlChildrenToLatex(childNode(node, 'm:e'));
			const sub = ommlChildrenToLatex(childNode(node, 'm:sub'));
			return `${base}_{${sub}}`;
		}
		case 'm:sSubSup': {
			const base = ommlChildrenToLatex(childNode(node, 'm:e'));
			const sub = ommlChildrenToLatex(childNode(node, 'm:sub'));
			const sup = ommlChildrenToLatex(childNode(node, 'm:sup'));
			return `${base}_{${sub}}^{${sup}}`;
		}
		case 'm:nary': {
			const naryPr = childNode(node, 'm:naryPr');
			const chrVal = attrVal(childNode(naryPr, 'm:chr'));
			const operatorCmd = REVERSE_NARY[chrVal] ?? '\\int';
			const subHide = attrVal(childNode(naryPr, 'm:subHide'));
			const supHide = attrVal(childNode(naryPr, 'm:supHide'));
			const sub = ommlChildrenToLatex(childNode(node, 'm:sub'));
			const sup = ommlChildrenToLatex(childNode(node, 'm:sup'));
			const body = ommlChildrenToLatex(childNode(node, 'm:e'));
			let result = operatorCmd;
			if (sub && subHide !== '1') {
				result += `_{${sub}}`;
			}
			if (sup && supHide !== '1') {
				result += `^{${sup}}`;
			}
			result += `{${body}}`;
			return result;
		}
		case 'm:d': {
			const dPr = childNode(node, 'm:dPr');
			const begChr = attrVal(childNode(dPr, 'm:begChr')) || '(';
			const endChr = attrVal(childNode(dPr, 'm:endChr')) || ')';
			const inner = ommlChildrenToLatex(childNode(node, 'm:e'));
			return `\\left${begChr}${inner}\\right${endChr}`;
		}
		case 'm:func': {
			const fName = ommlChildrenToLatex(childNode(node, 'm:fName'));
			const body = ommlChildrenToLatex(childNode(node, 'm:e'));
			return `${fName}{${body}}`;
		}
		case 'm:box':
		case 'm:borderBox': {
			// Transparent grouping containers: emit the boxed content in place
			// (mergeSiblings emits per-sibling boxes to preserve ordering).
			return ensureArr(node['m:e'])
				.map((e) => ommlChildrenToLatex(e))
				.join('');
		}
		case 'm:oMath':
			return ommlChildrenToLatex(node);
		default:
			return '';
	}
}

/**
 * Best-effort reverse-convert an OMML node back to LaTeX for editing. Complex
 * equations may not round-trip perfectly.
 */
export function convertOmmlToLatex(omml: Record<string, unknown>): string {
	if (!omml || typeof omml !== 'object') {
		return '';
	}

	let oMath: Record<string, unknown> | undefined;
	const para = omml['m:oMathPara'] as Record<string, unknown> | undefined;
	if (para?.['m:oMath']) {
		oMath = para['m:oMath'] as Record<string, unknown>;
	} else if (omml['m:oMath']) {
		oMath = omml['m:oMath'] as Record<string, unknown>;
	} else {
		oMath = omml;
	}

	return ommlChildrenToLatex(oMath);
}
