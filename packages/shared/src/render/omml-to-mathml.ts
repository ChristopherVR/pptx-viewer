/**
 * omml-to-mathml.ts — pure OMML → MathML conversion.
 *
 * Vue port of the React `viewer/utils/omml-to-mathml.ts` (+ its `omml-helpers`
 * and `omml-converters` split), consolidated into a single self-contained,
 * framework-agnostic module. No Vue/DOM dependencies.
 *
 * Converts Office MathML (OMML) XML objects — as parsed by fast-xml-parser
 * during PPTX load (attributes prefixed with `@_`) — into standard MathML
 * markup strings (`<math>…</math>`) that browsers render natively.
 *
 * `pptx-viewer-core` does NOT ship an OMML→MathML converter (its
 * `OmmlLatexConverter` only does OMML↔LaTeX), so this logic is ported here.
 */

import type { XmlObject } from 'pptx-viewer-core';
import { stripXmlOrderSuffix } from 'pptx-viewer-core';

import { getOmmlMathColor, getOmmlMathFontSize } from './omml-color';

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * A parsed OMML node. Structurally a parsed-XML object: attributes live under
 * `@_`-prefixed keys, children under their (namespaced) tag name, text under
 * `#text` (or a collapsed bare string). Aliased to core's `XmlObject`.
 */
export type OmmlNode = XmlObject;

/** Function that converts all children of an OMML container to MathML. */
type ChildrenConverter = (node: OmmlNode) => string;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Safely retrieve a child node, always returning an object (never undefined). */
function child(node: OmmlNode | undefined, key: string): OmmlNode {
	if (!node) {
		return {};
	}
	const v = node[key];
	if (v && typeof v === 'object' && !Array.isArray(v)) {
		return v as OmmlNode;
	}
	return {};
}

/** Ensure a value is an array of OmmlNode. */
function ensureArray(value: OmmlNode[keyof OmmlNode]): OmmlNode[] {
	if (value === undefined || value === null) {
		return [];
	}
	if (Array.isArray(value)) {
		return value as OmmlNode[];
	}
	if (typeof value === 'object') {
		return [value as OmmlNode];
	}
	return [];
}

/** Read a string attribute from a node. */
function attr(node: OmmlNode | undefined, name: string): string {
	if (!node) {
		return '';
	}
	const v = node[`@_${name}`];
	return typeof v === 'string' ? v : v !== undefined ? String(v) : '';
}

/** Read the `@_val` attribute (extremely common in OMML property nodes). */
function val(node: OmmlNode | undefined): string {
	return attr(node, 'val');
}

