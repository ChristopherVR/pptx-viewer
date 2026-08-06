/**
 * Structural integrity validation for a saved .pptx package.
 *
 * A .pptx that "opens" in this viewer can still trigger PowerPoint's repair
 * prompt; the repair triggers are almost always OPC packaging faults, not
 * drawing-level ones. This module checks the package the way PowerPoint's
 * loader does before it ever looks at a shape:
 *
 *   (a) `[Content_Types].xml` exists and covers every part, by extension
 *       default or by exact override;
 *   (b) every `*.xml` / `*.rels` part is well-formed XML;
 *   (c) every relationship target in every `.rels` part resolves to a real
 *       zip entry (relative `../` targets and absolute `/ppt/...` targets are
 *       both legal - see `absolute-path-rels.spec.ts`);
 *   (d) every `p:sldId` in `presentation.xml` maps through the presentation
 *       `.rels` to an existing slide part.
 *
 * jszip and fast-xml-parser are resolved from `pptx-viewer-core`'s dependency
 * scope (the same pattern as `e2e/fixtures/generate-chart-fixture.ts`) so the
 * e2e harness needs no dependencies of its own.
 *
 * @module e2e/support/pptx-integrity
 */
import { createRequire } from 'node:module';

const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip') as typeof import('jszip');
const { XMLParser, XMLValidator } = coreRequire(
	'fast-xml-parser',
) as typeof import('fast-xml-parser');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

