import type {
	PptxAnimationPreset,
	PptxElement,
	PptxElementAnimation,
	PptxSlide,
	PptxSlideTransition,
} from 'pptx-viewer-core';

import type { EditorHistoryResult } from './useEditorHistory';
import type { ElementOperations } from './useElementOperations';
import type { PropertyHandlersResult } from './usePropertyHandlers';

/**
 * Animation / transition callbacks for the standalone `<Toolbar>` component.
 * Extracted from `useViewerBuildingBlocks-toolbar-props.ts` (which reproduces
 * `ViewerToolbarSection.tsx`'s `handleAddAnimation` / `handleRemoveAnimation` /
 * `handleTransitionChange` / `handleApplyTransitionToAll` logic verbatim) to
 * keep both files under the project's per-file line limit.
 */

export interface BuildToolbarAnimationHandlersInput {
	selectedElement: PptxElement | null;
	activeSlide: PptxSlide | undefined;
	propertyHandlers: PropertyHandlersResult;
	ops: ElementOperations;
	history: EditorHistoryResult;
}

export interface ToolbarAnimationHandlers {
	handleAddAnimation: (preset: string, group: 'entrance' | 'emphasis' | 'exit') => void;
	handleRemoveAnimation: () => void;
	handleTransitionChange: (updates: Partial<PptxSlideTransition>) => void;
	handleApplyTransitionToAll: () => void;
}

export function buildToolbarAnimationHandlers(
	input: BuildToolbarAnimationHandlersInput,
): ToolbarAnimationHandlers {
	const { selectedElement, activeSlide, propertyHandlers, ops, history } = input;

	const handleAddAnimation = (preset: string, group: 'entrance' | 'emphasis' | 'exit') => {
		if (!selectedElement || !activeSlide) {
			return;
		}
		const current = activeSlide.animations ?? [];
		const existing = current.find((a) => a.elementId === selectedElement.id);
		const presetValue = preset as PptxAnimationPreset;
		if (existing) {
			const updated = current.map((a) =>
				a.elementId === selectedElement.id ? { ...a, [group]: presetValue } : a,
			);
			propertyHandlers.handleUpdateSlide({ animations: updated });
		} else {
			const newAnim: PptxElementAnimation = {
				elementId: selectedElement.id,
				[group]: presetValue,
				durationMs: 500,
				order: current.length,
				trigger: 'onClick',
			};
			propertyHandlers.handleUpdateSlide({ animations: [...current, newAnim] });
		}
	};

	const handleRemoveAnimation = () => {
		if (!selectedElement || !activeSlide) {
			return;
		}
		const current = activeSlide.animations ?? [];
		const filtered = current.filter((a) => a.elementId !== selectedElement.id);
		propertyHandlers.handleUpdateSlide({ animations: filtered });
	};

	const handleTransitionChange = (updates: Partial<PptxSlideTransition>) => {
		if (!activeSlide) {
			return;
		}
		const current = activeSlide.transition ?? { type: 'none' as const };
		propertyHandlers.handleUpdateSlide({ transition: { ...current, ...updates } });
	};

	const handleApplyTransitionToAll = () => {
		const transition = activeSlide?.transition;
		if (!transition) {
			return;
		}
		ops.updateSlides((prev) => prev.map((sl) => ({ ...sl, transition })));
		history.markDirty();
	};

	return {
		handleAddAnimation,
		handleRemoveAnimation,
		handleTransitionChange,
		handleApplyTransitionToAll,
	};
}
