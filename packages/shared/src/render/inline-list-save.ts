import type { PptxElement } from 'pptx-viewer-core';

import { updateElementById } from './element-operations';
import type { InlineTextEditSnapshot } from './inline-list-types';
import { buildInlineTextCommitPatch } from './inline-text-commit';
import { masterViewElements, replaceMasterViewElements } from './master-view';
import type { MasterViewDocument, MasterViewTarget, MasterViewWrite } from './master-view';

/** The viewer-owned edit session identifies the part to overlay, never just a global element ID. */
export interface PendingInlineTextEdit {
	snapshot: InlineTextEditSnapshot;
	text?: string;
	target: { slideId: string } | { masterView: MasterViewTarget };
}

/** Overlay a current rich list draft for serialization, without committing editor state. */
export function overlayInlineTextSnapshot(
	elements: readonly PptxElement[],
	snapshot?: InlineTextEditSnapshot,
	text = snapshot?.text,
): readonly PptxElement[] {
	if (!snapshot?.textSegments || text === undefined) {
		return elements;
	}
	let changed = false;
	const result = elements.map((element) => {
		if (element.id === snapshot.elementId) {
			const patch = buildInlineTextCommitPatch(element, text, snapshot);
			if (patch) {
				changed = true;
				return updateElementById([element], element.id, patch)[0];
			}
		}
		if (element.type === 'group' && element.children) {
			const children = overlayInlineTextSnapshot(element.children, snapshot, text);
			if (children !== element.children) {
				changed = true;
				return { ...element, children: [...children] };
			}
		}
		return element;
	});
	return changed ? result : elements;
}

/** Retain the same master/layout/auxiliary ownership rules used by ordinary commits. */
export function overlayMasterViewInlineSnapshot(
	document: MasterViewDocument,
	target: MasterViewTarget | null | undefined,
	snapshot?: InlineTextEditSnapshot,
	text = snapshot?.text,
): MasterViewWrite | null {
	const elements = masterViewElements(document, target);
	const next = overlayInlineTextSnapshot(elements, snapshot, text);
	return next === elements ? null : replaceMasterViewElements(document, target, next);
}
