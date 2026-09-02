/**
 * AiPanelStore: owns the AI panel's "scope" (focused targets + a prefilled
 * composer directive) and the two on-canvas highlight sources, mirroring
 * React's `useAiPanelController` as an Angular signal service.
 *
 * The live focus follows the canvas selection; `pinnedFocus` freezes it (set
 * from the chat or a canvas "Ask AI" affordance) so the assistant stays scoped
 * even after the user clicks away. Two highlight sources share one overlay:
 *   - PICK MODE: the user clicks a crosshair, then clicks element(s) on the
 *     slide to hand them to the assistant. Each pick is highlighted + added to
 *     {@link pickTargets}.
 *   - LIVE TOOL FOCUS: while the assistant runs its tool loop, each tool call
 *     flashes a transient "the AI is working on this" ring (see
 *     {@link flashToolTarget}).
 *
 * Provided at the viewer component level so the canvas, the panel, and the
 * bridge all read the same store.
 */
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { computeFocusTargets, createAiChangeAnimator } from '../../internal/shared-ai';
import type {
	AiCanvasHighlight,
	AiChangeAnimationConfig,
	AiChangeAnimator,
	AiChangeBatch,
	PptxAiFocusedTarget,
	ToolCanvasTarget,
} from '../../internal/shared-ai';

/** Live selection accessors the store reads to derive the follow-selection focus. */
export interface AiPanelSelectionAccessors {
	activeSlideIndex(): number;
	selectedElementIds(): readonly string[];
	selectedElementId(): string | null;
	/** The primary selected element, for building the "Fix with AI" directive. */
	selectedElement(): PptxElement | null;
}

/** How long a live-tool highlight / colour-tween window stays up after a call. */
const TOOL_FLASH_MS = 2600;

/** Build the "Fix with AI" directive for one element (never auto-sent). */
function fixDirective(element: PptxElement, slideIndex: number): string {
	return `Review and fix any issues with this ${element.type} (id=${element.id}) on slide ${slideIndex + 1}.`;
}

@Injectable()
export class AiPanelStore {
	/**
	 * Optional: `inject()` needs an active injection context, which plain
	 * `new AiPanelStore()` (used by this store's unit tests, deliberately
	 * bypassing TestBed for speed) does not provide. Falls back to no automatic
	 * timer cleanup when constructed outside DI, which is fine for tests.
	 */
	private readonly destroyRef: DestroyRef | null = (() => {
		try {
			return inject(DestroyRef);
		} catch {
			return null;
		}
	})();
	private accessors: AiPanelSelectionAccessors | null = null;

	/** Pinned focus override (null follows the live selection). */
	readonly pinnedFocus = signal<PptxAiFocusedTarget[] | null>(null);
	/**
	 * One-shot composer prefill. `nonce` bumps on every ask/fix so the composer
	 * applies `text` (and focuses) even when `text` is empty and unchanged.
	 */
	readonly prefill = signal<{ text: string; nonce: number }>({ text: '', nonce: 0 });

	/** True while the user is picking element(s) on the canvas for the assistant. */
	readonly pickMode = signal(false);
	/** The elements the user has explicitly handed to the assistant. */
	readonly pickTargets = signal<PptxAiFocusedTarget[]>([]);

