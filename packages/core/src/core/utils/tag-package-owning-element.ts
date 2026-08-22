/**
 * Author/remove the `<p:tags r:id=".."/>` (CT_TagsData) element that OWNS a
 * tags-part relationship.
 *
 * `p:tags` is a child of `p:custDataLst` (CT_CustomerDataList), itself a
 * child of either `p:presentation` or a `p:cSld`-bearing part (slide, notes
 * slide, slide layout, slide master, handout master - CT_CommonSlideData is
 * shared by all of them). Without this element, real PowerPoint's smart-tags
 * UI never sees a tags part that only exists as a bare relationship - see
 * `src/__tests__/integration/tag-part-authoring.test.ts` for the authoring
 * contract this closes.
 *
 * @module tag-package-owning-element
 */
import type JSZip from 'jszip';

import type { XmlObject } from '../types';

interface XmlCodec {
	parse(xml: string): XmlObject;
	build(data: XmlObject): string;
}

/** Package parts whose content sits under a `p:cSld` (CT_CommonSlideData). */
const CSLD_ROOTS = ['p:sld', 'p:notes', 'p:sldLayout', 'p:sldMaster', 'p:handoutMaster'] as const;

/** CT_Presentation child order: ... custDataLst, kinsoku, defaultTextStyle, modifyVerifier, extLst. */
const PRESENTATION_INSERT_BEFORE = new Set([
	'p:kinsoku',
	'p:defaultTextStyle',
	'p:modifyVerifier',
	'p:extLst',
]);
/** CT_CommonSlideData child order: bg, spTree, custDataLst, controls, extLst. */
const CSLD_INSERT_BEFORE = new Set(['p:controls', 'p:extLst']);

interface TagsContainer {
	container: XmlObject;
	insertBefore: ReadonlySet<string>;
}

function resolveTagsContainer(data: XmlObject): TagsContainer | undefined {
	const presentation = data['p:presentation'] as XmlObject | undefined;
	if (presentation) {
		return { container: presentation, insertBefore: PRESENTATION_INSERT_BEFORE };
	}
	for (const rootKey of CSLD_ROOTS) {
		const root = data[rootKey] as XmlObject | undefined;
		if (root) {
			const cSld = (root['p:cSld'] ??= {}) as XmlObject;
			return { container: cSld, insertBefore: CSLD_INSERT_BEFORE };
		}
	}
	return undefined;
}

/** Insert (or reposition) `value` under `key` in `container`, respecting schema order. */
function placeAtKey(
	container: XmlObject,
	key: string,
	value: XmlObject,
	insertBefore: ReadonlySet<string>,
): void {
	const rebuilt: XmlObject = {};
	let inserted = false;
	for (const [childKey, childValue] of Object.entries(container)) {
		if (childKey === key) {
			continue;
		}
		if (!inserted && insertBefore.has(childKey)) {
			rebuilt[key] = value;
			inserted = true;
		}
		rebuilt[childKey] = childValue;
	}
	if (!inserted) {
		rebuilt[key] = value;
	}
	for (const existingKey of Object.keys(container)) {
		delete container[existingKey];
	}
	Object.assign(container, rebuilt);
}

/**
 * Write `<p:tags r:id="..">` into the owning part's `p:custDataLst`, merging
 * with any existing `p:custData` entries and preserving unknown XML.
 */
export async function upsertTagsOwningElement(
	zip: JSZip,
	codec: XmlCodec,
	sourcePartPath: string,
	relationshipId: string,
): Promise<void> {
	const xml = await zip.file(sourcePartPath)?.async('string');
	if (!xml) {
		return;
	}
	const data = codec.parse(xml);
	const resolved = resolveTagsContainer(data);
	if (!resolved) {
		return;
	}
	const { container, insertBefore } = resolved;
	const list = { ...((container['p:custDataLst'] as XmlObject | undefined) ?? {}) } as XmlObject;
	list['p:tags'] = { '@_r:id': relationshipId };
	placeAtKey(container, 'p:custDataLst', list, insertBefore);
	zip.file(sourcePartPath, codec.build(data));
}

/**
 * Remove `<p:tags r:id=".."/>` from the owning part's `p:custDataLst`,
 * dropping the list entirely once it carries neither tags nor custom data.
 */
export async function removeTagsOwningElement(
	zip: JSZip,
	codec: XmlCodec,
	sourcePartPath: string,
): Promise<void> {
	const xml = await zip.file(sourcePartPath)?.async('string');
	if (!xml) {
		return;
	}
	const data = codec.parse(xml);
	const resolved = resolveTagsContainer(data);
	if (!resolved) {
		return;
	}
	const list = resolved.container['p:custDataLst'] as XmlObject | undefined;
	if (!list || list['p:tags'] === undefined) {
		return;
	}
	delete list['p:tags'];
	if (Object.keys(list).length === 0) {
		delete resolved.container['p:custDataLst'];
	}
	zip.file(sourcePartPath, codec.build(data));
}
