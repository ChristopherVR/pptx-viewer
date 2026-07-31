import type { PptxSlide } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';

/**
 * Prop contracts for the slide surfaces: the pure `SlideStage` (used by the
 * canvas, the thumbnail rail and the off-screen export stage alike) and the
 * interactive `SlideCanvas` that scales it and owns the pointer handlers.
 * Split out of `props.ts` for the repo's file-size budget; import them from
 * `./props`, which re-exports this module.
 */

export interface SlideStageProps {
	slide: PptxSlide | undefined;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	scale?: number;
	/** Forwarded to each `ElementRenderer`; see `ElementRendererProps.presenting`. */
	presenting?: boolean;
	/**
	 * True only for the main (interactive) canvas, never the thumbnail rail.
	 * Adds `role="region" aria-roledescription="slide"` to the stage itself
	 * (the framework-neutral e2e hook React/Vue/Angular also emit) and is
	 * forwarded to each `ElementRenderer`; see `ElementRendererProps.interactive`.
	 */
	interactive?: boolean;
	editTemplateMode?: boolean;
	/**
	 * Skip the resolved slide background and leave the stage see-through.
	 *
	 * `getSlideBackgroundStyle` always resolves to an OPAQUE fill (it falls back
	 * to the default slide background), which is right for a stage that owns the
	 * screen and wrong for one stacked over another. The morph transition's
	 * departing-shape layer is exactly that: it sits above the incoming slide,
	 * so its background would hide the whole morph behind a flat slab.
	 */
	transparentBackground?: boolean;
	ontablecellcommit?: (
		elementId: string,
		rowIndex: number,
		cellIndex: number,
		text: string,
	) => void;
	onsmartartnodecommit?: (elementId: string, nodeId: string, text: string) => void;
	onsmartartnodefill?: (elementId: string, nodeId: string, fill: string) => void;
}

export interface SlideCanvasProps {
	slide: PptxSlide | undefined;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	/** Effective scale (fit-to-viewport x user zoom), pre-computed by the host. */
	scale: number;
	/** True only on the live presentation stage; see `SlideStageProps.presenting`. */
	presenting?: boolean;
	/** True while in-place editing is available; gates the pointer handlers and the editing cursor/class. */
	editingActive?: boolean;
	editTemplateMode?: boolean;
	ontablecellcommit?: (
		elementId: string,
		rowIndex: number,
		cellIndex: number,
		text: string,
	) => void;
	onsmartartnodecommit?: (elementId: string, nodeId: string, text: string) => void;
	onsmartartnodefill?: (elementId: string, nodeId: string, fill: string) => void;
	/** Reports the stage-holder node to the host on mount/teardown (editing hit-surface, export capture anchor). */
	onstageholder?: (el: HTMLDivElement | null) => void;
	onstagepointerdown?: (event: PointerEvent) => void;
	onstagepointermove?: (event: PointerEvent) => void;
	onstagedblclick?: (event: MouseEvent) => void;
	onstagecontextmenu?: (event: MouseEvent) => void;
	/** Fired on any stage click; the host wires this to advance presentation playback. */
	onstageclick?: (event: MouseEvent) => void;
	/**
	 * True while the AI panel is picking an element: the next element click(s)
	 * become the assistant's focus (highlighted) instead of selecting / editing.
	 */
	aiPickMode?: boolean;
	/**
	 * True while a running AI tool is active: the stage marks itself
	 * `data-pptx-ai-active` so element colour changes tween while the assistant
	 * works (see AiFocusHighlightOverlay's tween rule).
	 */
	aiActive?: boolean;
	/** Route a picked canvas element to the AI focus (pick mode only). */
	onaipickelement?: (elementId: string) => void;
	/**
	 * Overlay content layered above the slide (selection/editor layer, ink
	 * drawing, alignment guides, presentation annotations, collaboration
	 * cursors, transition overlay, ...). Rendered inside the same
	 * fixed-size, scaled stage-holder as the slide itself. Kept out of this
	 * component's own props (rather than a fixed list of overlay slots) so it
	 * stays free of the live editor/controller instances those overlays need.
	 */
	children?: import('svelte').Snippet;
}
