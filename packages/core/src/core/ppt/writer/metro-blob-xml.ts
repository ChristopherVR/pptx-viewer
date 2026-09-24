/**
 * Slide-XML side of the `.ppt` `metroBlob` writer: locates one element's
 * OOXML (`p:contentPart` for ink, `p:graphicFrame` for SmartArt, charts and
 * 3D models) inside a saved slide part and turns it into the self-contained
 * root element PowerPoint expects inside a `metroBlob` package.
 *
 * Ground truth (PowerPoint 16.0's own 97-2003 SaveAs, decoded from its
 * `OfficeArtTertiaryFOPT`): an ink shape's package root is the slide's
 * `p:contentPart` verbatim, and a graphic frame's root is the same
 * `p:graphicFrame` renamed to `p:E2oFrame`, each carrying every namespace
 * it uses on its own root because the package has no enclosing slide.
 *
 * @module ppt/writer/metro-blob-xml
 */

/** Which package root an element is carried as. */
export type MetroBlobKind = 'ink' | 'graphicFrame';

/** One element's OOXML, ready to become a `metroBlob` package root. */
export interface MetroFragment {
	kind: MetroBlobKind;
	/** The complete root element, namespaces declared on it. */
	xml: string;
	/** Relationship ids (slide-relative) the fragment references via `r:*` attributes. */
	relIds: string[];
	/** The element's `cNvPr` id, echoed into the package's `downrev` part. */
	shapeId?: string;
}

/** How a model element is matched to its saved XML. */
export interface MetroFragmentMatch {
	/** `cNvPr/@id`; preferred when known. */
	shapeId?: string;
	/** `cNvPr/@name`; used only when no `shapeId` is known and the name is unique. */
	name?: string;
}

const TAGS: ReadonlyArray<{ tag: string; kind: MetroBlobKind }> = [
	{ tag: 'p:contentPart', kind: 'ink' },
	{ tag: 'p:graphicFrame', kind: 'graphicFrame' },
];

interface Candidate {
	kind: MetroBlobKind;
	xml: string;
	id?: string;
	name?: string;
}

function readAttr(tag: string, attr: string): string | undefined {
	const m = new RegExp(`\\s${attr}="([^"]*)"`, 'u').exec(tag);
	return m ? m[1] : undefined;
}

/** Every `p:contentPart` / `p:graphicFrame` element in `slideXml`, in document order. */
function listCandidates(slideXml: string): Candidate[] {
	const out: Candidate[] = [];
	for (const { tag, kind } of TAGS) {
		const open = new RegExp(`<${tag}[\\s>/]`, 'gu');
		let m: RegExpExecArray | null;
		while ((m = open.exec(slideXml)) !== null) {
			const start = m.index;
			const closeTag = `</${tag}>`;
			const selfClose = slideXml.indexOf('/>', start);
			const firstGt = slideXml.indexOf('>', start);
			const end =
				selfClose !== -1 && selfClose + 1 === firstGt
					? firstGt + 1
					: slideXml.indexOf(closeTag, start) + closeTag.length;
			if (end < start + closeTag.length) {
				break;
			}
			const xml = slideXml.slice(start, end);
			const cNvPr = /<(?:\w+:)?cNvPr\b[^>]*>/u.exec(xml)?.[0] ?? '';
			out.push({ kind, xml, id: readAttr(cNvPr, 'id'), name: readAttr(cNvPr, 'name') });
			open.lastIndex = end;
		}
	}
	return out;
}

/** Every `xmlns:prefix="uri"` declared anywhere in `xml` (first declaration of a prefix wins). */
function collectNamespaces(xml: string): Map<string, string> {
	const out = new Map<string, string>();
	for (const m of xml.matchAll(/\sxmlns:([\w.-]+)="([^"]*)"/gu)) {
		if (!out.has(m[1]!)) {
			out.set(m[1]!, m[2]!);
		}
	}
	return out;
}

/**
 * Re-root `candidate` as a standalone package part: rename a graphic frame to
 * `p:E2oFrame` and declare on its root every namespace prefix the slide
 * declares that the fragment's own root does not already declare.
 */
function reroot(candidate: Candidate, slideNamespaces: Map<string, string>): string {
	const tag = candidate.kind === 'ink' ? 'p:contentPart' : 'p:graphicFrame';
	const rootTag = candidate.kind === 'ink' ? 'p:contentPart' : 'p:E2oFrame';
	let xml = candidate.xml;
	if (rootTag !== tag) {
		xml = `<${rootTag}${xml.slice(tag.length + 1, xml.length - tag.length - 3)}</${rootTag}>`;
	}
	const openEnd = xml.indexOf('>');
	const openTag = xml.slice(0, openEnd);
	const declared = collectNamespaces(openTag);
	let decls = '';
	for (const [prefix, uri] of slideNamespaces) {
		if (!declared.has(prefix)) {
			decls += ` xmlns:${prefix}="${uri}"`;
		}
	}
	const insertAt = rootTag.length + 1;
	return xml.slice(0, insertAt) + decls + xml.slice(insertAt);
}

/** Slide relationship ids referenced by `r:*` attributes inside `xml`. */
export function referencedRelIds(xml: string): string[] {
	const ids = new Set<string>();
	for (const m of xml.matchAll(/\sr:[A-Za-z]+="([^"]+)"/gu)) {
		ids.add(m[1]!);
	}
	return [...ids];
}

/**
 * Find the element `match` names inside `slideXml` and return it as a
 * `metroBlob` package root, or `undefined` when it cannot be located
 * unambiguously (the caller then keeps the plain picture/placeholder).
 */
export function findMetroFragment(
	slideXml: string,
	match: MetroFragmentMatch,
): MetroFragment | undefined {
	const candidates = listCandidates(slideXml);
	let hits: Candidate[] = [];
	if (match.shapeId !== undefined) {
		hits = candidates.filter((c) => c.id === match.shapeId);
	} else if (match.name) {
		hits = candidates.filter((c) => c.name === match.name);
	}
	// The same element can appear twice (mc:Choice + mc:Fallback); both copies
	// of a real match share one kind, so only a kind conflict is ambiguous.
	const hit = hits[0];
	if (!hit || hits.some((c) => c.kind !== hit.kind)) {
		return undefined;
	}
	const xml = reroot(hit, collectNamespaces(slideXml));
	return { kind: hit.kind, xml, relIds: referencedRelIds(hit.xml), shapeId: hit.id };
}
