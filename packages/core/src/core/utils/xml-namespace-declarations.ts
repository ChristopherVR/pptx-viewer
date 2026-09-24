/**
 * Declare every namespace prefix a serialized part uses.
 *
 * The save writers build parts from parsed-object trees, and several of them
 * add prefixed extension elements (`adec:decorative`, `a16:creationId`,
 * `a14:m`, `ahyp:hlinkClr`, ...) without declaring the prefix, relying on a
 * declaration that happened to sit on the original leaf. A prefix that is not
 * in scope makes the part not namespace-well-formed, and PowerPoint refuses
 * the whole package ("PowerPoint found a problem with content") rather than
 * repairing it. Instead of teaching every writer to hoist its own prefix, the
 * builder runs this pass over each part it emits: any prefix used in an
 * element or attribute name that is not declared in scope gets a declaration
 * on the part's root element.
 *
 * The URI for a missing prefix comes, in order, from a declaration of the same
 * prefix elsewhere in the part (a leaf-level `xmlns:ahyp` reused for a sibling
 * that lost its own), then from {@link WELL_KNOWN_NAMESPACES}. A prefix with
 * neither source is left alone: guessing a URI would be worse than the
 * existing output.
 *
 * @module utils/xml-namespace-declarations
 */

/** Prefix to namespace URI for the transitional OOXML and Office extension vocabularies. */
export const WELL_KNOWN_NAMESPACES: Readonly<Record<string, string>> = {
	a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
	p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
	r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
	m: 'http://schemas.openxmlformats.org/officeDocument/2006/math',
	mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
	c: 'http://schemas.openxmlformats.org/drawingml/2006/chart',
	dgm: 'http://schemas.openxmlformats.org/drawingml/2006/diagram',
	pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
	a14: 'http://schemas.microsoft.com/office/drawing/2010/main',
	a15: 'http://schemas.microsoft.com/office/drawing/2012/main',
	a16: 'http://schemas.microsoft.com/office/drawing/2014/main',
	a1611: 'http://schemas.microsoft.com/office/drawing/2016/11/main',
	adec: 'http://schemas.microsoft.com/office/drawing/2017/decorative',
	ahyp: 'http://schemas.microsoft.com/office/drawing/2018/hyperlinkcolor',
	asvg: 'http://schemas.microsoft.com/office/drawing/2016/SVG/main',
	aink: 'http://schemas.microsoft.com/office/drawing/2016/ink',
	am3d: 'http://schemas.microsoft.com/office/drawing/2017/model3d',
	p14: 'http://schemas.microsoft.com/office/powerpoint/2010/main',
	p15: 'http://schemas.microsoft.com/office/powerpoint/2012/main',
	p159: 'http://schemas.microsoft.com/office/powerpoint/2015/09/main',
	p1510: 'http://schemas.microsoft.com/office/powerpoint/2015/10/main',
	p188: 'http://schemas.microsoft.com/office/powerpoint/2018/8/main',
	c14: 'http://schemas.microsoft.com/office/drawing/2007/8/2/chart',
	c15: 'http://schemas.microsoft.com/office/drawing/2012/chart',
	c16: 'http://schemas.microsoft.com/office/drawing/2014/chart',
	c16r2: 'http://schemas.microsoft.com/office/drawing/2015/06/chart',
	c16r3: 'http://schemas.microsoft.com/office/drawing/2017/03/chart',
	cx: 'http://schemas.microsoft.com/office/drawing/2014/chartex',
	dsp: 'http://schemas.microsoft.com/office/drawing/2008/diagram',
	dgm14: 'http://schemas.microsoft.com/office/drawing/2010/diagram',
	dgm1611: 'http://schemas.microsoft.com/office/drawing/2016/11/diagram',
	thm15: 'http://schemas.microsoft.com/office/thememl/2012/main',
	v: 'urn:schemas-microsoft-com:vml',
	o: 'urn:schemas-microsoft-com:office:office',
};

const NAME = '[A-Za-z_][\\w.-]*';
const TAG_RE = new RegExp(
	`<(/?)(${NAME}(?::${NAME})?)((?:\\s+[^\\s=>/]+\\s*=\\s*(?:"[^"]*"|'[^']*'))*)\\s*(/?)>`,
	'g',
);
const ATTR_RE = new RegExp(`\\s(${NAME}(?::${NAME})?)\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'g');
const USED_PREFIX_RE = new RegExp(`<(${NAME}):|\\s(${NAME}):${NAME}\\s*=`, 'g');
const DECL_RE = new RegExp(`xmlns:(${NAME})\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'g');

