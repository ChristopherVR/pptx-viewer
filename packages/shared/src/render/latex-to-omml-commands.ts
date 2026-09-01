/**
 * latex-to-omml-commands: dispatch one `\command` token to the OMML construct
 * it introduces (symbol, n-ary, accent, fraction, radical, text, delimiter,
 * environment, decoration, function application).
 */
import {
	ACCENT_MAP,
	ESCAPE_MAP,
	FUNC_NAMES,
	GREEK_MAP,
	NARY_MAP,
	OPERATOR_MAP,
} from './latex-omml-symbols';
import type { LatexParserContext } from './latex-to-omml-constructs';
import {
	parseDelimiter,
	parseFuncApplication,
	parseNary,
	parseTextArgument,
} from './latex-to-omml-constructs';
import {
	parseAccent,
	parseBar,
	parseBoxed,
	parseEnvironment,
	parseGroupChr,
	parseOperatorName,
	parsePhantom,
	parsePrescript,
	parseUnderOverset,
} from './latex-to-omml-environments';
import type { OmmlNode } from './omml-to-mathml';

/** `\frac{n}{d}` (+ `\dfrac`/`\tfrac`), `\sfrac` (linear) and `\binom` (no bar). */
function parseFraction(ctx: LatexParserContext, cmd: string): OmmlNode {
	const num = ctx.parseGroup();
	const den = ctx.parseGroup();
	const frac: OmmlNode = { 'm:num': ctx.wrapE(num), 'm:den': ctx.wrapE(den) };
	if (cmd === '\\sfrac' || cmd === '\\binom') {
		frac['m:fPr'] = {
			'm:type': { '@_val': cmd === '\\sfrac' ? 'lin' : 'noBar' },
		} as unknown as OmmlNode;
	}
	const node: OmmlNode = { 'm:f': frac };
	if (cmd === '\\binom') {
		return { 'm:d': { 'm:e': node } as unknown as OmmlNode };
	}
	return node;
}

/** `\sqrt{x}` and `\sqrt[n]{x}`. */
function parseRadical(ctx: LatexParserContext): OmmlNode {
	if (ctx.peek()?.type === 'text' && ctx.peek()?.value === '[') {
		ctx.next();
		const degree: OmmlNode[] = [];
		while (ctx.peek() && !(ctx.peek()!.type === 'text' && ctx.peek()!.value === ']')) {
			const atom = ctx.parseAtom();
			if (atom) {
				degree.push(atom);
			}
		}
		if (ctx.peek()?.value === ']') {
			ctx.next();
		}
		return {
			'm:rad': {
				'm:deg': ctx.wrapE(degree),
				'm:e': ctx.wrapE(ctx.parseGroup()),
			} as unknown as OmmlNode,
		};
	}
	return {
		'm:rad': {
			'm:radPr': { 'm:degHide': { '@_val': '1' } } as unknown as OmmlNode,
			'm:e': ctx.wrapE(ctx.parseGroup()),
		} as unknown as OmmlNode,
	};
}

/**
 * Build the construct for an already-consumed `\command` token. Returns null
 * for commands that produce no node of their own (`\right`, `\\`, `\limits`,
 * spacing that collapses to nothing, ...).
 */
export function parseCommand(ctx: LatexParserContext, cmd: string): OmmlNode | null {
	const symbol = GREEK_MAP[cmd] ?? OPERATOR_MAP[cmd] ?? ESCAPE_MAP[cmd];
	if (symbol !== undefined) {
		return symbol === '' ? null : ctx.makeRun(symbol);
	}
	if (NARY_MAP[cmd]) {
		return parseNary(ctx, NARY_MAP[cmd]);
	}
	if (ACCENT_MAP[cmd]) {
		return parseAccent(ctx, ACCENT_MAP[cmd]);
	}

	switch (cmd) {
		case '\\frac':
		case '\\dfrac':
		case '\\tfrac':
		case '\\sfrac':
		case '\\binom':
			return parseFraction(ctx, cmd);
		case '\\sqrt':
			return parseRadical(ctx);
		case '\\text':
		case '\\mathrm':
		case '\\textrm':
		case '\\mbox':
			return ctx.makeRun(parseTextArgument(ctx), true);
		case '\\operatorname':
			return parseOperatorName(ctx);
		case '\\left':
			return parseDelimiter(ctx);
		case '\\right':
		case '\\\\':
		case '\\limits':
		case '\\nolimits':
		case '\\displaystyle':
		case '\\textstyle':
			return null;
		case '\\begin':
			return parseEnvironment(ctx);
		case '\\end':
			parseTextArgument(ctx);
			return null;
		case '\\overline':
			return parseBar(ctx, 'top');
		case '\\underline':
			return parseBar(ctx, 'bot');
		case '\\overbrace':
			return parseGroupChr(ctx, '⏞', 'top');
		case '\\underbrace':
			return parseGroupChr(ctx, '⏟', 'bot');
		case '\\overset':
			return parseUnderOverset(ctx, 'm:limUpp');
		case '\\underset':
			return parseUnderOverset(ctx, 'm:limLow');
		case '\\boxed':
			return parseBoxed(ctx);
		case '\\phantom':
			return parsePhantom(ctx, 'full');
		case '\\hphantom':
			return parsePhantom(ctx, 'h');
		case '\\vphantom':
			return parsePhantom(ctx, 'v');
		case '\\prescript':
			return parsePrescript(ctx);
		default:
			break;
	}

	const funcName = cmd.slice(1);
	if (FUNC_NAMES.has(funcName)) {
		return parseFuncApplication(ctx, funcName);
	}
	return ctx.makeRun(funcName, true);
}
