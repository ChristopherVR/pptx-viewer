/**
 * latex-to-omml-environments: LaTeX -> OMML builders for the layout constructs
 * beyond scripts and fractions: matrix / equation-array environments, accents,
 * bars, group characters, under/overset limits, boxes, phantoms and
 * pre-scripts. Every construct the `omml-to-mathml` renderer understands has a
 * LaTeX spelling here so `omml-to-latex` can round-trip it losslessly.
 */
import { EQARR_ENVS, MATRIX_ENVS } from './latex-omml-symbols';
import type { LatexParserContext } from './latex-to-omml-constructs';
import {
	applyScripts,
	parseFuncApplication,
	parseScriptArgs,
	parseTextArgument,
} from './latex-to-omml-constructs';
import type { OmmlNode } from './omml-to-mathml';

function valNode(value: string): OmmlNode {
	return { '@_val': value } as unknown as OmmlNode;
}

/** Wrap `inner` in an `m:d` with the given (possibly empty) delimiters. */
export function wrapDelimited(
	ctx: LatexParserContext,
	inner: OmmlNode,
	open: string,
	close: string,
): OmmlNode {
	const dPr: OmmlNode = {};
	if (open !== '(') {
		dPr['m:begChr'] = valNode(open);
	}
	if (close !== ')') {
		dPr['m:endChr'] = valNode(close);
	}
	return {
		'm:d': {
			'm:dPr': Object.keys(dPr).length > 0 ? dPr : undefined,
			'm:e': ctx.wrapE([inner]),
		} as unknown as OmmlNode,
	};
}

// ── Environments ─────────────────────────────────────────────────────────────

/** Read the `{name}` argument of `\begin` / `\end` as a plain string. */
function readEnvName(ctx: LatexParserContext): string {
	return parseTextArgument(ctx).trim();
}

/** Split the body of an environment into rows of cells at `\\` and `&`. */
function parseEnvBody(ctx: LatexParserContext): OmmlNode[][][] {
	const rows: OmmlNode[][][] = [];
	let row: OmmlNode[][] = [];
	let cell: OmmlNode[] = [];
	while (ctx.peek()) {
		const tok = ctx.peek()!;
		if (tok.type === 'command' && tok.value === '\\end') {
			ctx.next();
			readEnvName(ctx);
			break;
		}
		if (tok.type === 'command' && tok.value === '\\\\') {
			ctx.next();
			row.push(cell);
			rows.push(row);
			row = [];
			cell = [];
			continue;
		}
		if (tok.type === 'text' && tok.value === '&') {
			ctx.next();
			row.push(cell);
			cell = [];
			continue;
		}
		const atom = ctx.parseAtom();
		if (atom) {
			cell.push(atom);
		}
	}
	if (cell.length > 0 || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}
	return rows;
}

function buildMatrix(ctx: LatexParserContext, rows: OmmlNode[][][]): OmmlNode {
	return {
		'm:m': {
			'm:mr': rows.map((cells) => ({
				'm:e': cells.map((cell) => ctx.wrapE(cell)),
			})),
		} as unknown as OmmlNode,
	};
}

function buildEqArr(ctx: LatexParserContext, rows: OmmlNode[][][]): OmmlNode {
	// Alignment marks (`&`) are literal characters inside OMML equation-array
	// rows, so cells re-join around a `&` run.
	const lines = rows.map((cells) => {
		const nodes: OmmlNode[] = [];
		cells.forEach((cell, index) => {
			if (index > 0) {
				nodes.push(ctx.makeRun('&'));
			}
			nodes.push(...cell);
		});
		return ctx.wrapE(nodes);
	});
	return { 'm:eqArr': { 'm:e': lines } as unknown as OmmlNode };
}

/** Parse `\begin{env} ... \end{env}` into a matrix, delimited matrix, eqArr or cases. */
export function parseEnvironment(ctx: LatexParserContext): OmmlNode | null {
	const name = readEnvName(ctx);
	if (name === 'array' && ctx.peek()?.type === 'group_start') {
		parseTextArgument(ctx);
	}
	const rows = parseEnvBody(ctx);

	const matrixDelims = MATRIX_ENVS[name];
	if (matrixDelims) {
		const matrix = buildMatrix(ctx, rows);
		const [open, close] = matrixDelims;
		return open || close ? wrapDelimited(ctx, matrix, open, close) : matrix;
	}
	if (name === 'cases') {
		return wrapDelimited(ctx, buildEqArr(ctx, rows), '{', '');
	}
	if (EQARR_ENVS.has(name) || rows.length > 1) {
		return buildEqArr(ctx, rows);
	}
	const inline = rows.flat(2);
	return inline.length > 0 ? ctx.wrapE(inline) : null;
}

// ── Single-argument wrappers ─────────────────────────────────────────────────