/** Escape angle brackets and ampersands for safe embedding in MathML. */
function escapeXml(text: string): string {
	return text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

/** Read an `m:t` text run value (object/string/number) as a string. */
function readText(node: OmmlNode): string {
	const textNode = node['m:t'];
	if (typeof textNode === 'string') {
		return textNode;
	}
	if (typeof textNode === 'number' || typeof textNode === 'boolean') {
		return String(textNode);
	}
	if (textNode && typeof textNode === 'object' && !Array.isArray(textNode)) {
		const inner = (textNode as OmmlNode)['#text'];
		return typeof inner === 'string' ? inner : '';
	}
	return '';
}

// ── Character classification ────────────────────────────────────────────────

/** Set of characters treated as mathematical operators. */
const OPERATOR_CHARS = new Set([
	'+',
	'-',
	'−',
	'±',
	'∓',
	'×',
	'÷',
	'·',
	'=',
	'≠',
	'≈',
	'≡',
	'≤',
	'≥',
	'<',
	'>',
	'≪',
	'≫',
	'∈',
	'∉',
	'⊂',
	'⊃',
	'⊆',
	'⊇',
	'∪',
	'∩',
	'→',
	'←',
	'↔',
	'⇒',
	'⇐',
	'⇔',
	'∞',
	'∴',
	'∵',
	'∝',
	'∀',
	'∃',
	',',
	';',
	':',
	'!',
	'?',
	'.',
	'|',
	'/',
	'\\',
	"'",
	'(',
	')',
	'[',
	']',
	'{',
	'}',
	'⟨',
	'⟩',
]);

function isOperator(ch: string): boolean {
	return OPERATOR_CHARS.has(ch.trim());
}

function isNumeric(text: string): boolean {
	return /^[0-9]+(?:[.,][0-9]+)?$/u.test(text.trim());
}

// ── Unicode accent map (m:acc) ──────────────────────────────────────────────

const ACCENT_MAP: Record<string, string> = {
	'̂': '^', // combining circumflex → hat
	'̃': '~', // combining tilde
	'̄': '¯', // combining macron → bar
	'̅': '¯', // combining overline → bar
	'̇': '˙', // combining dot above
	'̈': '¨', // combining diaeresis
	'̌': 'ˇ', // combining caron
	'̲': '_', // combining underbar
	'⃗': '→', // combining right arrow above → →
	'^': '^',
	'~': '~',
	'¯': '¯',
	'˙': '˙',
	'¨': '¨',
	ˇ: 'ˇ',
};

// ── Nary operator map ───────────────────────────────────────────────────────

const NARY_CHAR_MAP: Record<string, string> = {
	'∑': '∑', // ∑
	'∏': '∏', // ∏
	'∫': '∫', // ∫
	'∬': '∬', // ∬
	'∭': '∭', // ∭
	'∮': '∮', // ∮
	'∐': '∐', // ∐
	'⋀': '⋀', // ⋀
	'⋁': '⋁', // ⋁
	'⋂': '⋂', // ⋂
	'⋃': '⋃', // ⋃
};

// ── Delimiter bracket maps ──────────────────────────────────────────────────

const DELIM_BEGIN_MAP: Record<string, string> = {
	'(': '(',
	'[': '[',
	'{': '{',
	'|': '|',
	'‖': '‖',
	'⟨': '⟨',
	'⌈': '⌈',
	'⌊': '⌊',
};

const DELIM_END_MAP: Record<string, string> = {
	')': ')',
	']': ']',
	'}': '}',
	'|': '|',
	'‖': '‖',
	'⟩': '⟩',
	'⌉': '⌉',
	'⌋': '⌋',
};

// ── Element converters ──────────────────────────────────────────────────────

/** m:r — text run: classify as identifier, number, or operator. */
function convertRun(node: OmmlNode): string {
	const text = readText(node);
	if (text.length === 0) {
		return '';
	}

	const escaped = escapeXml(text);
	const rPr = child(node, 'm:rPr');
	const norVal = val(child(rPr, 'm:nor'));
	const isNormal = norVal === '1' || norVal === 'on' || norVal === 'true';

	if (isNumeric(text)) {
		return `<mn>${escaped}</mn>`;
	}
	if (isOperator(text)) {
		return `<mo>${escaped}</mo>`;
	}
	if (isNormal) {
		return `<mi mathvariant="normal">${escaped}</mi>`;
	}
	return `<mi>${escaped}</mi>`;
}

/** m:f — fraction. */
function convertFraction(node: OmmlNode, cc: ChildrenConverter): string {
	const fPr = child(node, 'm:fPr');
	const fracType = val(child(fPr, 'm:type'));
	const num = `<mrow>${cc(child(node, 'm:num'))}</mrow>`;
	const den = `<mrow>${cc(child(node, 'm:den'))}</mrow>`;

	if (fracType === 'lin') {
		return `<mrow>${num}<mo>/</mo>${den}</mrow>`;
	}
	if (fracType === 'noBar') {
		return `<mfrac linethickness="0">${num}${den}</mfrac>`;
	}
	return `<mfrac>${num}${den}</mfrac>`;
}

/** m:rad — radical: square root or nth root. */
function convertRadical(node: OmmlNode, cc: ChildrenConverter): string {
	const radPr = child(node, 'm:radPr');
	const degHide = val(child(radPr, 'm:degHide'));
	const base = cc(child(node, 'm:e'));
	const degree = cc(child(node, 'm:deg'));

	if (degHide === '1' || degHide === 'on' || degHide === 'true' || degree.length === 0) {
		return `<msqrt><mrow>${base}</mrow></msqrt>`;
	}
	return `<mroot><mrow>${base}</mrow><mrow>${degree}</mrow></mroot>`;
}

/** m:sSup — superscript. */
function convertSuperscript(node: OmmlNode, cc: ChildrenConverter): string {
	const base = cc(child(node, 'm:e'));
	const sup = cc(child(node, 'm:sup'));
	return `<msup><mrow>${base}</mrow><mrow>${sup}</mrow></msup>`;
}

/** m:sSub — subscript. */
function convertSubscript(node: OmmlNode, cc: ChildrenConverter): string {
	const base = cc(child(node, 'm:e'));
	const sub = cc(child(node, 'm:sub'));
	return `<msub><mrow>${base}</mrow><mrow>${sub}</mrow></msub>`;
}

/** m:sSubSup — simultaneous subscript and superscript. */
function convertSubSup(node: OmmlNode, cc: ChildrenConverter): string {
	const base = cc(child(node, 'm:e'));
	const sub = cc(child(node, 'm:sub'));
	const sup = cc(child(node, 'm:sup'));
	return `<msubsup><mrow>${base}</mrow><mrow>${sub}</mrow><mrow>${sup}</mrow></msubsup>`;
}

/** m:sPre — pre-sub-superscript (e.g. isotope notation). */
function convertPreSubSup(node: OmmlNode, cc: ChildrenConverter): string {
	const base = cc(child(node, 'm:e'));
	const sub = cc(child(node, 'm:sub'));
	const sup = cc(child(node, 'm:sup'));
	return `<mmultiscripts><mrow>${base}</mrow><mprescripts/><mrow>${sub}</mrow><mrow>${sup}</mrow></mmultiscripts>`;
}

/** m:nary — n-ary operator (sum, integral, product, etc.). */
function convertNary(node: OmmlNode, cc: ChildrenConverter): string {
	const naryPr = child(node, 'm:naryPr');
	const chrVal = val(child(naryPr, 'm:chr'));
	const limLocVal = val(child(naryPr, 'm:limLoc'));
	const subHide = val(child(naryPr, 'm:subHide'));
	const supHide = val(child(naryPr, 'm:supHide'));

	const operatorChar = chrVal ? NARY_CHAR_MAP[chrVal] || chrVal : '∫';

	const sub = cc(child(node, 'm:sub'));
	const sup = cc(child(node, 'm:sup'));
	const base = cc(child(node, 'm:e'));

	const showSub = subHide !== '1' && subHide !== 'on' && subHide !== 'true' && sub.length > 0;
	const showSup = supHide !== '1' && supHide !== 'on' && supHide !== 'true' && sup.length > 0;

	let result: string;
	if (showSub && showSup) {
		if (limLocVal === 'undOvr') {
			result = `<munderover><mo>${escapeXml(operatorChar)}</mo><mrow>${sub}</mrow><mrow>${sup}</mrow></munderover>`;
		} else {
			result = `<msubsup><mo>${escapeXml(operatorChar)}</mo><mrow>${sub}</mrow><mrow>${sup}</mrow></msubsup>`;
		}
	} else if (showSub) {
		if (limLocVal === 'undOvr') {
			result = `<munder><mo>${escapeXml(operatorChar)}</mo><mrow>${sub}</mrow></munder>`;
		} else {
			result = `<msub><mo>${escapeXml(operatorChar)}</mo><mrow>${sub}</mrow></msub>`;
		}
	} else if (showSup) {
		if (limLocVal === 'undOvr') {
			result = `<mover><mo>${escapeXml(operatorChar)}</mo><mrow>${sup}</mrow></mover>`;
		} else {
			result = `<msup><mo>${escapeXml(operatorChar)}</mo><mrow>${sup}</mrow></msup>`;
		}
	} else {
		result = `<mo>${escapeXml(operatorChar)}</mo>`;
	}

	return `<mrow>${result}<mrow>${base}</mrow></mrow>`;
}

/** m:d — delimiter (parentheses, brackets, pipes, etc.). */
function convertDelimiter(node: OmmlNode, cc: ChildrenConverter): string {
	const dPr = child(node, 'm:dPr');
	const begChrVal = val(child(dPr, 'm:begChr'));
	const endChrVal = val(child(dPr, 'm:endChr'));
	const sepChrVal = val(child(dPr, 'm:sepChr'));

	const open = begChrVal.length > 0 ? begChrVal : '(';
	const close = endChrVal.length > 0 ? endChrVal : ')';
	const separator = sepChrVal.length > 0 ? sepChrVal : '';

	const openChar = DELIM_BEGIN_MAP[open] || open;
	const closeChar = DELIM_END_MAP[close] || close;

	const elements = ensureArray(node['m:e']);
	const parts: string[] = [];
	for (let i = 0; i < elements.length; i++) {
		if (i > 0 && separator.length > 0) {
			parts.push(`<mo>${escapeXml(separator)}</mo>`);
		}
		parts.push(`<mrow>${cc(elements[i])}</mrow>`);
	}

	const openMo = open ? `<mo>${escapeXml(openChar)}</mo>` : '<mo></mo>';
	const closeMo = close ? `<mo>${escapeXml(closeChar)}</mo>` : '<mo></mo>';

	return `<mrow>${openMo}${parts.join('')}${closeMo}</mrow>`;
}

/** m:m — matrix / array layout. */
function convertMatrix(node: OmmlNode, cc: ChildrenConverter): string {
	const rows = ensureArray(node['m:mr']);
	const tableRows: string[] = [];

	for (const row of rows) {
		const cells = ensureArray(row['m:e']);
		const tdParts: string[] = [];
		for (const cell of cells) {
			tdParts.push(`<mtd><mrow>${cc(cell)}</mrow></mtd>`);
		}
		tableRows.push(`<mtr>${tdParts.join('')}</mtr>`);
	}

	return `<mrow><mo>[</mo><mtable>${tableRows.join('')}</mtable><mo>]</mo></mrow>`;
}

/** m:acc — accent mark (hat, bar, tilde, dot, etc.). */
function convertAccent(node: OmmlNode, cc: ChildrenConverter): string {
	const accPr = child(node, 'm:accPr');
	const chrVal = val(child(accPr, 'm:chr'));
	const base = cc(child(node, 'm:e'));

	const accentChar = chrVal.length > 0 ? ACCENT_MAP[chrVal] || chrVal : '̂';

	return `<mover accent="true"><mrow>${base}</mrow><mo>${escapeXml(accentChar)}</mo></mover>`;
}

/** m:bar — overbar or underbar. */
function convertBar(node: OmmlNode, cc: ChildrenConverter): string {
	const barPr = child(node, 'm:barPr');
	const posVal = val(child(barPr, 'm:pos'));
	const base = cc(child(node, 'm:e'));

	if (posVal === 'bot') {
		return `<munder><mrow>${base}</mrow><mo>¯</mo></munder>`;
	}
	return `<mover><mrow>${base}</mrow><mo>¯</mo></mover>`;
}

/** m:limLow — lower limit. */
function convertLimLow(node: OmmlNode, cc: ChildrenConverter): string {
	const base = cc(child(node, 'm:e'));
	const lim = cc(child(node, 'm:lim'));
	return `<munder><mrow>${base}</mrow><mrow>${lim}</mrow></munder>`;
}

/** m:limUpp — upper limit. */
function convertLimUpp(node: OmmlNode, cc: ChildrenConverter): string {
	const base = cc(child(node, 'm:e'));
	const lim = cc(child(node, 'm:lim'));
	return `<mover><mrow>${base}</mrow><mrow>${lim}</mrow></mover>`;
}

/** m:groupChr — grouping character (brace under/over). */
function convertGroupChr(node: OmmlNode, cc: ChildrenConverter): string {
	const grpPr = child(node, 'm:groupChrPr');
	const chrVal = val(child(grpPr, 'm:chr'));
	const posVal = val(child(grpPr, 'm:pos'));
	const base = cc(child(node, 'm:e'));

	const chr = chrVal.length > 0 ? chrVal : '⏟';

	if (posVal === 'top') {
		return `<mover><mrow>${base}</mrow><mo>${escapeXml(chr)}</mo></mover>`;
	}
	return `<munder><mrow>${base}</mrow><mo>${escapeXml(chr)}</mo></munder>`;
}

/** m:eqArr — equation array (aligned equations). */
function convertEqArr(node: OmmlNode, cc: ChildrenConverter): string {
	const elements = ensureArray(node['m:e']);
	const rows: string[] = [];

	for (const el of elements) {
		rows.push(`<mtr><mtd><mrow>${cc(el)}</mrow></mtd></mtr>`);
	}

	return `<mtable columnalign="left">${rows.join('')}</mtable>`;
}

/** m:box / m:borderBox — grouping box (transparent container). */
function convertBox(node: OmmlNode, cc: ChildrenConverter): string {
	return `<mrow>${cc(child(node, 'm:e'))}</mrow>`;
}

/** m:func — function application (sin, cos, log, lim, etc.). */
function convertFunc(node: OmmlNode, cc: ChildrenConverter): string {
	const fName = cc(child(node, 'm:fName'));
	const base = cc(child(node, 'm:e'));
	return `<mrow>${fName}<mo>&#x2061;</mo><mrow>${base}</mrow></mrow>`;
}

// ── Dispatch ────────────────────────────────────────────────────────────────

/** Convert all child elements of an OMML container to MathML. */
function convertChildren(node: OmmlNode): string {
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
		if (tag === 'm:oMathPara') {
			continue;
		}

		const items = ensureArray(node[key]);
		for (const item of items) {
			const result = convertElement(tag, item);
			if (result) {
				parts.push(result);
			}
		}
	}

	return parts.join('');
}

