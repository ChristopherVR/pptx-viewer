/**
 * mc:AlternateContent handling utilities for OpenXML Markup Compatibility
 * and Extensibility (ECMA-376 Part 3).
 *
 * Modern Office versions wrap newer features in mc:AlternateContent blocks
 * with mc:Choice (requiring specific namespace support) and mc:Fallback
 * (for consumers that don't support the required namespace). This module
 * provides functions to resolve these blocks at parse time.
 */

import type { XmlObject } from '../types';
import {
	areNamespacesSupported,
	getSupportedNamespaces,
	isAlternateContentChoiceSupported,
	isAlternateContentChoiceXmlSupported,
	isNamespaceSupported,
} from './mc-capabilities';
import { VML_SHAPE_TAGS } from './vml-parser';

export {
	areNamespacesSupported,
	getSupportedNamespaces,
	isAlternateContentChoiceSupported,
	isAlternateContentChoiceXmlSupported,
	isNamespaceSupported,
};

/**
 * Select the appropriate branch from a parsed mc:AlternateContent element.
 *
 * Iterates through mc:Choice elements in order. Returns the first Choice
 * whose @Requires namespaces are all in the supported set. If no Choice
 * matches, returns the mc:Fallback content (or undefined if absent).
 *
 * Handles nested mc:AlternateContent within the selected branch by
 * recursively resolving them.
 */
export function selectAlternateContentBranch(ac: XmlObject): XmlObject | undefined {
	const choices = ensureArray(ac['mc:Choice']);
	for (const choice of choices) {
		const requires = String(choice?.['@_Requires'] ?? '').trim();
		if (requires.length === 0) {
			return resolveNestedAlternateContent(choice as XmlObject);
		}
		if (isAlternateContentChoiceSupported(choice as XmlObject)) {
			return resolveNestedAlternateContent(choice as XmlObject);
		}
	}
	const fallback = ac['mc:Fallback'] as XmlObject | undefined;
	if (fallback) {
		return resolveNestedAlternateContent(fallback);
	}
	return undefined;
}

/**
 * Recursively resolve any nested mc:AlternateContent within a branch.
 * Returns the branch with nested AC elements replaced by their resolved content.
 */
function resolveNestedAlternateContent(branch: XmlObject): XmlObject {
	const nested = ensureArray(branch['mc:AlternateContent']);
	if (nested.length === 0) {
		return branch;
	}

	// Clone the branch to avoid mutating the original parsed XML
	const resolved = { ...branch };
	delete resolved['mc:AlternateContent'];

	for (const ac of nested) {
		const selectedBranch = selectAlternateContentBranch(ac as XmlObject);
		if (!selectedBranch) {
			continue;
		}

		// Merge selected branch children into the resolved object
		for (const [key, value] of Object.entries(selectedBranch)) {
			if (key === '@_Requires') {
				continue;
			}
			if (key.startsWith('@_')) {
				continue;
			}
			if (resolved[key] !== undefined) {
				// Merge arrays
				const existing = ensureArray(resolved[key]);
				const incoming = ensureArray(value);
				resolved[key] = [...existing, ...incoming];
			} else {
				resolved[key] = value;
			}
		}
	}

	return resolved;
}

/**
 * Element tag names that represent renderable shapes/objects in a shape tree.
 */
export const SHAPE_TREE_ELEMENT_TAGS = new Set([
	'p:sp',
	'p:pic',
	'p:graphicFrame',
	'p:grpSp',
	'p:cxnSp',
	'p:contentPart',
	'p16:model3D',
	'pslz:sldZm',
	'psezm:sectionZm',
	'psuz:summaryZm',
	...VML_SHAPE_TAGS,
]);

/**
 * Record of a single `mc:AlternateContent` block resolved during parse.
 *
 * Captured by {@link unwrapAlternateContent} so the runtime can reproduce
 * the original `<mc:Choice>` / `<mc:Fallback>` envelope on dirty save.
 *
 * `rawAc` is the parsed AC envelope object exactly as fast-xml-parser
 * produced it (containing one or more `mc:Choice` children plus an
 * optional `mc:Fallback`).  `selectedBranch` indicates which branch was
 * merged into the spTree at parse time.  `choiceIndex` (when branch is
 * `choice`) identifies which `mc:Choice` was selected - needed for
 * AC blocks containing multiple Choices.  `childRefs` holds the actual
 * XmlObject references that were appended to the parent container -
 * used by the save layer to associate parsed elements with this block.
 */
