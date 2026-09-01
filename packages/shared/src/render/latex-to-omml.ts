/**
 * latex-to-omml: convert a subset of LaTeX math notation to Office Math
 * Markup Language (OMML) XML objects (fast-xml-parser shape).
 *
 * Framework-agnostic module behind every binding's equation editor: it turns
 * LaTeX input into an `equationXml` OMML tree (which
 * `EquationRenderer`/`omml-to-mathml` then render as MathML). The reverse
 * direction, `convertOmmlToLatex`, lives in `omml-to-latex.ts` and is
 * re-exported here so existing imports keep working.
 *
 * The produced OMML has the shape `{ "m:oMathPara": { "m:oMath": { … } } }`,
 * matching what the core shape-parsing pipeline stores as
 * `TextSegment.equationXml`.
 *
 * Symbol tables: `latex-omml-symbols.ts`. Tokenizer + sibling merging:
 * `latex-omml-siblings.ts`. Command dispatch: `latex-to-omml-commands.ts`.
 * Construct builders: `latex-to-omml-constructs.ts` and
 * `latex-to-omml-environments.ts`.
 */
import type { Token } from './latex-omml-siblings';
import { mergeSiblings, tokenize } from './latex-omml-siblings';
import { parseCommand } from './latex-to-omml-commands';
import type { LatexParserContext } from './latex-to-omml-constructs';
import { parseScriptArgs, tryParseScripts } from './latex-to-omml-constructs';
import { buildPrescript } from './latex-to-omml-environments';
import type { OmmlNode } from './omml-to-mathml';

export { convertOmmlToLatex } from './omml-to-latex';

// ── Parser ───────────────────────────────────────────────────────────────────

class LatexParser implements LatexParserContext {
	private tokens: Token[];
	private pos = 0;
	/** Set for one `parseAtom` call: the atom is a bare script argument and takes no scripts of its own. */
	private bare = false;

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
			const tok = this.peek()!;
			if (tok.type === 'command' && (tok.value === '\\atop' || tok.value === '\\over')) {
				// TeX primitives `{a \atop b}` / `{a \over b}`: the group so far
				// is the numerator, the rest of the group the denominator.
				this.next();
				const den = this.parseGroupRest();
				const frac: OmmlNode = { 'm:num': this.wrapE(nodes), 'm:den': this.wrapE(den) };
				if (tok.value === '\\atop') {
					frac['m:fPr'] = { 'm:type': { '@_val': 'noBar' } } as unknown as OmmlNode;
				}
				return [{ 'm:f': frac }];
			}
			const node = this.parseAtom();
			if (node) {
				nodes.push(node);
			}
		}
		this.expect('group_end');
		return nodes;
	}

	/** Parse atoms up to and including the closing brace of the current group. */
	private parseGroupRest(): OmmlNode[] {
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

	/**
	 * A braced group, or a single bare atom. A bare atom does not take its own
	 * scripts: in `x_i^2` the `^2` belongs to `x`, not to `i`.
	 */
	public parseSingleOrGroup(): OmmlNode[] {
		if (this.peek()?.type === 'group_start') {
			return this.parseGroup();
		}
		this.bare = true;
		const atom = this.parseAtom();
		this.bare = false;
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

		const bare = this.bare;
		this.bare = false;
		const scripted = (node: OmmlNode): OmmlNode => (bare ? node : tryParseScripts(this, node));

		if (tok.type === 'text') {
			this.next();
			return scripted(this.makeRun(tok.value));
		}

		if (tok.type === 'group_start') {
			const group = this.parseGroup();
			if (group.length === 0) {
				// `{}_{a}^{b}X` is the pre-sub/superscript idiom (m:sPre).
				const args = parseScriptArgs(this);
				if (args.hasSub || args.hasSup) {
					return buildPrescript(this, args.sub, args.sup);
				}
				return null;
			}
			const base = group.length === 1 ? group[0]! : this.wrapE(group);
			return scripted(base);
		}

		if (tok.type === 'command') {
			this.next();
			const node = parseCommand(this, tok.value);
			return node ? scripted(node) : null;
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

// ── Public API: LaTeX -> OMML ────────────────────────────────────────────────

/**
 * Convert a LaTeX math string into an OMML XML object (fast-xml-parser shape).
 *
 * The returned object has the shape `{ "m:oMathPara": { "m:oMath": { … } } }`,
 * matching what the core pipeline stores as `TextSegment.equationXml`.
 */
export function convertLatexToOmml(latex: string): Record<string, unknown> {
	// Trim surrounding whitespace, but keep a trailing `\ ` (escaped space run).
	const trimmed = latex.replace(/^\s+/u, '').replace(/(?<!\\)\s+$/u, '');
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