/** Convert a single OMML element by tag name. */
function convertElement(tag: string, node: OmmlNode): string {
	switch (tag) {
		case 'm:r':
			return convertRun(node);
		case 'm:f':
			return convertFraction(node, convertChildren);
		case 'm:rad':
			return convertRadical(node, convertChildren);
		case 'm:sSup':
			return convertSuperscript(node, convertChildren);
		case 'm:sSub':
			return convertSubscript(node, convertChildren);
		case 'm:sSubSup':
			return convertSubSup(node, convertChildren);
		case 'm:sPre':
			return convertPreSubSup(node, convertChildren);
		case 'm:nary':
			return convertNary(node, convertChildren);
		case 'm:d':
			return convertDelimiter(node, convertChildren);
		case 'm:m':
			return convertMatrix(node, convertChildren);
		case 'm:acc':
			return convertAccent(node, convertChildren);
		case 'm:bar':
			return convertBar(node, convertChildren);
		case 'm:limLow':
			return convertLimLow(node, convertChildren);
		case 'm:limUpp':
			return convertLimUpp(node, convertChildren);
		case 'm:groupChr':
			return convertGroupChr(node, convertChildren);
		case 'm:eqArr':
			return convertEqArr(node, convertChildren);
		case 'm:box':
			return convertBox(node, convertChildren);
		case 'm:borderBox':
			return convertBox(node, convertChildren);
		case 'm:func':
			return convertFunc(node, convertChildren);
		case 'm:oMath':
			return `<mrow>${convertChildren(node)}</mrow>`;
		default:
			// TODO: defer exotic constructs (m:phant, m:sSubSupPr edge cases,
			// m:argPr scaling, etc.) — passthrough as empty for now.
			return '';
	}
}