/** Narrowing helper: `value` as a record, or undefined. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

/** All values under `key`, normalised to an array (fxp collapses singletons). */
function children(node: Record<string, unknown> | undefined, key: string): unknown[] {
	const value = node?.[key];
	if (value === undefined) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

/** String attribute `name` of `node`, if present. */
function attr(node: unknown, name: string): string | undefined {
	const value = asRecord(node)?.[`@_${name}`];
	return typeof value === 'string' ? value : undefined;
}

/**
 * Resolve a relationship target against the part that owns the `.rels` file.
 *
 * `relsPath` is `<base>/_rels/<part>.rels`; relative targets resolve against
 * `<base>`, absolute targets (leading `/`) against the package root. `../`
 * segments are folded out, matching OPC part-name resolution.
 */
export function resolveRelationshipTarget(relsPath: string, target: string): string {
	const clean = target.split('#')[0];
	if (clean.startsWith('/')) {
		return clean.slice(1);
	}
	const baseDir = relsPath.replace(/\/?_rels\/[^/]+$/u, '');
	const segments = baseDir === '' ? [] : baseDir.split('/');
	for (const segment of clean.split('/')) {
		if (segment === '..') {
			segments.pop();
		} else if (segment !== '.' && segment !== '') {
			segments.push(segment);
		}
	}
	return segments.join('/');
}

/**
 * Validate the package. Returns a list of human-readable problems; a sound
 * package returns `[]`. Specs assert `toEqual([])` so a failure names every
 * fault at once.
 */
export async function validatePptxIntegrity(bytes: Uint8Array): Promise<string[]> {
	const problems: string[] = [];
	const zip = await JSZip.loadAsync(bytes);
	const partNames = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
	const textOf = async (name: string): Promise<string> => zip.files[name].async('string');

	// (a) [Content_Types].xml covers every part.
	const contentTypesName = '[Content_Types].xml';
	if (!partNames.includes(contentTypesName)) {
		problems.push('missing [Content_Types].xml');
		return problems;
	}
	const typesDoc = asRecord(asRecord(parser.parse(await textOf(contentTypesName)))?.['Types']);
	const defaultExtensions = new Set(
		children(typesDoc, 'Default')
			.map((node) => attr(node, 'Extension')?.toLowerCase())
			.filter((ext): ext is string => ext !== undefined),
	);
	const overrideParts = new Set(
		children(typesDoc, 'Override')
			.map((node) => attr(node, 'PartName'))
			.filter((part): part is string => part !== undefined),
	);
	for (const name of partNames) {
		if (name === contentTypesName) {
			continue;
		}
		const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
		if (!defaultExtensions.has(extension) && !overrideParts.has(`/${name}`)) {
			problems.push(`content-types: part /${name} has no extension default or override`);
		}
	}

	// (b) every *.xml / *.rels part parses as XML.
	const xmlParts = partNames.filter((name) => /\.(?:xml|rels)$/u.test(name));
	for (const name of xmlParts) {
		const verdict = XMLValidator.validate(await textOf(name));
		if (verdict !== true) {
			problems.push(`xml: part /${name} is not well-formed (${verdict.err.msg})`);
		}
	}

	// (c) every internal relationship target resolves to a zip entry.
	const partSet = new Set(partNames);
	for (const relsName of partNames.filter((name) => name.endsWith('.rels'))) {
		const relsDoc = asRecord(asRecord(parser.parse(await textOf(relsName)))?.['Relationships']);
		for (const rel of children(relsDoc, 'Relationship')) {
			if (attr(rel, 'TargetMode') === 'External') {
				continue;
			}
			const target = attr(rel, 'Target');
			if (target === undefined) {
				problems.push(`rels: /${relsName} has a Relationship with no Target`);
				continue;
			}
			const resolved = resolveRelationshipTarget(relsName, target);
			if (!partSet.has(resolved)) {
				problems.push(
					`rels: /${relsName} ${attr(rel, 'Id') ?? '(no Id)'} -> "${target}" ` +
						`resolves to missing part /${resolved}`,
				);
			}
		}
	}

	// (d) presentation.xml sldIdLst entries map to real slide parts.
	const presentationName = 'ppt/presentation.xml';
	const presentationRelsName = 'ppt/_rels/presentation.xml.rels';
	if (!partSet.has(presentationName) || !partSet.has(presentationRelsName)) {
		problems.push('missing ppt/presentation.xml or its .rels');
		return problems;
	}
	const relsById = new Map<string, { type: string; target: string }>();
	const presRels = asRecord(
		asRecord(parser.parse(await textOf(presentationRelsName)))?.['Relationships'],
	);
	for (const rel of children(presRels, 'Relationship')) {
		const id = attr(rel, 'Id');
		if (id !== undefined) {
			relsById.set(id, { type: attr(rel, 'Type') ?? '', target: attr(rel, 'Target') ?? '' });
		}
	}
	const presDoc = asRecord(
		asRecord(parser.parse(await textOf(presentationName)))?.['p:presentation'],
	);
	const sldIds = children(asRecord(presDoc?.['p:sldIdLst']), 'p:sldId');
	if (sldIds.length === 0) {
		problems.push('presentation.xml has an empty p:sldIdLst');
	}
	for (const sldId of sldIds) {
		const rId = attr(sldId, 'r:id');
		if (rId === undefined) {
			problems.push('presentation.xml: p:sldId without r:id');
			continue;
		}
		const rel = relsById.get(rId);
		if (!rel) {
			problems.push(`presentation.xml: p:sldId ${rId} has no matching relationship`);
			continue;
		}
		if (!rel.type.endsWith('/slide')) {
			problems.push(`presentation.xml: ${rId} is not a slide relationship (${rel.type})`);
			continue;
		}
		const resolved = resolveRelationshipTarget(presentationRelsName, rel.target);
		if (!partSet.has(resolved)) {
			problems.push(`presentation.xml: ${rId} -> missing slide part /${resolved}`);
		}
	}

	return problems;
}

/** Deck facts a spec can assert the rendered result against. */
export interface DeckSummary {
	/** Number of `p:sldId` entries in the authored slide order. */
	slideCount: number;
	/**
	 * Direct `p:spTree` children of the FIRST slide (sp/pic/graphicFrame/
	 * cxnSp/grpSp). This is the floor for the rendered element count: layout
	 * and master placeholders can legitimately add rendered elements on top.
	 */
	firstSlideElementCount: number;
}

/** Parse `bytes` and summarise the deck (slide order via the presentation rels). */
export async function summarizeDeck(bytes: Uint8Array): Promise<DeckSummary> {
	const zip = await JSZip.loadAsync(bytes);
	const textOf = async (name: string): Promise<string> => zip.files[name].async('string');
	const presRels = asRecord(
		asRecord(parser.parse(await textOf('ppt/_rels/presentation.xml.rels')))?.['Relationships'],
	);
	const targetsById = new Map<string, string>();
	for (const rel of children(presRels, 'Relationship')) {
		const id = attr(rel, 'Id');
		const target = attr(rel, 'Target');
		if (id !== undefined && target !== undefined) {
			targetsById.set(id, target);
		}
	}
	const presDoc = asRecord(
		asRecord(parser.parse(await textOf('ppt/presentation.xml')))?.['p:presentation'],
	);
	const sldIds = children(asRecord(presDoc?.['p:sldIdLst']), 'p:sldId');
	const firstRId = attr(sldIds[0], 'r:id');
	const firstTarget = firstRId === undefined ? undefined : targetsById.get(firstRId);
	if (firstTarget === undefined) {
		throw new Error('deck has no resolvable first slide');
	}
	const firstSlidePath = resolveRelationshipTarget('ppt/_rels/presentation.xml.rels', firstTarget);
	const slideDoc = asRecord(asRecord(parser.parse(await textOf(firstSlidePath)))?.['p:sld']);
	const tree = asRecord(asRecord(slideDoc?.['p:cSld'])?.['p:spTree']);
	const kinds = ['p:sp', 'p:pic', 'p:graphicFrame', 'p:cxnSp', 'p:grpSp'];
	const firstSlideElementCount = kinds.reduce((sum, kind) => sum + children(tree, kind).length, 0);
	return { slideCount: sldIds.length, firstSlideElementCount };
}
