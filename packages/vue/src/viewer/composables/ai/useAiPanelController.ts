/**
 * useAiPanelController: owns the AI panel's "scope" (the focused targets + a
 * prefilled composer directive) plus the two on-canvas highlight sources that
 * share one overlay system. Vue counterpart of the React
 * `useAiPanelController` hook; the panel open state itself stays in
 * `PowerPointViewer` (an `aiPanelOpen` ref), so this composable only owns focus,
 * picks and the live-tool flash.
 *
 *   - PICK MODE: the user clicks the crosshair button, then clicks element(s) on
 *     the slide to hand them to the assistant. Each pick is highlighted and
 *     added to {@link pickTargets}.
 *   - LIVE TOOL FOCUS: while the assistant runs its tool loop, each tool call
 *     flashes a transient "the AI is working on this" highlight on the element
 *     the tool references (see {@link flashToolTarget}).
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { PptxAiFocusedTarget, ToolCanvasTarget } from 'pptx-viewer-shared/ai';
import { computed, onScopeDispose, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import { computeFocusTargets } from './focus-targets';

/** Live reactive inputs the controller derives its focus from. */
export interface UseAiPanelControllerInput {
	activeSlideIndex: Ref<number>;
	selectedElementIds: Ref<string[]>;
	/** The primary selected element, for building the "Fix with AI" directive. */
	selectedElement: () => PptxElement | null;
}

/** One element ring to draw on the canvas: an explicit pick or a live-tool focus. */
export interface AiCanvasHighlight {
	slideIndex: number;
	elementId: string;
	/** `pick` = persistent user pick; `active` = transient AI-is-working ring. */
	variant: 'pick' | 'active';
}

export interface AiPanelController {
	/** Focused targets derived live from the current canvas selection. */
	liveFocusTargets: ComputedRef<PptxAiFocusedTarget[]>;
	/** Pinned focus override (null follows the live selection). */
	pinnedFocus: Ref<PptxAiFocusedTarget[] | null>;
	/** Pin the current live targets as the chat's focus. */
	pinFocus(): void;
	/** Drop the pin and follow the live selection again. */
	clearPinnedFocus(): void;
	/** One-shot composer prefill; `nonce` bumps on every ask/fix. */
	prefill: Ref<{ text: string; nonce: number }>;
	/** Scope the panel to the current selection, empty composer (bumps prefill). */
	askAboutSelection(): void;
	/** Scope the panel to the current selection, prefilled fix directive. */
	fixSelection(): void;

	/* Pick mode */
	pickMode: Ref<boolean>;
	startPicking(): void;
	stopPicking(): void;
	pickTargets: Ref<PptxAiFocusedTarget[]>;
	addPick(slideIndex: number, elementId: string): void;
	clearPicks(): void;

	/* Live tool / canvas animation */
	canvasHighlights: ComputedRef<AiCanvasHighlight[]>;
	canvasAnimating: ComputedRef<boolean>;
	flashToolTarget(target: ToolCanvasTarget | null): void;
}

/** How long a live-tool highlight / colour-tween window stays up after a call. */
const TOOL_FLASH_MS = 2600;

/** Build the "Fix with AI" directive for one element (never auto-sent). */
function fixDirective(element: PptxElement, slideIndex: number): string {
	return `Review and fix any issues with this ${element.type} (id=${element.id}) on slide ${slideIndex + 1}.`;
}

export function useAiPanelController(input: UseAiPanelControllerInput): AiPanelController {
	const { activeSlideIndex, selectedElementIds, selectedElement } = input;
	const pinnedFocus = ref<PptxAiFocusedTarget[] | null>(null);
	const prefill = ref<{ text: string; nonce: number }>({ text: '', nonce: 0 });
	const pickMode = ref(false);
	const pickTargets = ref<PptxAiFocusedTarget[]>([]);
	const toolFocus = ref<{ slideIndex: number; elementIds: string[] } | null>(null);
	const flashTick = ref(0);
	let flashTimer: ReturnType<typeof setTimeout> | null = null;

	const liveFocusTargets = computed(() =>
		computeFocusTargets({
			activeSlideIndex: activeSlideIndex.value,
			selectedElementIds: selectedElementIds.value,
			selectedElementId: selectedElementIds.value[0] ?? null,
		}),
	);

	const pinFocus = (): void => {
		pinnedFocus.value = liveFocusTargets.value;
	};
	const clearPinnedFocus = (): void => {
		pinnedFocus.value = null;
	};

	const askAboutSelection = (): void => {
		pinnedFocus.value = liveFocusTargets.value;
		prefill.value = { text: '', nonce: prefill.value.nonce + 1 };
	};
	const fixSelection = (): void => {
		pinnedFocus.value = liveFocusTargets.value;
		const el = selectedElement();
		const text = el ? fixDirective(el, activeSlideIndex.value) : '';
		prefill.value = { text, nonce: prefill.value.nonce + 1 };
	};

	const startPicking = (): void => {
		pickMode.value = true;
	};
	const stopPicking = (): void => {
		pickMode.value = false;
	};
	const addPick = (slideIndex: number, elementId: string): void => {
		if (pickTargets.value.some((t) => t.kind === 'element' && t.elementId === elementId)) {
			return;
		}
		pickTargets.value = [...pickTargets.value, { kind: 'element', slideIndex, elementId }];
	};
	const clearPicks = (): void => {
		pickTargets.value = [];
		pickMode.value = false;
	};

	const flashToolTarget = (target: ToolCanvasTarget | null): void => {
		if (target && target.slideIndex !== undefined && target.elementIds.length > 0) {
			toolFocus.value = { slideIndex: target.slideIndex, elementIds: target.elementIds };
		} else {
			toolFocus.value = null;
		}
		flashTick.value += 1;
		if (flashTimer) {
			clearTimeout(flashTimer);
		}
		flashTimer = setTimeout(() => {
			toolFocus.value = null;
			flashTick.value = 0;
		}, TOOL_FLASH_MS);
	};

	onScopeDispose(() => {
		if (flashTimer) {
			clearTimeout(flashTimer);
		}
	});

	const canvasHighlights = computed<AiCanvasHighlight[]>(() => {
		const out: AiCanvasHighlight[] = [];
		for (const t of pickTargets.value) {
			if (t.kind === 'element') {
				out.push({ slideIndex: t.slideIndex, elementId: t.elementId, variant: 'pick' });
			}
		}
		const focus = toolFocus.value;
		if (focus) {
			for (const elementId of focus.elementIds) {
				out.push({ slideIndex: focus.slideIndex, elementId, variant: 'active' });
			}
		}
		return out;
	});

	const canvasAnimating = computed(() => canvasHighlights.value.length > 0 || flashTick.value > 0);

	return {
		liveFocusTargets,
		pinnedFocus,
		pinFocus,
		clearPinnedFocus,
		prefill,
		askAboutSelection,
		fixSelection,
		pickMode,
		startPicking,
		stopPicking,
		pickTargets,
		addPick,
		clearPicks,
		canvasHighlights,
		canvasAnimating,
		flashToolTarget,
	};
}
