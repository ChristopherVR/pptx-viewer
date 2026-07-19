/**
 * useAiPanelController: owns the AI panel's open state and its "scope" (the
 * focused targets + a prefilled composer directive) so PowerPointViewer can
 * stay thin. The live focus follows the canvas selection; `pinnedFocus` freezes
 * it (set from the chat or from a canvas "Ask AI" affordance) so the assistant
 * stays scoped even after the user clicks away.
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { PptxAiFocusedTarget } from 'pptx-viewer-shared/ai';
import { useCallback, useMemo, useState } from 'react';

import { computeFocusTargets } from './focus-targets';

export interface UseAiPanelControllerInput {
	activeSlideIndex: number;
	selectedElementId: string | null;
	selectedElementIds: string[];
	/** The primary selected element, for building the "Fix with AI" directive. */
	selectedElement: PptxElement | null;
}

export interface AiPanelController {
	isOpen: boolean;
	open(): void;
	close(): void;
	toggle(): void;
	/** Focused targets derived live from the current canvas selection. */
	liveFocusTargets: PptxAiFocusedTarget[];
	/** Pinned focus override (null follows the live selection). */
	pinnedFocus: PptxAiFocusedTarget[] | null;
	/** Pin the current live targets as the chat's focus. */
	pinFocus(): void;
	/** Drop the pin and follow the live selection again. */
	clearPinnedFocus(): void;
	/**
	 * One-shot composer prefill. `nonce` bumps on every ask/fix so the composer
	 * focuses (and applies `text`) even when `text` is empty and unchanged.
	 */
	prefill: { text: string; nonce: number };
	/** Open the panel scoped to the current selection, empty composer (focused). */
	askAboutSelection(): void;
	/** Open the panel scoped to the current selection, prefilled fix directive. */
	fixSelection(): void;
}

/** Build the "Fix with AI" directive for one element (never auto-sent). */
function fixDirective(element: PptxElement, slideIndex: number): string {
	return `Review and fix any issues with this ${element.type} (id=${element.id}) on slide ${slideIndex + 1}.`;
}

export function useAiPanelController(input: UseAiPanelControllerInput): AiPanelController {
	const { activeSlideIndex, selectedElementId, selectedElementIds, selectedElement } = input;
	const [isOpen, setIsOpen] = useState(false);
	const [pinnedFocus, setPinnedFocus] = useState<PptxAiFocusedTarget[] | null>(null);
	const [prefill, setPrefill] = useState<{ text: string; nonce: number }>({ text: '', nonce: 0 });

	const liveFocusTargets = useMemo(
		() => computeFocusTargets({ activeSlideIndex, selectedElementIds, selectedElementId }),
		[activeSlideIndex, selectedElementIds, selectedElementId],
	);

	const open = useCallback(() => setIsOpen(true), []);
	const close = useCallback(() => setIsOpen(false), []);
	const toggle = useCallback(() => setIsOpen((p) => !p), []);
	const pinFocus = useCallback(() => setPinnedFocus(liveFocusTargets), [liveFocusTargets]);
	const clearPinnedFocus = useCallback(() => setPinnedFocus(null), []);

	const askAboutSelection = useCallback(() => {
		setPinnedFocus(liveFocusTargets);
		setPrefill((p) => ({ text: '', nonce: p.nonce + 1 }));
		setIsOpen(true);
	}, [liveFocusTargets]);

	const fixSelection = useCallback(() => {
		setPinnedFocus(liveFocusTargets);
		const text = selectedElement ? fixDirective(selectedElement, activeSlideIndex) : '';
		setPrefill((p) => ({ text, nonce: p.nonce + 1 }));
		setIsOpen(true);
	}, [liveFocusTargets, selectedElement, activeSlideIndex]);

	return {
		isOpen,
		open,
		close,
		toggle,
		liveFocusTargets,
		pinnedFocus,
		pinFocus,
		clearPinnedFocus,
		prefill,
		askAboutSelection,
		fixSelection,
	};
}
