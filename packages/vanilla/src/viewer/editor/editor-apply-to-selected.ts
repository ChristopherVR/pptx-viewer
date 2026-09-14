import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import { inlineListBodyText, updateTextSegmentStyle } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { getActiveElements, replaceActiveElements } from './editor-active-elements';
import type { EditorOps } from './editor-operations';

/**
 * Shared "apply a formatting patch to the selected element, history-integrated"
 * helper used by every action-composer file (`editor-text-actions.ts`,
 * `editor-arrange-actions.ts`, ...). Extracted from `editor-edit-ops.ts` so
 * each action file can build its own small, focused handler set without
 * duplicating the push-history / no-op-guard boilerplate.
 */
export type ApplyToSelected = (
	build: (
		el: PptxElement,
		snapshot?: import('pptx-viewer-shared').InlineTextEditSnapshot,
	) => Partial<PptxElement>,
) => void;

export function createApplyToSelected(store: Store<ViewerState>, ops: EditorOps): ApplyToSelected {
	return (build) => {
		const state = store.get();
		const id = state.selectedElementId;
		const el = ops.selectedElement(state);
		if (!state.editable || !id || !el) {
			return;
		}
		const live = ops.readInlineList?.();
		if (live?.kind === 'unsupported') {
			return;
		}
		const snapshot =
			live?.kind === 'supported' && live.snapshot.elementId === id ? live.snapshot : undefined;
		const current = snapshot
			? ({ ...el, text: snapshot.text, textSegments: snapshot.textSegments } as PptxElement)
			: el;
		let patch = build(current, snapshot);
		if (Object.keys(patch).length === 0) {
			return;
		}
		if (
			snapshot &&
			hasTextProperties(current) &&
			('textStyle' in patch || 'textSegments' in patch)
		) {
			const changes = Object.fromEntries(
				Object.entries(patch.textStyle ?? {}).filter(
					([key, value]) => value !== current.textStyle?.[key as keyof typeof current.textStyle],
				),
			);
			const segments = ('textSegments' in patch ? patch.textSegments : snapshot.textSegments)?.map(
				(segment) => updateTextSegmentStyle(segment, changes),
			);
			const text = inlineListBodyText(segments);
			if (text !== snapshot.text) {
				ops.cancelInlineList?.();
			} else if (!ops.formatInlineList?.({ elementId: id, text, textSegments: segments })) {
				return;
			}
			patch = { ...patch, text, textSegments: segments } as Partial<PptxElement>;
		}
		ops.pushHistory();
		store.set(
			replaceActiveElements(
				state,
				getActiveElements(state).map((element) =>
					element.id === id ? ({ ...element, ...patch } as PptxElement) : element,
				),
			),
		);
		ops.commitChange();
	};
}
