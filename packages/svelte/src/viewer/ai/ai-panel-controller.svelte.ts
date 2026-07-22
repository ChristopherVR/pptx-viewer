/**
 * `AiPanelController` - the runes-based owner of the AI panel's on-canvas scope
 * (Svelte port of React's `useAiPanelController`). It keeps `PowerPointViewer`
 * thin by holding the focus targets, the composer prefill, and the two on-canvas
 * highlight sources that share one overlay:
 *
 *   - PICK MODE: the user hits the crosshair, then clicks element(s) on the
 *     slide to hand them to the assistant. Each pick is highlighted and added to
 *     {@link pickTargets}.
 *   - LIVE TOOL FOCUS: while the assistant runs its tool loop, each tool call
 *     flashes a transient "the AI is working on this" highlight on the element
 *     the tool references (see {@link flashToolTarget}), and enables a short
 *     colour-tween window on the canvas.
 *
 * The live focus follows the canvas selection (read through getters); `pinnedFocus`
 * freezes it (set from the chat or a canvas "Ask AI" affordance) so the assistant
 * stays scoped even after the user clicks away.
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { AiChangeBatch, PptxAiFocusedTarget, ToolCanvasTarget } from 'pptx-viewer-shared/ai';

import { computeFocusTargets } from './focus-targets';

/** One element ring to draw on the canvas: an explicit pick or a live-tool focus. */
export interface AiCanvasHighlight {
	slideIndex: number;
	elementId: string;
	/** `pick` = persistent user pick; `active` = transient AI-is-working ring. */
	variant: 'pick' | 'active';
}

/** Live viewer accessors + the panel-open hook the controller closes over. */
export interface AiPanelControllerDeps {
	getActiveSlideIndex(): number;
	getSelectedElementId(): string | null;
	getSelectedElementIds(): readonly string[];
	/** The primary selected element, for building the "Fix with AI" directive. */
	getSelectedElement(): PptxElement | undefined;
	/** Open the panel (askAboutSelection / fixSelection / startPicking need it). */
	openPanel(): void;
}

/** How long a live-tool highlight / colour-tween window stays up after a call. */
const TOOL_FLASH_MS = 2600;

/** Build the "Fix with AI" directive for one element (never auto-sent). */
function fixDirective(element: PptxElement, slideIndex: number): string {
	return `Review and fix any issues with this ${element.type} (id=${element.id}) on slide ${slideIndex + 1}.`;
}

export class AiPanelController {
	/** Pinned focus override (null follows the live selection). */
	pinnedFocus = $state.raw<PptxAiFocusedTarget[] | null>(null);
	/** One-shot composer prefill. `nonce` bumps on every ask/fix. */
	prefill = $state<{ text: string; nonce: number }>({ text: '', nonce: 0 });
	/** True while the user is picking element(s) on the canvas for the assistant. */
	pickMode = $state(false);
	/** The elements the user has explicitly handed to the assistant. */
	pickTargets = $state.raw<PptxAiFocusedTarget[]>([]);
	/** The batch of just-applied element changes the canvas should animate. */
	changeBatch = $state.raw<AiChangeBatch | null>(null);

	#toolFocus = $state.raw<{ slideIndex: number; elementIds: string[] } | null>(null);
	#flashTick = $state(0);
	#flashTimer: ReturnType<typeof setTimeout> | null = null;
	readonly #deps: AiPanelControllerDeps;

	constructor(deps: AiPanelControllerDeps) {
		this.#deps = deps;
	}

	/** Focused targets derived live from the current canvas selection. */
	get liveFocusTargets(): PptxAiFocusedTarget[] {
		return computeFocusTargets({
			activeSlideIndex: this.#deps.getActiveSlideIndex(),
			selectedElementIds: this.#deps.getSelectedElementIds(),
			selectedElementId: this.#deps.getSelectedElementId(),
		});
	}

	/** True when there are explicit picks (they win over a pin / live selection). */
	get hasPicks(): boolean {
		return this.pickTargets.length > 0;
	}