export interface AlternateContentBlock {
	rawAc: XmlObject;
	selectedBranch: 'choice' | 'fallback';
	choiceIndex?: number;
	childRefs: Array<{ tag: string; node: XmlObject }>;
}

/**
 * Internal: locate which Choice (by index) `selectAlternateContentBranch`
 * picked, mirroring its iteration order.  Returns `{ branch, choiceIndex }`
 * for Choice selection, or `{ branch: 'fallback' }` for fallback.
 */
function diagnoseSelection(
	ac: XmlObject,
):
	| { branch: 'choice'; choiceIndex: number; resolved: XmlObject }
	| { branch: 'fallback'; resolved: XmlObject }
	| undefined {
	const choices = ensureArray(ac['mc:Choice']);
	for (let i = 0; i < choices.length; i++) {
		const choice = choices[i];
		const requires = String(choice?.['@_Requires'] ?? '').trim();
		if (requires.length === 0 || isAlternateContentChoiceSupported(choice as XmlObject)) {
			const resolved = resolveNestedAlternateContent(choice as XmlObject);
			return { branch: 'choice', choiceIndex: i, resolved };
		}
	}
	const fallback = ac['mc:Fallback'] as XmlObject | undefined;
	if (fallback) {
		return { branch: 'fallback', resolved: resolveNestedAlternateContent(fallback) };
	}
	return undefined;
}

/**
 * Unwrap mc:AlternateContent elements within a shape tree (or group)
 * container, merging the selected branch's children into the parent
 * element arrays.
 *
 * This mutates the container in-place: mc:AlternateContent entries are
 * consumed, and their resolved element children (p:sp, p:pic, etc.) are
 * appended to the corresponding arrays on the container.
 *
 * Returns a list of `AlternateContentBlock` records - one per consumed AC
 * envelope - so callers can preserve the original Choice/Fallback shape
 * on save (CC-4).  The returned `childRefs` reference the same XmlObject
 * instances that were merged into the container, so callers can identify
 * them later via reference equality.
 */
export function unwrapAlternateContent(
	container: Record<string, unknown>,
): AlternateContentBlock[] {
	const altContents = ensureArray(container['mc:AlternateContent']);
	if (altContents.length === 0) {
		return [];
	}

	const blocks: AlternateContentBlock[] = [];
	for (const ac of altContents) {
		const diagnosis = diagnoseSelection(ac as XmlObject);
		if (!diagnosis) {
			continue;
		}
		const block: AlternateContentBlock = {
			rawAc: ac as XmlObject,
			selectedBranch: diagnosis.branch,
			choiceIndex: diagnosis.branch === 'choice' ? diagnosis.choiceIndex : undefined,
			childRefs: [],
		};
		const branch = diagnosis.resolved;
		for (const tag of SHAPE_TREE_ELEMENT_TAGS) {
			const children = ensureArray(branch[tag]);
			if (children.length > 0) {
				container[tag] = [...ensureArray(container[tag]), ...children];
				for (const child of children) {
					block.childRefs.push({ tag, node: child });
				}
			}
		}
		if (block.childRefs.length > 0) {
			blocks.push(block);
		}
	}
	// Drop the now-consumed AC envelopes so downstream document-order
	// scanning doesn't double-process them.
	delete container['mc:AlternateContent'];
	return blocks;
}

/**
 * The passthrough-save counterpart to {@link unwrapAlternateContent}: rebuild
 * `mc:AlternateContent` envelopes that were flattened at parse time, using the
 * records `unwrapAlternateContent` left in `blockByNode`.
 *
 * Layout and master parts that a save leaves untouched are re-serialized
 * straight from the cached, ALREADY-UNWRAPPED parse-time XmlObject (see
 * `PptxHandlerRuntimeSavePipeline`'s passthrough flush) - there is no writer
 * pass to re-wrap them the way an edited part gets via
 * `reapplyAlternateContentEnvelopes`. Without this, an `mc:AlternateContent`
 * envelope inside a slide master or layout's shape tree is unwrapped on the
 * FIRST load and never reconstituted: the `mc:Fallback` branch is discarded
 * permanently and the depth-0 child sequence changes, even on a save that
 * edited nothing (CC-4 for templates; see `template-mce.pptx` in the fixture
 * corpus manifest).
 *
 * Never mutates `container`: returns the same reference when nothing needs
 * restoring, or a new tree - cloned only at the levels that changed, exactly
 * like the sibling `withTemplateSpTreeOrder` ordering pass - so the cached
 * `layoutXmlMap` / `masterXmlMap` entry a second save reads is untouched.
 * Recurses into `p:grpSp` because `unwrapAlternateContent` runs per-group too.
 */
