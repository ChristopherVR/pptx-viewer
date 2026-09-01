/**
 * omml-to-latex: reverse-convert an OMML tree (fast-xml-parser shape) back to
 * the LaTeX subset `latex-to-omml.ts` understands, so the equation editor can
 * seed its textarea from an existing equation and "Update" round-trips the
 * structure instead of dropping it.
 *
 * Every construct `omml-to-mathml.ts` renders has a spelling here; anything
 * else degrades to its text content (never to an empty string).
 */
import { stripXmlOrderSuffix } from 'pptx-viewer-core';

import { ACCENT_ALIASES, FUNC_NAMES, REVERSE_ACCENT } from './latex-omml-symbols';
import type { XmlRecord } from './omml-to-latex-helpers';
import {
	attrVal,
	childNode,
	collectText,
	contentKeys,
	ensureArr,
	escapeMathText,
	escapeTextArgument,
	isOn,
	isSingleAtom,
	readRunText,
	soleChild,
} from './omml-to-latex-helpers';
import type { LatexEmitter } from './omml-to-latex-layout';
import { delimiterToLatex, eqArrToLatex, matrixToLatex, naryToLatex } from './omml-to-latex-layout';

function childrenToLatex(node: XmlRecord | undefined): string {
	if (!node || typeof node !== 'object') {
		return '';
	}
	const parts: string[] = [];
	for (const key of contentKeys(node)) {
		// Keys may carry `#pptx-order-N` position markers (interleaved sibling
		// sequences); strip them before dispatching on the tag name.
		const tag = stripXmlOrderSuffix(key);
		for (const item of ensureArr(node[key])) {
			parts.push(elementToLatex(tag, item));
		}
	}
	return parts.join('');
}

function arg(node: XmlRecord, key: string): string {
	return childrenToLatex(childNode(node, key));
}

const emitter: LatexEmitter = { children: childrenToLatex, arg };

/** Script base: braces only when the base is more than one atom. */
function scriptBase(node: XmlRecord): string {
	const base = arg(node, 'm:e');
	return isSingleAtom(childNode(node, 'm:e')) || base.length <= 1 ? base : `{${base}}`;
}

function runToLatex(node: XmlRecord): string {
	const text = readRunText(node);
	if (text.length === 0) {
		return '';
	}
	if (isOn(childNode(childNode(node, 'm:rPr'), 'm:nor'))) {
		return `\\text{${escapeTextArgument(text)}}`;
	}
	return escapeMathText(text);
}

function fractionToLatex(node: XmlRecord): string {
	const type = attrVal(childNode(childNode(node, 'm:fPr'), 'm:type'));
	const num = arg(node, 'm:num');
	const den = arg(node, 'm:den');
	if (type === 'lin') {
		return `\\sfrac{${num}}{${den}}`;
	}
	if (type === 'noBar') {
		return `{${num} \\atop ${den}}`;
	}
	return `\\frac{${num}}{${den}}`;
}

function radicalToLatex(node: XmlRecord): string {
	const base = arg(node, 'm:e');
	if (isOn(childNode(childNode(node, 'm:radPr'), 'm:degHide'))) {
		return `\\sqrt{${base}}`;
	}
	const deg = arg(node, 'm:deg');
	return deg ? `\\sqrt[${deg}]{${base}}` : `\\sqrt{${base}}`;
}

/** Resolve an `m:fName` to `\sin`, `\lim_{...}` or `\operatorname{...}`. */
function funcNameToLatex(fName: XmlRecord): string {
	const sole = soleChild(fName);
	let nameNode: XmlRecord | null = null;
	let scripts = '';
	if (sole?.tag === 'm:r') {
		nameNode = sole.node;
	} else if (sole && ['m:sSub', 'm:sSup', 'm:sSubSup', 'm:limLow', 'm:limUpp'].includes(sole.tag)) {
		const inner = soleChild(childNode(sole.node, 'm:e'));
		if (inner?.tag === 'm:r') {
			nameNode = inner.node;
			const sub = arg(sole.node, sole.tag === 'm:limLow' ? 'm:lim' : 'm:sub');
			const sup = arg(sole.node, sole.tag === 'm:limUpp' ? 'm:lim' : 'm:sup');
			scripts = `${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''}`;
		}
	}
	if (!nameNode) {
		return childrenToLatex(fName);
	}
	const name = readRunText(nameNode).trim();
	const spelled = FUNC_NAMES.has(name)
		? `\\${name}`
		: `\\operatorname{${escapeTextArgument(name)}}`;
	return `${spelled}${scripts}`;
}

function accentToLatex(node: XmlRecord): string {
	const raw = attrVal(childNode(childNode(node, 'm:accPr'), 'm:chr')) || '̂';
	const chr = ACCENT_ALIASES[raw] ?? raw;
	const cmd = REVERSE_ACCENT[chr];
	const base = arg(node, 'm:e');
	return cmd ? `${cmd}{${base}}` : `\\overset{${escapeMathText(chr)}}{${base}}`;
}

