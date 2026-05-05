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
import { VML_SHAPE_TAGS } from './vml-parser';

/**
 * Set of OOXML namespace prefixes understood by this implementation.
 * When an mc:Choice element requires ALL of its listed namespaces to be
 * in this set, the Choice branch is used; otherwise, mc:Fallback is used.
 */
const SUPPORTED_MC_NAMESPACES = new Set([
	// PowerPoint extensions
	'p14', // Office 2010
	'p15', // Office 2013
	'p16', // Office 2016
	'p16r3', // Office 2016 revision 3
	'p228', // Office 2021+
	'p232', // Office 2024
	// DrawingML extensions
	'a14', // Drawing 2010
	'a15', // Drawing 2013
	'a16', // Drawing 2016
	// SVG extension
	'asvg', // SVG blip
	// Slide layout / creative-content extensions
	'aclsl', // creative layout
	'asl', // slide layout
	// Word/common extensions that may appear in embedded content
	'w14', // Word 2010
	'w15', // Word 2013
	// Chart extensions
	'c16', // Chart 2016
	'c16r3', // Chart 2016 revision 3
	'cx', // ChartEx
	// Spreadsheet extensions (embedded charts)
	'x14', // Excel 2010
]);

/**
 * Check whether a set of required namespace prefixes are all supported.
 */
export function areNamespacesSupported(requires: string): boolean {
	if (!requires || requires.trim().length === 0) {
		return true;
	}
	const namespaces = requires.trim().split(/\s+/);
	return namespaces.every((ns) => SUPPORTED_MC_NAMESPACES.has(ns));
}

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
		if (areNamespacesSupported(requires)) {
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
 * `choice`) identifies which `mc:Choice` was selected — needed for
 * AC blocks containing multiple Choices.  `childRefs` holds the actual
 * XmlObject references that were appended to the parent container —
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
		if (requires.length === 0 || areNamespacesSupported(requires)) {
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
 * Returns a list of `AlternateContentBlock` records — one per consumed AC
 * envelope — so callers can preserve the original Choice/Fallback shape
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
 * Check whether a namespace prefix is in the supported set.
 */
export function isNamespaceSupported(ns: string): boolean {
	return SUPPORTED_MC_NAMESPACES.has(ns);
}

/**
 * Get a copy of the full set of supported namespace prefixes.
 */
export function getSupportedNamespaces(): ReadonlySet<string> {
	return SUPPORTED_MC_NAMESPACES;
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
