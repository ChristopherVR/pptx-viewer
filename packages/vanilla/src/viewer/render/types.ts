import type {
	ParsedTableStyleMap,
	PptxElement,
	PptxSlide,
	PptxThemeColorScheme,
} from 'pptx-viewer-core';
import type { CanvasSize, CssStyleMap, FieldSubstitutionContext } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';

/** Discriminant values of the {@link PptxElement} union (`'text'`, `'chart'`, ...). */
export type PptxElementType = PptxElement['type'];

/**
 * Everything an element renderer may need, passed to every renderer call.
 *
 * The context is immutable per slide render. Renderers must create DOM through
 * `context.document` (never the global `document`) so slides can render into
 * detached documents (tests, export pipelines).
 */
export interface ElementRenderContext {
	/** Document used for all DOM creation. */
	readonly document: Document;
	/** The slide being rendered. */
	readonly slide: PptxSlide;
	/** Full deck, used by Zoom elements to resolve their target preview. */
	readonly slides?: readonly PptxSlide[];
	/** Zero-based active slide index for Zoom return navigation. */
	readonly currentSlideIndex?: number;
	/** Presentation-only Zoom tile activation callback. */
	readonly onZoomClick?: (targetSlideIndex: number, returnSlideIndex: number) => void;
	/** Full slide canvas size in CSS px (elements are positioned in this space). */
	readonly canvasSize: CanvasSize;
	/**
	 * The scale the stage is rendered at (1 = 100%). The stage applies it via a
	 * CSS transform, so renderers should lay out in unscaled canvas px; `scale`
	 * is informational (e.g. for raster density decisions).
	 */
	readonly scale: number;
	/** Archive-path to displayable URL map for media + poster frames. */
	readonly mediaDataUrls: ReadonlyMap<string, string>;
	/** Presentation theme colour scheme used by theme-aware render helpers. */
	readonly colorScheme?: PptxThemeColorScheme;
	/** Parsed `ppt/tableStyles.xml` definitions used by table band/header styling. */
	readonly tableStyleMap?: ParsedTableStyleMap;
	readonly fieldContext?: FieldSubstitutionContext;
	/** Shared-dictionary translator (`pptx.*` keys). */
	readonly t: Translator;
	/**
	 * Opt-in flag: render `smartArt` elements as an extruded Three.js scene
	 * instead of flat SVG (see `PptxViewerOptions.smartArt3D`). Defaults to
	 * `false` when the option is unset.
	 */
	readonly smartArt3D: boolean;
	/**
	 * True only for the live presentation stage (real Fullscreen API active):
	 * media renderers use this to autoplay once mounted, matching PowerPoint's
	 * slideshow behaviour. `false` for the editor canvas and thumbnail rail.
	 */
	readonly presenting: boolean;
	readonly onSmartArtNodeTextChange?: (element: PptxElement, nodeId: string, text: string) => void;
	readonly onSmartArtNodeFillChange?: (element: PptxElement, nodeId: string, fill: string) => void;
	/** The registry in effect, for renderers that need to inspect it. */
	readonly registry: ElementRendererRegistry;
	/**
	 * Render a child element through the registry (used by the group renderer
	 * for recursion; custom renderers may nest elements the same way).
	 */
	renderElement(element: PptxElement, zIndex: number): HTMLElement | SVGElement | null;
}

/**
 * Renders one slide element to a DOM node (or `null` to render nothing).
 *
 * Contract:
 * - Position absolutely within the stage: apply the shared
 *   `getContainerStyle(element, zIndex)` map (or equivalent) to the returned
 *   root node.
 * - Set `dataset.elementId = element.id` on the root node.
 * - Create all DOM via `context.document`.
 * - Never mutate `element` or anything on the context.
 */
export type ElementRenderer = (
	element: PptxElement,
	zIndex: number,
	context: ElementRenderContext,
) => HTMLElement | SVGElement | null;

/**
 * Registry dispatching elements to renderers by their `type` discriminant.
 *
 * Additional element types are supported by registering a renderer for the
 * type; unregistered types fall through to the fallback renderer (a typed
 * placeholder box by default). See `render/elements/README.md` for the
 * step-by-step contract.
 */
export interface ElementRendererRegistry {
	/** Register (or replace) the renderer for an element type. */
	register(type: PptxElementType, renderer: ElementRenderer): void;
	/** Remove the renderer for an element type (falls back afterwards). */
	unregister(type: PptxElementType): void;
	/** The renderer registered for a type, or `undefined`. */
	get(type: PptxElementType): ElementRenderer | undefined;
	/** True when a dedicated (non-fallback) renderer is registered. */
	has(type: PptxElementType): boolean;
	/** Replace the fallback renderer used for unregistered types. */
	setFallback(renderer: ElementRenderer): void;
	/** The renderer to use for a type: registered renderer or fallback. */
	resolve(type: PptxElementType): ElementRenderer;
	/** All types with a dedicated renderer (sorted, for tests/debugging). */
	registeredTypes(): PptxElementType[];
}

/** Re-export of the shared plain CSS style map used by all style builders. */
export type { CssStyleMap };