export function reapplyAlternateContentToTree(
	container: XmlObject,
	blockByNode: WeakMap<XmlObject, AlternateContentBlock>,
): XmlObject {
	let working = container;

	// Nested groups first, bottom-up, so an envelope inside a p:grpSp is
	// restored before this level decides whether it changed anything.
	const groups = ensureArray(working['p:grpSp']);
	if (groups.length > 0) {
		let groupsChanged = false;
		const nextGroups = groups.map((group) => {
			const next = reapplyAlternateContentToTree(group, blockByNode);
			if (next !== group) {
				groupsChanged = true;
			}
			return next;
		});
		if (groupsChanged) {
			working = { ...working, 'p:grpSp': nextGroups };
		}
	}

	// Find which of this container's own tag-array children are AC-tracked,
	// grouped by the envelope they came from (a block may contribute several
	// sibling tags, e.g. Choice = p14:media + p:pic fallback).
	const blockGroups = new Map<AlternateContentBlock, Array<{ tag: string; node: XmlObject }>>();
	for (const tag of SHAPE_TREE_ELEMENT_TAGS) {
		for (const node of ensureArray(working[tag])) {
			const block = blockByNode.get(node);
			if (!block) {
				continue;
			}
			let entries = blockGroups.get(block);
			if (!entries) {
				entries = [];
				blockGroups.set(block, entries);
			}
			entries.push({ tag, node });
		}
	}
	if (blockGroups.size === 0) {
		return working;
	}

	const nextArrays = new Map<string, XmlObject[]>();
	const arrayFor = (tag: string): XmlObject[] => {
		let arr = nextArrays.get(tag);
		if (!arr) {
			arr = [...ensureArray(working[tag])];
			nextArrays.set(tag, arr);
		}
		return arr;
	};

	const envelopes: XmlObject[] = [...ensureArray(working['mc:AlternateContent'])];
	for (const [block, entries] of blockGroups) {
		// Pull the tracked nodes back out of the flat tag arrays so they are
		// not emitted both bare and inside the reconstructed envelope.
		for (const entry of entries) {
			const arr = arrayFor(entry.tag);
			const idx = arr.indexOf(entry.node);
			if (idx !== -1) {
				arr.splice(idx, 1);
			}
		}

		const liveByTag = new Map<string, XmlObject[]>();
		for (const entry of entries) {
			let nodes = liveByTag.get(entry.tag);
			if (!nodes) {
				nodes = [];
				liveByTag.set(entry.tag, nodes);
			}
			nodes.push(entry.node);
		}

		// Clone the original envelope and splice the live nodes back into the
		// branch that was selected at parse time; the other branch (usually
		// the Fallback) is preserved verbatim from `rawAc`.
		const clonedAc: XmlObject = { ...block.rawAc };
		if (block.selectedBranch === 'choice') {
			const choices = ensureArray(clonedAc['mc:Choice']);
			const targetIdx = block.choiceIndex ?? 0;
			const original = choices[targetIdx];
			if (original) {
				const rebuilt: XmlObject = { ...original };
				for (const tag of SHAPE_TREE_ELEMENT_TAGS) {
					delete rebuilt[tag];
				}
				for (const [tag, nodes] of liveByTag) {
					rebuilt[tag] = nodes.length === 1 ? nodes[0] : nodes;
				}
				const nextChoices = [...choices];
				nextChoices[targetIdx] = rebuilt;
				clonedAc['mc:Choice'] = nextChoices.length === 1 ? nextChoices[0] : nextChoices;
			}
		} else {
			const fallback = clonedAc['mc:Fallback'] as XmlObject | undefined;
			if (fallback) {
				const rebuilt: XmlObject = { ...fallback };
				for (const tag of SHAPE_TREE_ELEMENT_TAGS) {
					delete rebuilt[tag];
				}
				for (const [tag, nodes] of liveByTag) {
					rebuilt[tag] = nodes.length === 1 ? nodes[0] : nodes;
				}
				clonedAc['mc:Fallback'] = rebuilt;
			}
		}
		envelopes.push(clonedAc);
	}

	const next: XmlObject = { ...working };
	for (const [tag, arr] of nextArrays) {
		if (arr.length > 0) {
			next[tag] = arr;
		} else {
			delete next[tag];
		}
	}
	next['mc:AlternateContent'] = envelopes.length === 1 ? envelopes[0] : envelopes;
	return next;
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function ensureArray(val: unknown): XmlObject[] {
	if (!val) {
		return [];
	}
	const arr = Array.isArray(val) ? val : [val];
	return arr as XmlObject[];
}
