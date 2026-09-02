/**
 * The framework-free AI panel controller: the Vanilla analog of React's
 * `useAiPanelController`. It owns the assistant's "scope" (focused targets +
 * a pinned override), the pick-mode state, and the on-canvas highlight sources
 * that share one overlay system:
 *
 *   - PICK MODE: the user clicks the crosshair, then clicks element(s) on the
 *     slide to hand them to the assistant. Each pick is highlighted and added
 *     to the pick set.
 *   - LIVE TOOL FOCUS: while the assistant runs its tool loop, each tool call
 *     flashes a transient "the AI is working on this" highlight on the element
 *     the tool references (see {@link flashToolTarget}).
 *
 * It is a plain observable: subscribers (the focus bar, the highlight overlay,
 * the bridge's `getFocusedTargets`) re-read state on every `subscribe` notify.
 */
import type { PptxElement } from 'pptx-viewer-core';
import type {
	AiCanvasHighlight,
	PptxAiFocusedTarget,
	ToolCanvasTarget,
} from 'pptx-viewer-shared/ai';
import { computeFocusTargets } from 'pptx-viewer-shared/ai';

import type { Store, ViewerState } from '../state';

export type { AiCanvasHighlight };

/** One-shot composer prefill; `nonce` bumps on every ask/fix so it re-applies. */
export interface AiPrefill {
	text: string;
	nonce: number;
}

export interface AiFocusControllerDeps {
	store: Store<ViewerState>;
	/** Open the AI panel (used by pick / ask / fix). */
	requestOpen(): void;
}

/** How long a live-tool highlight / colour-tween window stays up after a call. */
const TOOL_FLASH_MS = 2600;

/** Build the "Fix with AI" directive for one element (never auto-sent). */
function fixDirective(element: PptxElement, slideIndex: number): string {
	return `Review and fix any issues with this ${element.type} (id=${element.id}) on slide ${slideIndex + 1}.`;
}

export interface AiFocusController {
	subscribe(listener: () => void): () => void;

	/* ── Focus ──────────────────────────────────────────────────────────── */
	/** Focused targets derived live from the current canvas selection. */
	getLiveTargets(): PptxAiFocusedTarget[];
	/** Effective focus: explicit picks win over a pin, which wins over selection. */
	getEffectiveTargets(): PptxAiFocusedTarget[];
	isPinned(): boolean;
	hasPicks(): boolean;
	pinFocus(): void;
	clearPinnedFocus(): void;

	/* ── Pick mode ──────────────────────────────────────────────────────── */
	isPicking(): boolean;
	startPicking(): void;
	stopPicking(): void;
	addPick(slideIndex: number, elementId: string): void;
	clearPicks(): void;

	/* ── Live tool / canvas animation ───────────────────────────────────── */
	getHighlights(): AiCanvasHighlight[];
	/** True while the canvas should tween colour changes (AI is active). */
	isAnimating(): boolean;
	flashToolTarget(target: ToolCanvasTarget | null): void;

	/* ── Composer prefill (ask / fix) ───────────────────────────────────── */
	getPrefill(): AiPrefill;
	askAboutSelection(): void;
	fixElement(element: PptxElement | null, slideIndex: number): void;

	dispose(): void;
}

export function createAiFocusController(deps: AiFocusControllerDeps): AiFocusController {
	const { store } = deps;
	const listeners = new Set<() => void>();

	let pinnedFocus: PptxAiFocusedTarget[] | null = null;
	let pickTargets: PptxAiFocusedTarget[] = [];
	let pickMode = false;
	let toolFocus: { slideIndex: number; elementIds: string[] } | null = null;
	let flashActive = false;
	let flashTimer: ReturnType<typeof setTimeout> | null = null;
	let prefill: AiPrefill = { text: '', nonce: 0 };

	const emit = (): void => {
		for (const listener of listeners) {
			listener();
		}
	};

	const liveTargets = (): PptxAiFocusedTarget[] => {
		const state = store.get();
		return computeFocusTargets({
			activeSlideIndex: state.currentSlide,
			selectedElementIds: state.selectedElementIds,
			selectedElementId: state.selectedElementId,
		});
	};

	const hasPicks = (): boolean => pickTargets.length > 0;

	// Re-emit whenever the live selection changes so the focus chips track it.
	const unsubscribeStore = store.subscribe((state, previous) => {
		if (
			state.currentSlide !== previous.currentSlide ||
			state.selectedElementId !== previous.selectedElementId ||
			state.selectedElementIds !== previous.selectedElementIds
		) {
			emit();
		}
	});

	return {
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},

		getLiveTargets: liveTargets,
		getEffectiveTargets() {
			if (hasPicks()) {
				return pickTargets;
			}
			if (pinnedFocus && pinnedFocus.length > 0) {
				return pinnedFocus;
			}
			return liveTargets();
		},
		isPinned: () => !hasPicks() && pinnedFocus !== null,
		hasPicks,
		pinFocus() {
			pinnedFocus = liveTargets();
			emit();
		},
		clearPinnedFocus() {
			pinnedFocus = null;
			emit();
		},

		isPicking: () => pickMode,
		startPicking() {
			pickMode = true;
			deps.requestOpen();
			emit();
		},
		stopPicking() {
			pickMode = false;
			emit();
		},
		addPick(slideIndex, elementId) {
			if (pickTargets.some((tg) => tg.kind === 'element' && tg.elementId === elementId)) {
				return;
			}
			pickTargets = [...pickTargets, { kind: 'element', slideIndex, elementId }];
			emit();
		},
		clearPicks() {
			pickTargets = [];
			pickMode = false;
			emit();
		},

		getHighlights() {
			const out: AiCanvasHighlight[] = [];
			for (const tg of pickTargets) {
				if (tg.kind === 'element') {
					out.push({ slideIndex: tg.slideIndex, elementId: tg.elementId, variant: 'pick' });
				}
			}
			if (toolFocus) {
				for (const elementId of toolFocus.elementIds) {
					out.push({ slideIndex: toolFocus.slideIndex, elementId, variant: 'active' });
				}
			}
			return out;
		},
		isAnimating: () => flashActive || pickTargets.length > 0,
		flashToolTarget(target) {
			toolFocus =
				target && target.slideIndex !== undefined && target.elementIds.length > 0
					? { slideIndex: target.slideIndex, elementIds: target.elementIds }
					: null;
			flashActive = true;
			if (flashTimer) {
				clearTimeout(flashTimer);
			}
			flashTimer = setTimeout(() => {
				toolFocus = null;
				flashActive = false;
				flashTimer = null;
				emit();
			}, TOOL_FLASH_MS);
			emit();
		},

		getPrefill: () => prefill,
		askAboutSelection() {
			pinnedFocus = liveTargets();
			prefill = { text: '', nonce: prefill.nonce + 1 };
			deps.requestOpen();
			emit();
		},
		fixElement(element, slideIndex) {
			pinnedFocus = liveTargets();
			prefill = {
				text: element ? fixDirective(element, slideIndex) : '',
				nonce: prefill.nonce + 1,
			};
			deps.requestOpen();
			emit();
		},

		dispose() {
			if (flashTimer) {
				clearTimeout(flashTimer);
			}
			unsubscribeStore();
			listeners.clear();
		},
	};
}