/** Locate all `m:oMath` root elements inside an OMML wrapper node. */
function findOmathRoots(node: OmmlNode): OmmlNode[] {
	if (node['m:oMath']) {
		return ensureArray(node['m:oMath']);
	}
	const para = node['m:oMathPara'];
	if (para) {
		const paraNode = Array.isArray(para) ? (para[0] as OmmlNode) : (para as OmmlNode);
		if (paraNode['m:oMath']) {
			return ensureArray(paraNode['m:oMath']);
		}
	}
	const contentTags = new Set(['m:r', 'm:f', 'm:rad', 'm:sSup', 'm:sSub', 'm:box']);
	if (Object.keys(node).some((key) => contentTags.has(stripXmlOrderSuffix(key)))) {
		return [node];
	}
	return [];
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert an OMML XML node (from fast-xml-parser) into a MathML string.
 *
 * Accepts the object at the `<a14:m>` / `<m:oMathPara>` level or directly at
 * `<m:oMath>`. Returns a `<math>` element string, or empty string if the input
 * is empty / unparseable.
 */
export function convertOmmlToMathMl(ommlNode: OmmlNode): string {
	if (!ommlNode || typeof ommlNode !== 'object') {
		return '';
	}

	const oMaths = findOmathRoots(ommlNode);
	if (oMaths.length === 0) {
		return '';
	}

	const innerParts = oMaths.map((om) => convertChildren(om));
	const inner = innerParts.join('');
	if (inner.length === 0) {
		return '';
	}

	const color = getOmmlMathColor(ommlNode);
	const colorAttribute = color ? ` mathcolor="${color}"` : '';
	const fontSize = getOmmlMathFontSize(ommlNode);
	const sizeAttribute = fontSize ? ` mathsize="${fontSize}pt"` : '';
	return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="inline"${colorAttribute}${sizeAttribute}>${inner}</math>`;
}

/**
 * Convenience alias used by the Vue viewer: `ommlToMathml(omml)`.
 *
 * Accepts the parsed OMML object (the shape stored on
 * {@link TextSegment.equationXml}) or a raw OMML markup string. String inputs
 * are not re-parsed here (no XML parser dependency in this pure module) — they
 * are returned wrapped so callers can still surface raw markup if needed.
 */
export function ommlToMathml(omml: OmmlNode | string): string {
	if (typeof omml === 'string') {
		// A bare string cannot be meaningfully walked without a parser; the
		// viewer always passes the parsed object. Return empty to stay pure.
		return '';
	}
	return convertOmmlToMathMl(omml);
}
