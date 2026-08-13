/**
 * master-view-editing.ts: the master-view edits that are not element patches.
 *
 * Splits out of {@link module:render/master-view} purely for file size; the
 * routing rules are the same ones, so every write here goes back through
 * `replaceMasterViewElements` or writes the same `MasterViewWrite` shape.
 *
 * @module render/master-view-editing
 */
import type { GroupPptxElement, PptxElement, PptxSlideLayout } from 'pptx-viewer-core';

import {
	masterViewElements,
	masterViewParts,
	primaryMasterViewPart,
	replaceMasterViewElements,
} from './master-view';
import type { MasterViewDocument, MasterViewTarget, MasterViewWrite } from './master-view';

/**
 * Remove elements from the master view, routing each removal to the part that
 * owns it. A layout canvas paints its master's artwork too, so deleting by
 * filtering the flat list and re-partitioning is the only way a shape leaves
 * the right shape tree.
 */
export function deleteMasterViewElements(
	document: MasterViewDocument,
	target: MasterViewTarget | null | undefined,
	elementIds: readonly string[],
): MasterViewWrite | null {
	if (elementIds.length === 0) {
		return null;
	}
	const doomed = new Set(elementIds);
	const remaining = masterViewElements(document, target).filter(
		(element) => !doomed.has(element.id),
	);
	return replaceMasterViewElements(document, target, remaining);
}

/** Whether `elementId` names one of this element's descendants. */
function containsMasterViewDescendant(element: PptxElement, elementId: string): boolean {
	if (element.type !== 'group') {
		return false;
	}
	for (const child of (element as GroupPptxElement).children ?? []) {
		if (child.id === elementId || containsMasterViewDescendant(child, elementId)) {
			return true;
		}
	}
	return false;
}

/**
 * The master-view element a pointer hit belongs to.
 *
 * A binding that resolves a click by walking up to the nearest
 * `[data-element-id]` lands on a GROUP CHILD, because every binding stamps that
 * marker on a group's children as well as on the group. Every master-view write
 * routes through the part's own TOP-LEVEL shape list, where a child id matches
 * nothing, so the edit is dropped without a word: Vue could delete a plain
 * master shape but never a group, which read as a broken Delete key rather than
 * a mis-aimed one.
 *
 * Ownership is decided by walking `children`, not by comparing id prefixes: a
 * group child's id does derive from its group's, but that is an id-format
 * convention the editor is free to break, and a prefix test would also claim a
 * sibling whose id merely starts the same way.
 *
 * @returns The owning top-level element's id, or `null` when the id belongs to
 *   nothing the master view is painting (a click on the surface, or on a
 *   navigation-rail preview).
 */
export function masterViewOwnerElementId(
	elements: readonly PptxElement[],
	elementId: string | null | undefined,
): string | null {
	if (!elementId) {
		return null;
	}
	for (const element of elements) {
		if (element.id === elementId || containsMasterViewDescendant(element, elementId)) {
			return element.id;
		}
	}
	return null;
}

/**
 * The background colour of the part the master view has selected.
 *
 * This is the *primary* part, not the whole painted stack: selecting a layout
 * shows the master's artwork behind it, but the background belongs to the
 * layout, and `masterViewParts` already falls back to the master's colour when
 * the layout declares none.
 */
export function masterViewBackgroundColor(
	document: MasterViewDocument,
	target: MasterViewTarget | null | undefined,
): string | undefined {
	return primaryMasterViewPart(masterViewParts(document, target))?.backgroundColor;
}

/**
 * Set the background colour on the part the master view has selected.
 *
 * The empty string means "remove", which restores inheritance from the master
 * (a layout PowerPoint has not touched carries no `p:bg` at all). Returns only
 * the models that changed, or `null` when the target resolves to nothing.
 */
export function setMasterViewBackgroundColor(
	document: MasterViewDocument,
	target: MasterViewTarget | null | undefined,
	backgroundColor: string,
): MasterViewWrite | null {
	const parts = masterViewParts(document, target);
	const primary = primaryMasterViewPart(parts);
	if (!primary) {
		return null;
	}
	if (primary.kind === 'notes') {
		return document.notesMaster
			? { notesMaster: { ...document.notesMaster, backgroundColor } }
			: null;
	}
	if (primary.kind === 'handout') {
		return document.handoutMaster
			? { handoutMaster: { ...document.handoutMaster, backgroundColor } }
			: null;
	}
	return {
		slideMasters: document.slideMasters.map((master, masterIndex) => {
			if (masterIndex !== primary.masterIndex) {
				return master;
			}
			if (primary.kind === 'master') {
				return { ...master, backgroundColor };
			}
			return {
				...master,
				layouts: master.layouts?.map((layout: PptxSlideLayout, layoutIndex: number) =>
					layoutIndex === primary.layoutIndex ? { ...layout, backgroundColor } : layout,
				),
			};
		}),
	};
}