/** `\hat{x}` and friends: `m:acc` with the combining character in `m:chr`. */
export function parseAccent(ctx: LatexParserContext, chr: string): OmmlNode {
	return {
		'm:acc': {
			'm:accPr': { 'm:chr': valNode(chr) },
			'm:e': ctx.wrapE(ctx.parseSingleOrGroup()),
		} as unknown as OmmlNode,
	};
}

/** `\overline{x}` / `\underline{x}`: `m:bar` with an explicit position. */
export function parseBar(ctx: LatexParserContext, pos: 'top' | 'bot'): OmmlNode {
	return {
		'm:bar': {
			'm:barPr': { 'm:pos': valNode(pos) },
			'm:e': ctx.wrapE(ctx.parseSingleOrGroup()),
		} as unknown as OmmlNode,
	};
}

/**
 * `\underbrace{x}_{n}` / `\overbrace{x}^{n}`: `m:groupChr`, wrapped in
 * `m:limLow` / `m:limUpp` when a label follows on the matching side.
 */
export function parseGroupChr(ctx: LatexParserContext, chr: string, pos: 'top' | 'bot'): OmmlNode {
	const groupChrPr: OmmlNode = { 'm:chr': valNode(chr) };
	if (pos === 'top') {
		groupChrPr['m:pos'] = valNode('top');
	}
	const group: OmmlNode = {
		'm:groupChr': {
			'm:groupChrPr': groupChrPr,
			'm:e': ctx.wrapE(ctx.parseSingleOrGroup()),
		} as unknown as OmmlNode,
	};
	const args = parseScriptArgs(ctx);
	if (pos === 'bot' && args.hasSub && !args.hasSup) {
		return { 'm:limLow': { 'm:e': group, 'm:lim': ctx.wrapE(args.sub) } as unknown as OmmlNode };
	}
	if (pos === 'top' && args.hasSup && !args.hasSub) {
		return { 'm:limUpp': { 'm:e': group, 'm:lim': ctx.wrapE(args.sup) } as unknown as OmmlNode };
	}
	return applyScripts(ctx, group, args);
}

/** `\underset{lim}{base}` -> `m:limLow`; `\overset{lim}{base}` -> `m:limUpp`. */
export function parseUnderOverset(ctx: LatexParserContext, tag: 'm:limLow' | 'm:limUpp'): OmmlNode {
	const lim = ctx.parseSingleOrGroup();
	const base = ctx.parseSingleOrGroup();
	const limit: OmmlNode = { 'm:e': ctx.wrapE(base), 'm:lim': ctx.wrapE(lim) };
	return tag === 'm:limLow' ? { 'm:limLow': limit } : { 'm:limUpp': limit };
}

/** `\boxed{x}` -> `m:borderBox`. */
export function parseBoxed(ctx: LatexParserContext): OmmlNode {
	return { 'm:borderBox': { 'm:e': ctx.wrapE(ctx.parseSingleOrGroup()) } as unknown as OmmlNode };
}

/** `\phantom` / `\hphantom` / `\vphantom` -> `m:phant` with the matching flags. */
export function parsePhantom(ctx: LatexParserContext, kind: 'full' | 'h' | 'v'): OmmlNode {
	const phantPr: OmmlNode = {};
	if (kind === 'h') {
		phantPr['m:zeroAsc'] = valNode('1');
		phantPr['m:zeroDesc'] = valNode('1');
	} else if (kind === 'v') {
		phantPr['m:zeroWid'] = valNode('1');
	}
	return {
		'm:phant': {
			'm:phantPr': Object.keys(phantPr).length > 0 ? phantPr : undefined,
			'm:e': ctx.wrapE(ctx.parseSingleOrGroup()),
		} as unknown as OmmlNode,
	};
}

/** Build `m:sPre` from already-parsed sub/sup arguments and the base atom. */
export function buildPrescript(
	ctx: LatexParserContext,
	sub: OmmlNode[],
	sup: OmmlNode[],
): OmmlNode {
	const base = ctx.parseAtom();
	return {
		'm:sPre': {
			'm:sub': ctx.wrapE(sub),
			'm:sup': ctx.wrapE(sup),
			'm:e': base ?? {},
		} as unknown as OmmlNode,
	};
}

/** `\prescript{sup}{sub}{base}` (mathtools). */
export function parsePrescript(ctx: LatexParserContext): OmmlNode {
	const sup = ctx.parseSingleOrGroup();
	const sub = ctx.parseSingleOrGroup();
	return buildPrescript(ctx, sub, sup);
}

/** `\operatorname{name}{arg}`: an arbitrary function name in `m:func`. */
export function parseOperatorName(ctx: LatexParserContext): OmmlNode {
	return parseFuncApplication(ctx, parseTextArgument(ctx));
}
