/**
 * useAiPanelController: owns the AI panel's open state and its "scope" (the
 * focused targets + a prefilled composer directive) so PowerPointViewer can
 * stay thin. The live focus follows the canvas selection; `pinnedFocus` freezes
 * it (set from the chat or from a canvas "Ask AI" affordance) so the assistant
 * stays scoped even after the user clicks away.
 *
 * It also owns two on-canvas highlight sources that share one overlay system:
 *   - PICK MODE: the user clicks a target/crosshair button, then clicks
 *     element(s) on the slide to hand them to the assistant. Each pick is
 *     highlighted and added to {@link pickTargets}.
 *   - LIVE TOOL FOCUS: while the assistant runs its tool loop, each tool call
 *     flashes a transient "the AI is working on this" highlight on the element
 *     the tool references (see {@link flashToolTarget}).
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { AiChangeBatch, PptxAiFocusedTarget, ToolCanvasTarget } from 'pptx-viewer-shared/ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { computeFocusTargets } from './focus-targets';

export interface UseAiPanelControllerInput {
	activeSlideIndex: number;
	selectedElementId: string | null;
	selectedElementIds: string[];
	/** The primary selected element, for building the "Fix with AI" directive. */
	selectedElement: PptxElement | null;
}

/** One element ring to draw on the canvas: an explicit pick or a live-tool focus. */
export interface AiCanvasHighlight {
	slideIndex: number;
	elementId: string;
	/** `pick` = persistent user pick; `active` = transient AI-is-working ring. */
	variant: 'pick' | 'active';
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

	/* ── Pick mode ─────────────────────────────────────────────────────────── */
	/** True while the user is picking element(s) on the canvas for the assistant. */
	pickMode: boolean;
	/** Enter pick mode (the next canvas element clicks become picks). */
	startPicking(): void;
	/** Leave pick mode without clearing the accumulated picks. */
	stopPicking(): void;
	/** The elements the user has explicitly handed to the assistant. */
	pickTargets: PptxAiFocusedTarget[];
	/** Add one clicked canvas element to the pick set (and highlight it). */
	addPick(slideIndex: number, elementId: string): void;
	/** Empty the pick set and leave pick mode. */
	clearPicks(): void;

	/* ── Live tool / canvas animation ──────────────────────────────────────── */
	/** Element rings the canvas should draw (picks + the live tool focus). */
	canvasHighlights: AiCanvasHighlight[];
	/** True while the canvas should tween colour changes (AI is active). */
	canvasAnimating: boolean;
	/**
	 * Flash a transient "the AI is working on this" highlight for a running tool,
	 * and enable colour tweening for a short settle window. Pass `null` to just
	 * enable tweening (e.g. a theme-colour edit with no single element target).
	 */
	flashToolTarget(target: ToolCanvasTarget | null): void;

	/* ── Applied-edit change animation ──────────────────────────────────────── */
	/** The batch of just-applied element changes the canvas should animate. */
	changeBatch: AiChangeBatch | null;
	/** Push (or clear) the change batch the AI apply path published. */
	showChangeBatch(batch: AiChangeBatch | null): void;
}

/** How long a live-tool highlight / colour-tween window stays up after a call. */
const TOOL_FLASH_MS = 2600;

/** Build the "Fix with AI" directive for one element (never auto-sent). */
function fixDirective(element: PptxElement, slideIndex: number): string {
	return `Review and fix any issues with this ${element.type} (id=${element.id}) on slide ${slideIndex + 1}.`;
}

export function useAiPanelController(input: UseAiPanelControllerInput): AiPanelController {
	const { activeSlideIndex, selectedElementId, selectedElementIds, selectedElement } = input;
	const [isOpen, setIsOpen] = useState(false);
	const [pinnedFocus, setPinnedFocus] = useState<PptxAiFocusedTarget[] | null>(null);
	const [prefill, setPrefill] = useState<{ text: string; nonce: number }>({ text: '', nonce: 0 });
	const [pickMode, setPickMode] = useState(false);
	const [pickTargets, setPickTargets] = useState<PptxAiFocusedTarget[]>([]);
	const [toolFocus, setToolFocus] = useState<{ slideIndex: number; elementIds: string[] } | null>(
		null,
	);
	const [flashTick, setFlashTick] = useState(0);
	const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [changeBatch, setChangeBatch] = useState<AiChangeBatch | null>(null);
	const showChangeBatch = useCallback((batch: AiChangeBatch | null) => setChangeBatch(batch), []);

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

	const startPicking = useCallback(() => {
		setPickMode(true);
		setIsOpen(true);
	}, []);
	const stopPicking = useCallback(() => setPickMode(false), []);
	const addPick = useCallback((slideIndex: number, elementId: string) => {
		setPickTargets((prev) => {
			if (prev.some((t) => t.kind === 'element' && t.elementId === elementId)) {
				return prev;
			}
			return [...prev, { kind: 'element', slideIndex, elementId }];
		});
	}, []);
	const clearPicks = useCallback(() => {
		setPickTargets([]);
		setPickMode(false);
	}, []);

	const flashToolTarget = useCallback((target: ToolCanvasTarget | null) => {
		if (target && target.slideIndex !== undefined && target.elementIds.length > 0) {
			setToolFocus({ slideIndex: target.slideIndex, elementIds: target.elementIds });
		} else {
			setToolFocus(null);
		}
		setFlashTick((n) => n + 1);
		if (flashTimer.current) {
			clearTimeout(flashTimer.current);
		}
		flashTimer.current = setTimeout(() => {
			setToolFocus(null);
			setFlashTick(0);
		}, TOOL_FLASH_MS);
	}, []);

	useEffect(
		() => () => {
			if (flashTimer.current) {
				clearTimeout(flashTimer.current);
			}
		},
		[],
	);

	const canvasHighlights = useMemo<AiCanvasHighlight[]>(() => {
		const out: AiCanvasHighlight[] = [];
		for (const t of pickTargets) {
			if (t.kind === 'element') {
				out.push({ slideIndex: t.slideIndex, elementId: t.elementId, variant: 'pick' });
			}
		}
		if (toolFocus) {
			for (const elementId of toolFocus.elementIds) {
				out.push({ slideIndex: toolFocus.slideIndex, elementId, variant: 'active' });
			}
		}
		return out;
	}, [pickTargets, toolFocus]);

	const canvasAnimating = canvasHighlights.length > 0 || flashTick > 0;

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
		pickMode,
		startPicking,
		stopPicking,
		pickTargets,
		addPick,
		clearPicks,
		canvasHighlights,
		canvasAnimating,
		flashToolTarget,
		changeBatch,
		showChangeBatch,
	};
}
