/**
 * Package side of the `.ppt` `metroBlob` writer: given a saved `.pptx`
 * (JSZip) and one element's slide-relative relationship ids, copies every
 * part that element depends on (InkML, the five SmartArt parts, a chart and
 * its embedded workbook/style/colour parts, a 3D model's `.glb` and poster)
 * into the `drs/` tree a `metroBlob` package uses, keeping each part's own
 * relationships and content type.
 *
 * Part paths map `ppt/<rest>` to `drs/<rest>`, so every relative target a
 * copied part's own `.rels` holds (e.g. a chart's `../embeddings/...`) stays
 * valid unchanged. This matches PowerPoint's own layout (`drs/diagrams/...`,
 * `drs/ink/...`).
 *
 * @module ppt/writer/metro-blob-source
 */

import type JSZip from 'jszip';

/** One OPC relationship. */
export interface MetroRel {
	id: string;
	type: string;
	target: string;
	external: boolean;
}

/** Everything copied out of the source package for one element. */
export interface MetroParts {
	/** Relationships of the package root part (targets relative to `drs/`). */
	rootRels: MetroRel[];
	/** Copied parts (and their `.rels`), keyed by package path. */
	parts: Map<string, Uint8Array>;
	/** Content type per copied part path (Override semantics). */
	contentTypes: Map<string, string>;
}

const DIAGRAM_DATA_REL =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData';

function attr(tag: string, name: string): string | undefined {
	return new RegExp(`\\s${name}="([^"]*)"`, 'u').exec(tag)?.[1];
}

/** Parse a `.rels` part. */
export function parseRels(xml: string): MetroRel[] {
	const out: MetroRel[] = [];
	for (const m of xml.matchAll(/<(?:\w+:)?Relationship\b[^>]*>/gu)) {
		const tag = m[0];
		const id = attr(tag, 'Id');
		const type = attr(tag, 'Type');
		const target = attr(tag, 'Target');
		if (id && type && target !== undefined) {
			out.push({ id, type, target, external: attr(tag, 'TargetMode') === 'External' });
		}
	}
	return out;
}

/** Resolve a relative OPC target against the directory of `sourcePath`. */
export function resolveTarget(sourcePath: string, target: string): string {
	if (target.startsWith('/')) {
		return target.slice(1);
	}
	const parts = sourcePath.split('/').slice(0, -1);
	for (const seg of target.split('/')) {
		if (seg === '..') {
			parts.pop();
		} else if (seg !== '.' && seg !== '') {
			parts.push(seg);
		}
	}
	return parts.join('/');
}

/** `ppt/x/y.xml` -> `ppt/x/_rels/y.xml.rels`. */
export function relsPathFor(partPath: string): string {
	const slash = partPath.lastIndexOf('/');
	return `${partPath.slice(0, slash + 1)}_rels/${partPath.slice(slash + 1)}.rels`;
}

/** Content type of `partPath` according to the source `[Content_Types].xml`. */
function contentTypeOf(contentTypesXml: string, partPath: string): string | undefined {
	for (const m of contentTypesXml.matchAll(/<(?:\w+:)?Override\b[^>]*>/gu)) {
		if (attr(m[0], 'PartName')?.toLowerCase() === `/${partPath}`.toLowerCase()) {
			return attr(m[0], 'ContentType');
		}
	}
	const ext = partPath.slice(partPath.lastIndexOf('.') + 1).toLowerCase();
	for (const m of contentTypesXml.matchAll(/<(?:\w+:)?Default\b[^>]*>/gu)) {
		if (attr(m[0], 'Extension')?.toLowerCase() === ext) {
			return attr(m[0], 'ContentType');
		}
	}
	return undefined;
}

/** `ppt/<rest>` -> `drs/<rest>`; anything outside `ppt/` cannot be carried. */
function toPackagePath(sourcePath: string): string | undefined {
	return sourcePath.startsWith('ppt/') ? `drs/${sourcePath.slice(4)}` : undefined;
}

/**
 * Copy the parts `relIds` (relationships of `slidePath`) reach, recursively,
 * out of `zip`. Returns `undefined` when a referenced internal part is missing
 * or unrepresentable, so the caller never emits a package with a dangling
 * relationship.
 */
export async function collectMetroParts(
	zip: JSZip,
	slidePath: string,
	relIds: string[],
): Promise<MetroParts | undefined> {
	const slideRelsXml = await zip.file(relsPathFor(slidePath))?.async('string');
	const contentTypesXml = (await zip.file('[Content_Types].xml')?.async('string')) ?? '';
	const slideRels = new Map(parseRels(slideRelsXml ?? '').map((r) => [r.id, r]));
	const result: MetroParts = { rootRels: [], parts: new Map(), contentTypes: new Map() };
	const visited = new Set<string>();

	const copyPart = async (sourcePath: string): Promise<boolean> => {
		if (visited.has(sourcePath)) {
			return true;
		}
		visited.add(sourcePath);
		const target = toPackagePath(sourcePath);
		const bytes = await zip.file(sourcePath)?.async('uint8array');
		const type = contentTypeOf(contentTypesXml, sourcePath);
		if (!target || !bytes || !type) {
			return false;
		}
		result.parts.set(target, bytes);
		result.contentTypes.set(target, type);
		const relsXml = await zip.file(relsPathFor(sourcePath))?.async('string');
		if (relsXml === undefined) {
			return true;
		}
		result.parts.set(relsPathFor(target), new TextEncoder().encode(relsXml));
		for (const rel of parseRels(relsXml)) {
			if (!rel.external && !(await copyPart(resolveTarget(sourcePath, rel.target)))) {
				return false;
			}
		}
		return true;
	};

	const pending = [...relIds];
	const seenIds = new Set<string>();
	while (pending.length > 0) {
		const id = pending.shift()!;
		if (seenIds.has(id)) {
			continue;
		}
		seenIds.add(id);
		const rel = slideRels.get(id);
		if (!rel) {
			return undefined;
		}
		if (rel.external) {
			result.rootRels.push(rel);
			continue;
		}
		const sourcePath = resolveTarget(slidePath, rel.target);
		if (!(await copyPart(sourcePath))) {
			return undefined;
		}
		result.rootRels.push({ ...rel, target: sourcePath.slice(4) });
		if (rel.type === DIAGRAM_DATA_REL) {
			// The pre-computed SmartArt drawing is referenced from the data
			// part's `dsp:dataModelExt/@relId`, which names a SLIDE relationship.
			const dataXml = (await zip.file(sourcePath)?.async('string')) ?? '';
			for (const m of dataXml.matchAll(/\srelId="([^"]+)"/gu)) {
				pending.push(m[1]!);
			}
		}
	}
	return result;
}
