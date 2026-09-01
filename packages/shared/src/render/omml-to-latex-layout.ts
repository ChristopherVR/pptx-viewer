/**
 * omml-to-latex-layout: OMML -> LaTeX spellings for the container constructs
 * (n-ary operators, delimiters, matrices and equation arrays). The recursive
 * child emitter is injected so this module stays free of import cycles with
 * `omml-to-latex.ts`.
 */
import { MATRIX_ENVS, REVERSE_DELIM, REVERSE_NARY } from './latex-omml-symbols';
import type { XmlRecord } from './omml-to-latex-helpers';
import {
	attrVal,
	childNode,
	ensureArr,
	escapeMathText,
	hasAttr,
	isOn,
	soleChild,
} from './omml-to-latex-helpers';

/** Recursive emitters supplied by `omml-to-latex.ts`. */
export interface LatexEmitter {
	/** All content children of a container, in document order. */
	children(node: XmlRecord | undefined): string;
	/** The content of one named child (`m:e`, `m:num`, ...). */
	arg(node: XmlRecord, key: string): string;
}

const CMD_ENDS_WITH_LETTER = /[a-zA-Z]$/u;
/** Delimiters the tokenizer reads as plain text: no command spelling needed. */
const PLAIN_DELIM = /^[()[\]|]$/u;

export function naryToLatex(emit: LatexEmitter, node: XmlRecord): string {
	const naryPr = childNode(node, 'm:naryPr');
	const chr = attrVal(childNode(naryPr, 'm:chr'));
	let result = chr ? (REVERSE_NARY[chr] ?? escapeMathText(chr)) : '\\int';
	if (attrVal(childNode(naryPr, 'm:limLoc')) === 'undOvr') {
		result += '\\limits';
	}
	const sub = emit.arg(node, 'm:sub');
	const sup = emit.arg(node, 'm:sup');
	if (sub && !isOn(childNode(naryPr, 'm:subHide'))) {
		result += `_{${sub}}`;
	}
	if (sup && !isOn(childNode(naryPr, 'm:supHide'))) {
		result += `^{${sup}}`;
	}
	return `${result}{${emit.arg(node, 'm:e')}}`;
}

/** `\left` / `\right` spelling of a delimiter character (`.` for none). */
function delimToLatex(chr: string): string {
	if (chr.length === 0) {
		return '.';
	}
	if (PLAIN_DELIM.test(chr)) {
		return chr;
	}
	const cmd = REVERSE_DELIM[chr];
	if (cmd) {
		return CMD_ENDS_WITH_LETTER.test(cmd) ? `${cmd} ` : cmd;
	}
	return chr;
}

function matrixEnvFor(open: string, close: string): string | undefined {
	return Object.keys(MATRIX_ENVS).find((env) => {
		const [envOpen, envClose] = MATRIX_ENVS[env]!;
		// Bare `matrix` / `array` carry no delimiters of their own: an m:d with
		// explicitly empty ones keeps its `\left.` ... `\right.` wrapper.
		return env !== 'array' && env !== 'matrix' && envOpen === open && envClose === close;
	});
}

export function rowsToLatex(emit: LatexEmitter, rows: XmlRecord[]): string {
	return rows.map((row) => emit.children(row)).join(' \\\\ ');
}

export function matrixToLatex(emit: LatexEmitter, node: XmlRecord, env: string): string {
	const rows = ensureArr(node['m:mr']).map((row) =>
		ensureArr(row['m:e'])
			.map((cell) => emit.children(cell))
			.join(' & '),
	);
	return `\\begin{${env}}${rows.join(' \\\\ ')}\\end{${env}}`;
}

export function eqArrToLatex(emit: LatexEmitter, node: XmlRecord): string {
	return `\\begin{aligned}${rowsToLatex(emit, ensureArr(node['m:e']))}\\end{aligned}`;
}

/**
 * `m:d`: a `\begin{pmatrix}`-style environment, `\begin{cases}` or `\binom`
 * when the delimiters and sole child match, otherwise `\left ... \right`.
 */
export function delimiterToLatex(emit: LatexEmitter, node: XmlRecord): string {
	const dPr = childNode(node, 'm:dPr');
	const begNode = childNode(dPr, 'm:begChr');
	const endNode = childNode(dPr, 'm:endChr');
	const open = hasAttr(begNode) ? attrVal(begNode) : '(';
	const close = hasAttr(endNode) ? attrVal(endNode) : ')';
	const elements = ensureArr(node['m:e']);

	const sole = elements.length === 1 ? soleChild(elements[0]) : null;
	if (sole?.tag === 'm:m') {
		const env = matrixEnvFor(open, close);
		if (env) {
			return matrixToLatex(emit, sole.node, env);
		}
	}
	if (sole?.tag === 'm:eqArr' && open === '{' && close === '') {
		return `\\begin{cases}${rowsToLatex(emit, ensureArr(sole.node['m:e']))}\\end{cases}`;
	}
	if (sole?.tag === 'm:f' && open === '(' && close === ')') {
		if (attrVal(childNode(childNode(sole.node, 'm:fPr'), 'm:type')) === 'noBar') {
			return `\\binom{${emit.arg(sole.node, 'm:num')}}{${emit.arg(sole.node, 'm:den')}}`;
		}
	}

	const sepNode = childNode(dPr, 'm:sepChr');
	const separator = hasAttr(sepNode) ? attrVal(sepNode) : '|';
	const inner = elements.map((e) => emit.children(e)).join(escapeMathText(separator));
	return `\\left${delimToLatex(open)}${inner}\\right${delimToLatex(close)}`;
}
