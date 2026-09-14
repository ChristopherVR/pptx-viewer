import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import {
	applyListStyleUpdate,
	applyTextStyleUpdate,
	applyActiveInlineListFormatting,
	buildInlineListStylePatch,
	getInlineEditorSelectionResult,
	transformInlineListCase,
	remapTextToSegments,
	toggleSelectionBullets,
} from 'pptx-viewer-shared';
import { useCallback } from 'react';

import { setPendingSelectionRestore } from '../utils/inline-selection-utils';
import { applyCaseTransformToSegments, transformTextCase } from '../utils/text-case-transform';
import type { ChangeCaseMode } from '../utils/text-case-transform';
import type { UseElementOperationsInput } from './useElementOperations';

type TextOperationsInput = Pick<
	UseElementOperationsInput,
	| 'selectedElement'
	| 'inlineEditingElementId'
	| 'inlineEditingText'
	| 'inlineEditingSnapshotRef'
	| 'setInlineEditingElementId'
> & { updateSelectedElement: (updates: Partial<PptxElement>) => void };

/** Text commands reconcile the current native draft before writing the model. */
export function useTextElementOperations(input: TextOperationsInput) {
	const {
		selectedElement,
		inlineEditingElementId,
		inlineEditingText,
		inlineEditingSnapshotRef,
		setInlineEditingElementId,
		updateSelectedElement,
	} = input;

	/**
	 * `selectedElement.textSegments`, reconciled with the live DOM text when
	 * `selectedElement` is the one currently being inline-edited. Uses the
	 * SAME remap the blur/commit path uses (`remapTextToSegments`), so a
	 * mid-edit toolbar style click computes its selection range and writes
	 * its update against what is actually on screen, not a stale pre-keystroke
	 * snapshot. See `inlineEditingElementId`/`inlineEditingText` above.
	 */
	const liveTextSegments = useCallback((): TextSegment[] | undefined => {
		if (!selectedElement || !hasTextProperties(selectedElement)) {
			return undefined;
		}
		if (selectedElement.id !== inlineEditingElementId) {
			return selectedElement.textSegments;
		}
		const snapshot = inlineEditingSnapshotRef?.current;
		if (
			snapshot?.elementId === selectedElement.id &&
			snapshot.text === inlineEditingText &&
			snapshot.textSegments
		) {
			return snapshot.textSegments;
		}
		return remapTextToSegments(
			inlineEditingText,
			selectedElement.textSegments,
			selectedElement.textStyle,
		);
	}, [selectedElement, inlineEditingElementId, inlineEditingText, inlineEditingSnapshotRef]);

	const updateSelectedTextStyle = useCallback(
		(updates: Partial<TextStyle>) => {
			if (!selectedElement || !hasTextProperties(selectedElement)) {
				return;
			}

			const isLiveEditing = selectedElement.id === inlineEditingElementId;
			let currentSegments = liveTextSegments();
			const selectionResult = getInlineEditorSelectionResult(currentSegments, {
				preserveCaret: updates.listType !== undefined,
			});
			if (
				selectionResult.kind === 'unsupported' ||
				(selectionResult.snapshot &&
					(!isLiveEditing || selectionResult.snapshot.elementId !== selectedElement.id))
			) {
				return;
			}
			currentSegments = selectionResult.snapshot?.textSegments ?? currentSegments;
			const inlineSel = selectionResult.selection;
			if (selectionResult.snapshot) {
				const draft = selectionResult.snapshot;
				const patch = buildInlineListStylePatch(
					{
						...selectedElement,
						text: draft.text,
						textSegments: currentSegments,
					},
					updates,
					inlineSel,
				);
				if (!patch || !('textSegments' in patch)) {
					return;
				}
				const formatted = applyActiveInlineListFormatting({
					...draft,
					textSegments: patch.textSegments,
				});
				if (formatted?.kind !== 'supported') {
					return;
				}
				updateSelectedElement({
					...patch,
					text: draft.text,
					textSegments: formatted.snapshot.textSegments,
				} as Partial<PptxElement>);
				return;
			}
			if (updates.listType) {
				const result = applyListStyleUpdate(
					{ ...selectedElement, textSegments: currentSegments },
					updates,
					inlineSel,
				);
				setPendingSelectionRestore(result.selection);
				updateSelectedElement({
					...result.patch,
					...(isLiveEditing ? { text: inlineEditingText } : {}),
				});
				return;
			}
			const { patch, newSelection } = applyTextStyleUpdate(
				selectedElement,
				updates,
				inlineSel,
				currentSegments,
			);
			if (newSelection) {
				setPendingSelectionRestore(newSelection);
			}
			updateSelectedElement({
				...patch,
				...(isLiveEditing ? { text: inlineEditingText } : {}),
			} as Partial<PptxElement>);
		},
		[
			selectedElement,
			updateSelectedElement,
			inlineEditingElementId,
			inlineEditingText,
			liveTextSegments,
		],
	);

	const toggleSelectedBullets = useCallback(
		(kind: 'bullet' | 'numbered') => {
			if (!selectedElement || !hasTextProperties(selectedElement)) {
				return;
			}
			const currentSegments = liveTextSegments();
			const result = getInlineEditorSelectionResult(currentSegments, { preserveCaret: true });
			if (
				result.kind === 'unsupported' ||
				(result.snapshot &&
					(selectedElement.id !== inlineEditingElementId ||
						result.snapshot.elementId !== selectedElement.id))
			) {
				return;
			}
			const draft = result.snapshot;
			const { patch, newSelection } = toggleSelectionBullets(
				selectedElement,
				kind,
				result.selection,
				draft?.textSegments ?? currentSegments,
			);
			if (draft) {
				if (!('textSegments' in patch) || !patch.textSegments) {
					return;
				}
				const formatted = applyActiveInlineListFormatting({
					...draft,
					textSegments: patch.textSegments,
				});
				if (formatted?.kind !== 'supported') {
					return;
				}
				updateSelectedElement({
					...patch,
					text: draft.text,
					textSegments: formatted.snapshot.textSegments,
				} as Partial<PptxElement>);
				return;
			}
			if (newSelection) {
				setPendingSelectionRestore(newSelection);
			}
			updateSelectedElement({
				...patch,
				...(selectedElement.id === inlineEditingElementId ? { text: inlineEditingText } : {}),
			} as Partial<PptxElement>);
		},
		[
			selectedElement,
			liveTextSegments,
			updateSelectedElement,
			inlineEditingElementId,
			inlineEditingText,
		],
	);

	const updateSelectedTextCase = useCallback(
		(mode: ChangeCaseMode) => {
			if (!selectedElement || !hasTextProperties(selectedElement)) {
				return;
			}

			const isLiveEditing = selectedElement.id === inlineEditingElementId;
			let currentSegments = liveTextSegments();
			const selectionResult = getInlineEditorSelectionResult(currentSegments);
			if (
				selectionResult.kind === 'unsupported' ||
				(selectionResult.snapshot &&
					(!isLiveEditing || selectionResult.snapshot.elementId !== selectedElement.id))
			) {
				return;
			}
			currentSegments = selectionResult.snapshot?.textSegments ?? currentSegments;
			const inlineSel = selectionResult.selection;
			if (selectionResult.snapshot) {
				const next = transformInlineListCase(selectionResult.snapshot, inlineSel, mode);
				if (next !== selectionResult.snapshot) {
					setInlineEditingElementId(null);
					updateSelectedElement({
						text: next.text,
						textSegments: next.textSegments,
					} as Partial<PptxElement>);
				}
				return;
			}
			if (inlineSel && currentSegments) {
				const newSegments = applyCaseTransformToSegments(currentSegments, inlineSel, mode);
				updateSelectedElement({
					textSegments: newSegments,
					...(isLiveEditing ? { text: inlineEditingText } : {}),
				} as Partial<PptxElement>);
				return;
			}

			// No inline selection: transform the entire element's text.
			const updates: Partial<PptxElement> = {};
			if (currentSegments && currentSegments.length > 0) {
				(updates as { textSegments?: unknown }).textSegments = applyCaseTransformToSegments(
					currentSegments,
					null,
					mode,
				);
			}
			const baseText = isLiveEditing ? inlineEditingText : selectedElement.text;
			if (typeof baseText === 'string') {
				(updates as { text?: string }).text = transformTextCase(baseText, mode);
			}
			updateSelectedElement(updates);
		},
		[
			selectedElement,
			updateSelectedElement,
			inlineEditingElementId,
			inlineEditingText,
			liveTextSegments,
			setInlineEditingElementId,
		],
	);

	return { updateSelectedTextStyle, updateSelectedTextCase, toggleSelectedBullets };
}