function groupChrToLatex(node: XmlRecord, label = ''): string {
	const groupChrPr = childNode(node, 'm:groupChrPr');
	const chr = attrVal(childNode(groupChrPr, 'm:chr')) || '⏟';
	const top = attrVal(childNode(groupChrPr, 'm:pos')) === 'top';
	const base = arg(node, 'm:e');
	if (chr === '⏟' && !top) {
		return `\\underbrace{${base}}${label ? `_{${label}}` : ''}`;
	}
	if (chr === '⏞' && top) {
		return `\\overbrace{${base}}${label ? `^{${label}}` : ''}`;
	}
	const wrapped = `\\${top ? 'overset' : 'underset'}{${escapeMathText(chr)}}{${base}}`;
	return label ? `\\${top ? 'overset' : 'underset'}{${label}}{${wrapped}}` : wrapped;
}

function limitToLatex(node: XmlRecord, tag: 'm:limLow' | 'm:limUpp'): string {
	const lim = arg(node, 'm:lim');
	const sole = soleChild(childNode(node, 'm:e'));
	if (sole?.tag === 'm:groupChr') {
		const top = attrVal(childNode(childNode(sole.node, 'm:groupChrPr'), 'm:pos')) === 'top';
		if (top === (tag === 'm:limUpp')) {
			return groupChrToLatex(sole.node, lim);
		}
	}
	return `\\${tag === 'm:limLow' ? 'underset' : 'overset'}{${lim}}{${arg(node, 'm:e')}}`;
}

function phantomToLatex(node: XmlRecord): string {
	const phantPr = childNode(node, 'm:phantPr');
	const base = arg(node, 'm:e');
	if (isOn(childNode(phantPr, 'm:zeroWid'))) {
		return `\\vphantom{${base}}`;
	}
	if (isOn(childNode(phantPr, 'm:zeroAsc')) || isOn(childNode(phantPr, 'm:zeroDesc'))) {
		return `\\hphantom{${base}}`;
	}
	return `\\phantom{${base}}`;
}

function elementToLatex(tag: string, node: XmlRecord): string {
	switch (tag) {
		case 'm:r':
			return runToLatex(node);
		case 'm:f':
			return fractionToLatex(node);
		case 'm:rad':
			return radicalToLatex(node);
		case 'm:sSup':
			return `${scriptBase(node)}^{${arg(node, 'm:sup')}}`;
		case 'm:sSub':
			return `${scriptBase(node)}_{${arg(node, 'm:sub')}}`;
		case 'm:sSubSup':
			return `${scriptBase(node)}_{${arg(node, 'm:sub')}}^{${arg(node, 'm:sup')}}`;
		case 'm:sPre':
			return `{}_{${arg(node, 'm:sub')}}^{${arg(node, 'm:sup')}}{${arg(node, 'm:e')}}`;
		case 'm:nary':
			return naryToLatex(emitter, node);
		case 'm:d':
			return delimiterToLatex(emitter, node);
		case 'm:func':
			return `${funcNameToLatex(childNode(node, 'm:fName'))}{${arg(node, 'm:e')}}`;
		case 'm:m':
			return matrixToLatex(emitter, node, 'matrix');
		case 'm:eqArr':
			return eqArrToLatex(emitter, node);
		case 'm:acc':
			return accentToLatex(node);
		case 'm:bar':
			return `\\${attrVal(childNode(childNode(node, 'm:barPr'), 'm:pos')) === 'bot' ? 'underline' : 'overline'}{${arg(node, 'm:e')}}`;
		case 'm:limLow':
		case 'm:limUpp':
			return limitToLatex(node, tag);
		case 'm:groupChr':
			return groupChrToLatex(node);
		case 'm:borderBox':
			return `\\boxed{${arg(node, 'm:e')}}`;
		case 'm:phant':
			return phantomToLatex(node);
		case 'm:box':
			// Transparent grouping container (draws nothing): emit the content in
			// place. mergeSiblings emits per-sibling boxes to preserve ordering.
			return ensureArr(node['m:e'])
				.map((e) => childrenToLatex(e))
				.join('');
		case 'm:oMath':
			return childrenToLatex(node);
		default:
			// Unknown construct: keep its text so nothing is silently dropped.
			return collectText(node);
	}
}

/**
 * Reverse-convert an OMML node back to LaTeX for editing. Accepts the object at
 * the `m:oMathPara` level, at `m:oMath`, or a bare content container.
 */
export function convertOmmlToLatex(omml: Record<string, unknown>): string {
	if (!omml || typeof omml !== 'object') {
		return '';
	}

	const para = omml['m:oMathPara'] as XmlRecord | XmlRecord[] | undefined;
	const roots = para ? ensureArr(para).flatMap((p) => ensureArr(p['m:oMath'])) : [];
	if (roots.length > 0) {
		return roots.map((root) => childrenToLatex(root)).join(' ');
	}
	if (omml['m:oMath']) {
		return ensureArr(omml['m:oMath'])
			.map((root) => childrenToLatex(root))
			.join(' ');
	}
	return childrenToLatex(omml);
}