	/** The element(s) a running tool is currently touching (transient). */
	private readonly toolFocus = signal<{ slideIndex: number; elementIds: string[] } | null>(null);
	private readonly flashTick = signal(0);
	private flashTimer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Canvas change animator: the shared subscribe/publish bus that carries "these
	 * elements just changed, animate them" from the AI apply path (the bridge's
	 * write choke point calls {@link publishAiChange}) to the panel, which reveals
	 * the slide and hands the batch to the on-canvas overlay via
	 * {@link showChangeBatch}. Owned here (viewer-scoped) so it survives the panel
	 * opening/closing while the write path stays alive. Mirrors React's
	 * `session.changeAnimator`; Angular drives the same shared animator from the
	 * bridge because its vanilla-chat controller does not surface the session.
	 */
	readonly changeAnimator: AiChangeAnimator = createAiChangeAnimator();
	/** The batch of just-applied element changes the canvas overlay should play. */
	readonly changeBatch = signal<AiChangeBatch | null>(null);

	constructor() {
		this.destroyRef?.onDestroy(() => {
			if (this.flashTimer) {
				clearTimeout(this.flashTimer);
			}
			this.changeAnimator.dispose();
		});
	}

	/** Wire the live selection accessors (called once by the viewer component). */
	bind(accessors: AiPanelSelectionAccessors): void {
		this.accessors = accessors;
	}

	/** Focused targets derived live from the current canvas selection. */
	readonly liveFocusTargets = computed<PptxAiFocusedTarget[]>(() => {
		const a = this.accessors;
		if (!a) {
			return [{ kind: 'slide', slideIndex: 0 }];
		}
		return computeFocusTargets({
			activeSlideIndex: a.activeSlideIndex(),
			selectedElementIds: a.selectedElementIds(),
			selectedElementId: a.selectedElementId(),
		});
	});

	/** Whether there are explicit picks (they win over a pin / live selection). */
	readonly hasPicks = computed(() => this.pickTargets().length > 0);

	/** The targets the panel + bridge should actually scope to. */
	readonly effectiveTargets = computed<PptxAiFocusedTarget[]>(() => {
		if (this.hasPicks()) {
			return this.pickTargets();
		}
		return this.pinnedFocus() ?? this.liveFocusTargets();
	});

	/** True when a pin is in force (and no picks override it). */
	readonly isPinned = computed(() => !this.hasPicks() && this.pinnedFocus() !== null);

	/**
	 * Focused targets for the bridge's `getFocusedTargets`: picks beat a pin,
	 * which beats the live selection.
	 */
	getFocusedTargets(): PptxAiFocusedTarget[] {
		return this.effectiveTargets();
	}

	pinFocus(): void {
		this.pinnedFocus.set(this.liveFocusTargets());
	}
	clearPinnedFocus(): void {
		this.pinnedFocus.set(null);
	}

	/** Open the panel scoped to the current selection, empty composer (focused). */
	askAboutSelection(): void {
		this.pinnedFocus.set(this.liveFocusTargets());
		this.prefill.update((p) => ({ text: '', nonce: p.nonce + 1 }));
	}

	/** Open the panel scoped to the current selection, prefilled fix directive. */
	fixSelection(): void {
		this.pinnedFocus.set(this.liveFocusTargets());
		const el = this.accessors?.selectedElement() ?? null;
		const index = this.accessors?.activeSlideIndex() ?? 0;
		const text = el ? fixDirective(el, index) : '';
		this.prefill.update((p) => ({ text, nonce: p.nonce + 1 }));
	}

	/* ── Pick mode ─────────────────────────────────────────────────────────── */

	startPicking(): void {
		this.pickMode.set(true);
	}
	stopPicking(): void {
		this.pickMode.set(false);
	}
	/** Add one clicked canvas element to the pick set (dedupe by id). */
	addPick(slideIndex: number, elementId: string): void {
		this.pickTargets.update((prev) => {
			if (prev.some((t) => t.kind === 'element' && t.elementId === elementId)) {
				return prev;
			}
			return [...prev, { kind: 'element', slideIndex, elementId }];
		});
	}
	/** Empty the pick set and leave pick mode. */
	clearPicks(): void {
		this.pickTargets.set([]);
		this.pickMode.set(false);
	}

	/* ── Live tool / canvas animation ──────────────────────────────────────── */

	/**
	 * Flash a transient "the AI is working on this" highlight for a running tool,
	 * and enable colour tweening for a short settle window. Pass `null` to just
	 * enable tweening (e.g. a theme-colour edit with no single element target).
	 */
	flashToolTarget(target: ToolCanvasTarget | null): void {
		if (target && target.slideIndex !== undefined && target.elementIds.length > 0) {
			this.toolFocus.set({ slideIndex: target.slideIndex, elementIds: target.elementIds });
		} else {
			this.toolFocus.set(null);
		}
		this.flashTick.update((n) => n + 1);
		if (this.flashTimer) {
			clearTimeout(this.flashTimer);
		}
		this.flashTimer = setTimeout(() => {
			this.toolFocus.set(null);
			this.flashTick.set(0);
		}, TOOL_FLASH_MS);
	}

	/** Element rings the canvas should draw (picks + the live tool focus). */
	readonly canvasHighlights = computed<AiCanvasHighlight[]>(() => {
		const out: AiCanvasHighlight[] = [];
		for (const t of this.pickTargets()) {
			if (t.kind === 'element') {
				out.push({ slideIndex: t.slideIndex, elementId: t.elementId, variant: 'pick' });
			}
		}
		const focus = this.toolFocus();
		if (focus) {
			for (const elementId of focus.elementIds) {
				out.push({ slideIndex: focus.slideIndex, elementId, variant: 'active' });
			}
		}
		return out;
	});

	/** True while the canvas should tween colour changes (AI is active). */
	readonly canvasAnimating = computed(
		() => this.canvasHighlights().length > 0 || this.flashTick() > 0,
	);

	/* ── Applied-edit change animation ─────────────────────────────────────── */

	/** Apply (or clear) the change batch the panel wants the canvas to animate. */
	showChangeBatch(batch: AiChangeBatch | null): void {
		this.changeBatch.set(batch);
	}

	/**
	 * Publish an applied AI edit to the change animator (called from the bridge's
	 * write choke point with the deck slides before + after the edit). The panel's
	 * subscription reveals the slide and plays the overlay; a no-op edit or the
	 * host disabling the animation publishes nothing.
	 */
	publishAiChange(before: readonly PptxSlide[], after: readonly PptxSlide[]): void {
		this.changeAnimator.publish([...before], [...after]);
	}

	/** Apply the host's change-animation config (duration / colour / toggles). */
	configureChangeAnimation(config?: AiChangeAnimationConfig): void {
		this.changeAnimator.configure(config);
	}
}
