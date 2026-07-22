import type { CssStyleMap } from 'pptx-viewer-shared';
/**
 * Plays the "watch the AI edit land" animation on the canvas. When the AI apply
 * path publishes a batch of changed elements to the session's change animator,
 * this overlay reveals the affected slide and, for each element that changed on
 * the visible slide, draws a ghost rect that on the next frame flips from its
 * `start` to `end` state so the browser transitions between them: added elements
 * fade+scale in, removed fade+scale out, moved/resized glide old->new, all under
 * a glow. Rendered INSIDE the (CSS-transform-scaled) slide stage, so the change
 * bounds (slide CSS pixels) map 1:1.
 *
 * Vanilla counterpart of React's `AiChangeOverlay`. Like the focus highlight
 * overlay it is imperative and repaints after every stage render (the renderer
 * rebuilds the stage, discarding the previous overlay), so an in-flight batch
 * survives the re-render the apply itself triggers.
 */
import type {
	AiChangeBatch,
	AiElementChange,
	ResolvedAiChangeAnimationConfig,
} from 'pptx-viewer-shared/ai';
import { aiChangeAnimationCss, changeGhostStyle } from 'pptx-viewer-shared/ai';

import { createEl } from '../render';
import type { Store, ViewerState } from '../state';

/** Bus a binding subscribes to for change-animation batches. */
export interface ChangeAnimatorLike {
	subscribe(listener: (batch: AiChangeBatch | null) => void): () => void;
	current(): AiChangeBatch | null;
}

export interface AiChangeOverlayDeps {
	doc: Document;
	store: Store<ViewerState>;
	/** The change animator carried by the AI session. */
	animator: ChangeAnimatorLike;
	/** The live `.pptxv-stage` node (rebuilt on each render), or null. */
	getStageRoot(): HTMLElement | null;
	/** Reveal the slide the batch lives on before drawing its ghosts. */
	goToSlide(index: number): void;
}

export interface AiChangeOverlay {
	destroy(): void;
}

/** Numeric geometry from the shared ghost style needs an explicit `px` unit. */
function ghostStyleMap(
	change: AiElementChange,
	phase: 'start' | 'end',
	config: ResolvedAiChangeAnimationConfig,
): CssStyleMap {
	const s = changeGhostStyle(change, phase, config);
	return {
		position: s.position,
		left: `${s.left}px`,
		top: `${s.top}px`,
		width: `${s.width}px`,
		height: `${s.height}px`,
		opacity: String(s.opacity),
		transform: s.transform,
		transition: s.transition,
		'box-shadow': s.boxShadow,
		border: s.border,
		'border-radius': s.borderRadius,
		'pointer-events': s.pointerEvents,
		'z-index': String(s.zIndex),
	};
}

/**
 * Build (but do not animate) the ghost layer for a batch on `activeSlideIndex`:
 * one ghost per change on that slide, each in its `start` style. Returns null
 * when nothing on the active slide changed, so the caller can skip painting.
 */
export function buildChangeGhostLayer(
	doc: Document,
	batch: AiChangeBatch,
	activeSlideIndex: number,
): HTMLElement | null {
	const changes = batch.changes.filter((c) => c.slideIndex === activeSlideIndex);
	if (changes.length === 0) {
		return null;
	}
	const layer = createEl(doc, 'div', 'pptxv-ai-change-layer');
	layer.setAttribute('data-export-ignore', 'true');
	for (const change of changes) {
		const ghost = createEl(
			doc,
			'div',
			'pptxv-ai-change-ghost',
			ghostStyleMap(change, 'start', batch.config),
		);
		ghost.setAttribute('data-ai-change', change.kind);
		ghost.setAttribute('data-export-ignore', 'true');
		layer.appendChild(ghost);
	}
	return layer;
}

/** Flip every ghost in a layer to its `end` style so the CSS transition runs. */
function flipToEnd(layer: HTMLElement, batch: AiChangeBatch, activeSlideIndex: number): void {
	const changes = batch.changes.filter((c) => c.slideIndex === activeSlideIndex);
	const ghosts = layer.children;
	for (let i = 0; i < ghosts.length && i < changes.length; i += 1) {
		const ghost = ghosts[i] as HTMLElement;
		const map = ghostStyleMap(changes[i], 'end', batch.config);
		for (const [key, value] of Object.entries(map)) {
			ghost.style.setProperty(key, String(value));
		}
	}
}

/** Mount the change overlay; repaints on store + animator changes. */
export function mountAiChangeOverlay(deps: AiChangeOverlayDeps): AiChangeOverlay {
	const { doc, store, animator } = deps;
	let layer: HTMLElement | null = null;
	let styleEl: HTMLStyleElement | null = null;
	let batch: AiChangeBatch | null = animator.current();
	let rafOuter = 0;
	let rafInner = 0;

	const cancelFrames = (): void => {
		if (rafOuter) {
			cancelAnimationFrame(rafOuter);
			rafOuter = 0;
		}
		if (rafInner) {
			cancelAnimationFrame(rafInner);
			rafInner = 0;
		}
	};

	const ensureStyle = (host: HTMLElement | null): void => {
		if (!batch) {
			return;
		}
		if (!styleEl || !styleEl.isConnected) {
			styleEl = createEl(doc, 'style', 'pptxv-ai-change-css');
			(host ?? doc.head).appendChild(styleEl);
		}
		styleEl.textContent = aiChangeAnimationCss(batch.config);
	};

	const paint = (): void => {
		cancelFrames();
		layer?.remove();
		layer = null;
		if (!batch) {
			return;
		}
		const stage = deps.getStageRoot();
		if (!stage) {
			return;
		}
		ensureStyle(stage.parentElement);
		const activeSlideIndex = store.get().currentSlide;
		const nextLayer = buildChangeGhostLayer(doc, batch, activeSlideIndex);
		if (!nextLayer) {
			return;
		}
		stage.appendChild(nextLayer);
		layer = nextLayer;
		// Two frames: let the browser paint the `start` state before flipping to
		// `end`, so the CSS transition actually runs instead of snapping.
		const activeBatch = batch;
		rafOuter = requestAnimationFrame(() => {
			rafInner = requestAnimationFrame(() => {
				if (layer) {
					flipToEnd(layer, activeBatch, activeSlideIndex);
				}
			});
		});
	};

	const unsubStore = store.subscribe(paint);
	const unsubAnimator = animator.subscribe((next) => {
		batch = next;
		if (next) {
			deps.goToSlide(next.slideIndex);
		}
		paint();
	});
	paint();

	return {
		destroy() {
			cancelFrames();
			unsubStore();
			unsubAnimator();
			layer?.remove();
			layer = null;
			styleEl?.remove();
			styleEl = null;
		},
	};
}
