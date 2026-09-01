import type { Token } from './latex-omml-siblings';
/**
 * latex-to-omml-constructs: the LaTeX -> OMML construct builders for scripts,
 * n-ary operators, delimiters, function application and `\text{}`. Each takes
 * the parser context so it can pull its own arguments off the token stream.
 */
import { DELIM_MAP, ESCAPE_MAP, LIMIT_FUNC_NAMES, OPERATOR_MAP } from './latex-omml-symbols';
import type { OmmlNode } from './omml-to-mathml';

export interface LatexParserContext {
	peek: () => Token | undefined;
	next: () => Token | undefined;
	parseGroup: () => OmmlNode[];
	parseSingleOrGroup: () => OmmlNode[];
	parseAtom: () => OmmlNode | null;
	wrapE: (nodes: OmmlNode[]) => OmmlNode;
	makeRun: (text: string, normal?: boolean) => OmmlNode;
}

export interface ScriptArgs {
	sub: OmmlNode[];
	sup: OmmlNode[];
	hasSub: boolean;
	hasSup: boolean;
}

/** Consume up to one `_{...}` and one `^{...}` in either order (whitespace between is ignored). */
export function parseScriptArgs(ctx: LatexParserContext): ScriptArgs {
	const args: ScriptArgs = { sub: [], sup: [], hasSub: false, hasSup: false };
	for (let round = 0; round < 2; round++) {
		while (ctx.peek()?.type === 'whitespace') {
			ctx.next();
		}
		const tok = ctx.peek();
		if (tok?.type === 'superscript' && !args.hasSup) {
			ctx.next();
			args.sup = ctx.parseSingleOrGroup();
			args.hasSup = true;
		} else if (tok?.type === 'subscript' && !args.hasSub) {
			ctx.next();
			args.sub = ctx.parseSingleOrGroup();
			args.hasSub = true;
		}
	}
	return args;
}

/** Wrap `base` in sSub / sSup / sSubSup according to the parsed script args. */
export function applyScripts(ctx: LatexParserContext, base: OmmlNode, args: ScriptArgs): OmmlNode {
	if (args.hasSup && args.hasSub) {
		return {
			'm:sSubSup': {
				'm:e': ctx.wrapE([base]),
				'm:sub': ctx.wrapE(args.sub),
				'm:sup': ctx.wrapE(args.sup),
			} as unknown as OmmlNode,
		};
	}
	if (args.hasSup) {
		return {
			'm:sSup': {
				'm:e': ctx.wrapE([base]),
				'm:sup': ctx.wrapE(args.sup),
			} as unknown as OmmlNode,
		};
	}
	if (args.hasSub) {
		return {
			'm:sSub': {
				'm:e': ctx.wrapE([base]),
				'm:sub': ctx.wrapE(args.sub),
			} as unknown as OmmlNode,
		};
	}
	return base;
}

/** Try to parse trailing ^ and _ to wrap the base in superscript/subscript. */
export function tryParseScripts(ctx: LatexParserContext, base: OmmlNode): OmmlNode {
	return applyScripts(ctx, base, parseScriptArgs(ctx));
}

/** Parse an n-ary operator with optional `\limits`, sub/superscripts and body. */
export function parseNary(ctx: LatexParserContext, operatorChar: string): OmmlNode {
	let limLoc = '';
	const limTok = ctx.peek();
	if (
		limTok?.type === 'command' &&
		(limTok.value === '\\limits' || limTok.value === '\\nolimits')
	) {
		ctx.next();
		limLoc = limTok.value === '\\limits' ? 'undOvr' : 'subSup';
	}

	const { sub, sup, hasSub, hasSup } = parseScriptArgs(ctx);
	const body = ctx.parseSingleOrGroup();

	const naryPr: OmmlNode = {
		'm:chr': { '@_val': operatorChar } as unknown as OmmlNode,
	};
	if (limLoc) {
		naryPr['m:limLoc'] = { '@_val': limLoc } as unknown as OmmlNode;
	}
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

/** Read the delimiter character after `\left` / `\right` (`.` means none). */
function readDelimiterChar(tok: Token | undefined, fallback: string): string {
	if (!tok) {
		return fallback;
	}
	if (tok.type === 'command') {
		return DELIM_MAP[tok.value] ?? tok.value.slice(1);
	}
	if (tok.value === '.') {
		return '';
	}
	return tok.value;
}

/** Parse a \left...\right delimiter pair. */
export function parseDelimiter(ctx: LatexParserContext): OmmlNode {
	const openChar = readDelimiterChar(ctx.next(), '(');

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

	const closeChar = readDelimiterChar(ctx.next(), ')');

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

/**
 * Parse a function application like `\sin{x}`, `\sin^{2}{x}` or
 * `\lim_{x \to 0}{f}`. Limit-style names put a lone subscript beneath the
 * name (`m:limLow`), matching PowerPoint's own structure for a limit.
 */
export function parseFuncApplication(ctx: LatexParserContext, name: string): OmmlNode {
	const fNameNode = ctx.makeRun(name, true);
	const args = parseScriptArgs(ctx);
	let withScripts: OmmlNode;
	if (LIMIT_FUNC_NAMES.has(name) && args.hasSub !== args.hasSup) {
		const limit: OmmlNode = {
			'm:e': ctx.wrapE([fNameNode]),
			'm:lim': ctx.wrapE(args.hasSub ? args.sub : args.sup),
		};
		withScripts = args.hasSub ? { 'm:limLow': limit } : { 'm:limUpp': limit };
	} else {
		withScripts = applyScripts(ctx, fNameNode, args);
	}

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

/**
 * Read the raw text of a `\text{...}` argument, keeping spaces and mapping
 * escapes (`\{`, `\%`) and symbol commands back to their characters.
 */
export function parseTextArgument(ctx: LatexParserContext): string {
	if (ctx.peek()?.type !== 'group_start') {
		const tok = ctx.next();
		return tok ? tok.value : '';
	}
	ctx.next();
	let depth = 1;
	let text = '';
	while (ctx.peek()) {
		const tok = ctx.next()!;
		if (tok.type === 'group_start') {
			depth++;
		} else if (tok.type === 'group_end') {
			depth--;
			if (depth === 0) {
				break;
			}
		} else if (tok.type === 'command') {
			text += ESCAPE_MAP[tok.value] ?? OPERATOR_MAP[tok.value] ?? tok.value.slice(1);
			continue;
		}
		if (depth > 0 && tok.type !== 'group_start' && tok.type !== 'group_end') {
			text += tok.value;
		}
	}
	return text;
}