function prefixOf(qname: string): string | undefined {
	const colon = qname.indexOf(':');
	return colon > 0 ? qname.slice(0, colon) : undefined;
}

/** Prefixes that appear in a name but are never declared in scope, walking the element tree. */
function findOutOfScopePrefixes(xml: string): Set<string> {
	const missing = new Set<string>();
	const stack: Set<string>[] = [];
	TAG_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = TAG_RE.exec(xml))) {
		if (m[1]) {
			stack.pop();
			continue;
		}
		const parent = stack.length > 0 ? stack[stack.length - 1] : undefined;
		let scope: Set<string> = parent ?? new Set();
		const attrs = m[3] ?? '';
		const names: string[] = [m[2]];
		ATTR_RE.lastIndex = 0;
		let a: RegExpExecArray | null;
		while ((a = ATTR_RE.exec(attrs))) {
			const attrName = a[1];
			if (attrName.startsWith('xmlns:')) {
				if (scope === parent) {
					scope = new Set(parent);
				}
				scope.add(attrName.slice(6));
			} else {
				names.push(attrName);
			}
		}
		for (const name of names) {
			const prefix = prefixOf(name);
			if (prefix && prefix !== 'xml' && prefix !== 'xmlns' && !scope?.has(prefix)) {
				missing.add(prefix);
			}
		}
		if (!m[4]) {
			stack.push(scope ?? new Set());
		}
	}
	return missing;
}

/**
 * Return `xml` with a root-level declaration added for every prefix that is
 * used but not in scope and whose URI can be resolved. Returns the input
 * unchanged (same string) when nothing needs declaring, which is the common
 * case and costs two linear regex scans.
 */
export function declareUsedNamespaces(xml: string): string {
	if (typeof xml !== 'string' || xml.indexOf(':') < 0) {
		return xml;
	}
	const rootStart = xml.search(/<[A-Za-z_]/);
	if (rootStart < 0) {
		return xml;
	}
	const rootEnd = xml.indexOf('>', rootStart);
	const rootTag = xml.slice(rootStart, rootEnd + 1);
	// Only whole parts are touched. The builder also serializes fragments that
	// are spliced into a larger tree later; those carry no declarations of
	// their own and inherit them from wherever they land.
	if (!xml.startsWith('<?xml') && !/\sxmlns(?::[\w.-]+)?\s*=/.test(rootTag)) {
		return xml;
	}
	const rootDeclared = new Set<string>();
	for (const r of rootTag.matchAll(DECL_RE)) {
		rootDeclared.add(r[1]);
	}

	// Fast path: every used prefix is declared on the root.
	let needsScopedScan = false;
	USED_PREFIX_RE.lastIndex = 0;
	let u: RegExpExecArray | null;
	while ((u = USED_PREFIX_RE.exec(xml))) {
		const prefix = u[1] ?? u[2];
		if (prefix === 'xml' || prefix === 'xmlns' || rootDeclared.has(prefix)) {
			continue;
		}
		needsScopedScan = true;
		break;
	}
	if (!needsScopedScan) {
		return xml;
	}

	const declared = new Map<string, string>();
	DECL_RE.lastIndex = 0;
	let d: RegExpExecArray | null;
	while ((d = DECL_RE.exec(xml))) {
		if (!declared.has(d[1])) {
			declared.set(d[1], d[2] ?? d[3] ?? '');
		}
	}
	const additions: string[] = [];
	for (const prefix of findOutOfScopePrefixes(xml)) {
		if (rootDeclared.has(prefix)) {
			continue;
		}
		const uri = declared.get(prefix) ?? WELL_KNOWN_NAMESPACES[prefix];
		if (!uri) {
			continue;
		}
		additions.push(` xmlns:${prefix}="${uri}"`);
	}
	if (additions.length === 0) {
		return xml;
	}
	const nameEnd = rootStart + 1 + (/^[^\s/>]+/.exec(rootTag.slice(1))?.[0].length ?? 0);
	return xml.slice(0, nameEnd) + additions.join('') + xml.slice(nameEnd);
}