	/** The targets the assistant should scope to: picks > pin > live selection. */
	get effectiveTargets(): PptxAiFocusedTarget[] {
		if (this.hasPicks) {
			return this.pickTargets;
		}
		return this.pinnedFocus ?? this.liveFocusTargets;
	}

	/** Whether a pin is currently the active focus (no picks override it). */
	get isPinned(): boolean {
		return !this.hasPicks && this.pinnedFocus !== null;
	}

	/** Element rings the canvas should draw (picks + the live tool focus). */
	get canvasHighlights(): AiCanvasHighlight[] {
		const out: AiCanvasHighlight[] = [];
		for (const target of this.pickTargets) {
			if (target.kind === 'element') {
				out.push({ slideIndex: target.slideIndex, elementId: target.elementId, variant: 'pick' });
			}
		}
		const focus = this.#toolFocus;
		if (focus) {
			for (const elementId of focus.elementIds) {
				out.push({ slideIndex: focus.slideIndex, elementId, variant: 'active' });
			}
		}
		return out;
	}

	/** True while the canvas should tween colour changes (AI is active). */
	get canvasAnimating(): boolean {
		return this.canvasHighlights.length > 0 || this.#flashTick > 0;
	}

	pinFocus(): void {
		this.pinnedFocus = this.liveFocusTargets;
	}

	clearPinnedFocus(): void {
		this.pinnedFocus = null;
	}

	/** Open the panel scoped to the current selection, empty composer (focused). */
	askAboutSelection(): void {
		this.pinnedFocus = this.liveFocusTargets;
		this.prefill = { text: '', nonce: this.prefill.nonce + 1 };
		this.#deps.openPanel();
	}

	/** Open the panel scoped to the current selection, prefilled fix directive. */
	fixSelection(): void {
		this.pinnedFocus = this.liveFocusTargets;
		const element = this.#deps.getSelectedElement();
		const text = element ? fixDirective(element, this.#deps.getActiveSlideIndex()) : '';
		this.prefill = { text, nonce: this.prefill.nonce + 1 };
		this.#deps.openPanel();
	}

	/** Enter pick mode (the next canvas element clicks become picks). */
	startPicking(): void {
		this.pickMode = true;
		this.#deps.openPanel();
	}

	/** Leave pick mode without clearing the accumulated picks. */
	stopPicking(): void {
		this.pickMode = false;
	}

	/** Add one clicked canvas element to the pick set (and highlight it). */
	addPick(slideIndex: number, elementId: string): void {
		if (this.pickTargets.some((t) => t.kind === 'element' && t.elementId === elementId)) {
			return;
		}
		this.pickTargets = [...this.pickTargets, { kind: 'element', slideIndex, elementId }];
	}

	/** Empty the pick set and leave pick mode. */
	clearPicks(): void {
		this.pickTargets = [];
		this.pickMode = false;
	}

	/**
	 * Flash a transient "the AI is working on this" highlight for a running tool,
	 * and enable colour tweening for a short settle window. Pass `null` to just
	 * enable tweening (e.g. a theme-colour edit with no single element target).
	 */
	flashToolTarget(target: ToolCanvasTarget | null): void {
		if (target && target.slideIndex !== undefined && target.elementIds.length > 0) {
			this.#toolFocus = { slideIndex: target.slideIndex, elementIds: target.elementIds };
		} else {
			this.#toolFocus = null;
		}
		this.#flashTick += 1;
		if (this.#flashTimer) {
			clearTimeout(this.#flashTimer);
		}
		this.#flashTimer = setTimeout(() => {
			this.#toolFocus = null;
			this.#flashTick = 0;
		}, TOOL_FLASH_MS);
	}

	/**
	 * Push (or clear) the change batch the AI apply path published, so the canvas
	 * overlay animates the just-applied edit (glide old->new, fade/scale in-out,
	 * glow). Pass `null` to clear once the animation has settled.
	 */
	showChangeBatch(batch: AiChangeBatch | null): void {
		this.changeBatch = batch;
	}

	/** Cancel the pending flash timer (call on teardown). */
	dispose(): void {
		if (this.#flashTimer) {
			clearTimeout(this.#flashTimer);
			this.#flashTimer = null;
		}
	}
}
